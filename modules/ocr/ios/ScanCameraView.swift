import ExpoModulesCore
import AVFoundation
import Vision

// Real-time scanner. One AVCaptureSession drives a live preview layer plus two
// outputs: a metadata output for QR (fires instantly, checksum-validated) and a
// video-data output whose frames are OCR'd by Vision directly off the CVPixelBuffer
// — no photo capture, no disk, no JS round-trip, so the preview never stutters.
// Recognized QR strings / OCR line arrays are emitted to JS, which owns the
// accept grammar + single-lock arbitration (see src/scanInput.ts + Scan.tsx).
// The view also draws live highlight boxes: around a detected QR, and around any
// handle-looking text (a loose native heuristic — the authoritative accept still
// happens in JS).
class ScanCameraView: ExpoView,
  AVCaptureMetadataOutputObjectsDelegate,
  AVCaptureVideoDataOutputSampleBufferDelegate {

  private let onBarcode = EventDispatcher()
  private let onText = EventDispatcher()

  private let session = AVCaptureSession()
  private var previewLayer: AVCaptureVideoPreviewLayer?
  private let qrHighlight = CALayer()
  private let textHighlight = CALayer()
  private let sessionQueue = DispatchQueue(label: "nacho.scan.session")
  private let videoQueue = DispatchQueue(label: "nacho.scan.video")

  private static let highlightColor = UIColor(red: 1.0, green: 0.482, blue: 0.0, alpha: 1.0) // #FF7B00
  // Loose "looks like a handle" heuristic for the highlight only (not the lock).
  private static let handleRegex = try! NSRegularExpression(
    pattern: "[a-z0-9._-]+@[a-z0-9._-]+", options: [.caseInsensitive])

  var scanning = true {
    didSet {
      if !scanning {
        DispatchQueue.main.async { [weak self] in
          self?.drawBoxes(in: self?.qrHighlight, rects: [])
          self?.drawBoxes(in: self?.textHighlight, rects: [])
        }
      }
    }
  }
  private var configured = false
  private var lastOCR = Date.distantPast
  private let ocrMinInterval: TimeInterval = 0.1 // floor between OCR passes

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    let preview = AVCaptureVideoPreviewLayer(session: session)
    preview.videoGravity = .resizeAspectFill
    layer.addSublayer(preview)
    layer.addSublayer(qrHighlight)
    layer.addSublayer(textHighlight)
    previewLayer = preview
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    previewLayer?.frame = bounds
    qrHighlight.frame = bounds
    textHighlight.frame = bounds
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

    var boxes: [CGRect] = []
    var payload: String?
    for obj in metadataObjects {
      guard let code = obj as? AVMetadataMachineReadableCodeObject, code.type == .qr else { continue }
      if let t = previewLayer?.transformedMetadataObject(for: code) { boxes.append(t.bounds) }
      if payload == nil, let value = code.stringValue { payload = value }
    }
    drawBoxes(in: qrHighlight, rects: boxes)
    if let value = payload { onBarcode(["data": value]) }
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

    // With orientation .right the upright (portrait) image swaps buffer W/H.
    let imageW = CGFloat(CVPixelBufferGetHeight(pixelBuffer))
    let imageH = CGFloat(CVPixelBufferGetWidth(pixelBuffer))

    let request = VNRecognizeTextRequest { [weak self] req, _ in
      guard let self = self, self.scanning else { return }
      let observations = req.results as? [VNRecognizedTextObservation] ?? []

      var lines: [String] = []
      var handleRects: [CGRect] = [] // image-point space (top-left origin)
      for obs in observations {
        guard let candidate = obs.topCandidates(1).first?.string else { continue }
        lines.append(candidate)
        let range = NSRange(candidate.startIndex..., in: candidate)
        if Self.handleRegex.firstMatch(in: candidate, options: [], range: range) != nil {
          let bb = obs.boundingBox // normalized, origin bottom-left
          handleRects.append(CGRect(
            x: bb.minX * imageW,
            y: (1 - bb.maxY) * imageH,
            width: bb.width * imageW,
            height: bb.height * imageH))
        }
      }

      DispatchQueue.main.async {
        self.drawBoxes(in: self.textHighlight,
                       rects: self.viewRects(fromImageRects: handleRects, imageW: imageW, imageH: imageH))
        if !lines.isEmpty { self.onText(["lines": lines]) }
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

  // MARK: - Highlight drawing

  // Map image-point rects (upright portrait image, top-left origin) into preview
  // view coords, accounting for the .resizeAspectFill scale + centering crop.
  private func viewRects(fromImageRects rects: [CGRect], imageW: CGFloat, imageH: CGFloat) -> [CGRect] {
    guard imageW > 0, imageH > 0, let pv = previewLayer else { return [] }
    let vs = pv.bounds.size
    let scale = max(vs.width / imageW, vs.height / imageH)
    let dx = (vs.width - imageW * scale) / 2
    let dy = (vs.height - imageH * scale) / 2
    return rects.map {
      CGRect(x: $0.origin.x * scale + dx,
             y: $0.origin.y * scale + dy,
             width: $0.width * scale,
             height: $0.height * scale)
    }
  }

  private func drawBoxes(in container: CALayer?, rects: [CGRect]) {
    guard let container = container else { return }
    CATransaction.begin()
    CATransaction.setDisableActions(true) // no implicit fade/move animation
    container.sublayers?.forEach { $0.removeFromSuperlayer() }
    for rect in rects {
      let box = CAShapeLayer()
      box.path = UIBezierPath(roundedRect: rect.insetBy(dx: -6, dy: -6), cornerRadius: 10).cgPath
      box.strokeColor = Self.highlightColor.cgColor
      box.fillColor = Self.highlightColor.withAlphaComponent(0.12).cgColor
      box.lineWidth = 2.5
      container.addSublayer(box)
    }
    CATransaction.commit()
  }
}
