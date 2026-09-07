package expo.modules.ocr

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android counterpart of the iOS ScanViewModule (modules/ocr/ios). Registers the
// native "ScanView" — a CameraX preview that runs ML Kit OCR (Latin) + QR on the
// live frames and emits onText/onBarcode, matching the iOS view's contract so
// src/scanInput.ts + Scan.tsx arbitrate identically across platforms.
class ScanViewModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ScanView")

    View(ScanCameraView::class) {
      Events("onBarcode", "onText")

      // Run the capture session (tie to screen focus). False releases the camera.
      Prop("active") { view: ScanCameraView, active: Boolean ->
        view.setActive(active)
      }

      // Emit detections. Preview keeps running while false, so a locked result
      // can freeze scanning without tearing down the camera.
      Prop("scanning") { view: ScanCameraView, scanning: Boolean ->
        view.scanning = scanning
      }
    }
  }
}
