import ExpoModulesCore

// Registers the native real-time scanner view. The view owns an AVCaptureSession
// that feeds QR (metadata output) and OCR (video frames → Vision) at the same
// time; both surface to JS as events, where scanInput.ts arbitrates a lock.
public class ScanViewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScanView")

    View(ScanCameraView.self) {
      Events("onBarcode", "onText")

      // Whether the capture session runs at all (tie to screen focus). Stopping
      // it releases the camera when the tab is backgrounded.
      Prop("active") { (view: ScanCameraView, active: Bool) in
        view.setActive(active)
      }

      // Whether detections are emitted. Preview keeps running while false, so a
      // locked result can freeze scanning without tearing down the camera.
      Prop("scanning") { (view: ScanCameraView, scanning: Bool) in
        view.scanning = scanning
      }
    }
  }
}
