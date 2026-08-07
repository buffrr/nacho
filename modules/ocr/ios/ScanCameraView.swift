import ExpoModulesCore
import AVFoundation
import Vision

// Real-time scanner. One AVCaptureSession drives a live preview layer plus two
// outputs: a metadata output for QR (fires instantly, checksum-validated) and a
// video-data output whose frames are OCR'd by Vision directly off the CVPixelBuffer
// — no photo capture, no disk, no JS round-trip, so the preview never stutters.
// Recognized QR strings / OCR line arrays are emitted to JS, which owns the
// accept grammar + single-lock arbitration (see src/scanInput.ts + Scan.tsx).
class ScanCameraView: ExpoView,
  AVCaptureMetadataOutputObjectsDelegate,
  AVCaptureVideoDataOutputSampleBufferDelegate {

  private let onBarcode = EventDispatcher()
  private let onText = EventDispatcher()

  private let session = AVCaptureSession()
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private let sessionQueue = DispatchQueue(label: "nacho.scan.session")
  private let videoQueue = DispatchQueue(label: "nacho.scan.video")

  var scanning = true
  private var configured = false
  private var lastOCR = Date.distantPast
  private let ocrMinInterval: TimeInterval = 0.1 // floor between OCR passes

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let preview = AVCaptureVideoPreviewLayer(session: session)
    preview.videoGravity = .resizeAspectFill
    layer.addSublayer(preview)
    previewLayer = preview
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer?.frame = bounds
  }

  func setActive(_ active: Bool) {
    sessionQueue.async { [weak self] in
      guard let self = self else { return }
      if active {
        if !self.configured { self.configure() }
        if !self.session.isRunning { self.session.startRunning() }
      } else if self.session.isRunning {
        self.session.stopRunning()
      }
    }
  }

  private func configure() {
    configured = true
    session.beginConfiguration()
    session.sessionPreset = .hd1280x720

    if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
       let input = try? AVCaptureDeviceInput(device: device),
       session.canAddInput(input) {
      session.addInput(input)
    }

    let metaOut = AVCaptureMetadataOutput()
    if session.canAddOutput(metaOut) {
      session.addOutput(metaOut)
      metaOut.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
      metaOut.metadataObjectTypes =
        metaOut.availableMetadataObjectTypes.contains(.qr) ? [.qr] : []
    }

    let videoOut = AVCaptureVideoDataOutput()
    videoOut.alwaysDiscardsLateVideoFrames = true
    videoOut.videoSettings = [
      kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA)
    ]
    if session.canAddOutput(videoOut) {
      session.addOutput(videoOut)
      videoOut.setSampleBufferDelegate(self, queue: videoQueue)
    }

    session.commitConfiguration()

    // App is portrait-locked, so the preview is fixed to portrait.
    DispatchQueue.main.async { [weak self] in
      if let conn = self?.previewLayer?.connection, conn.isVideoOrientationSupported {
        conn.videoOrientation = .portrait
      }
    }
  }

  // MARK: - QR (instant)
  func metadataOutput(_ output: AVCaptureMetadataOutput,
                      didOutput metadataObjects: [AVMetadataObject],
                      from connection: AVCaptureConnection) {
    guard scanning else { return }
    for obj in metadataObjects {
      if let code = obj as? AVMetadataMachineReadableCodeObject,
         code.type == .qr, let value = code.stringValue {
        onBarcode(["data": value])
        return
      }
    }
  }

  // MARK: - OCR (throttled video frames)
  func captureOutput(_ output: AVCaptureOutput,
                     didOutput sampleBuffer: CMSampleBuffer,
                     from connection: AVCaptureConnection) {
    guard scanning else { return }
    let now = Date()
    if now.timeIntervalSince(lastOCR) < ocrMinInterval { return }
    lastOCR = now
    guard let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

    let request = VNRecognizeTextRequest { [weak self] req, _ in
      guard let self = self, self.scanning else { return }
      let observations = req.results as? [VNRecognizedTextObservation] ?? []
      let lines = observations.compactMap { $0.topCandidates(1).first?.string }
      if !lines.isEmpty {
        DispatchQueue.main.async { self.onText(["lines": lines]) }
      }
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false

    // Back camera in portrait delivers landscape pixels; .right makes text upright.
    let handler = VNImageRequestHandler(cvPixelBuffer: pixelBuffer,
                                        orientation: .right,
                                        options: [:])
    // perform() is synchronous on videoQueue; alwaysDiscardsLateVideoFrames drops
    // any frames that pile up while a (slow, .accurate) pass is running.
    try? handler.perform([request])
  }
}
