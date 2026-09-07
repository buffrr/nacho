package expo.modules.ocr

import android.annotation.SuppressLint
import android.content.Context
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.util.concurrent.Executors

// Real-time scanner (Android). One CameraX session drives a live PreviewView plus
// an ImageAnalysis use case whose frames are fed to ML Kit — QR (barcode scanner,
// instant) and OCR (Latin text recognizer) at once. Recognized QR strings / OCR
// line arrays are emitted to JS, which owns the accept grammar + single-lock
// arbitration (see src/scanInput.ts + Scan.tsx). Mirrors the iOS ScanCameraView
// (AVCaptureSession + Vision); the live highlight boxes the iOS view draws are
// omitted here (the RN overlay is identical either way).
class ScanCameraView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext), LifecycleOwner {

  private val onBarcode by EventDispatcher()
  private val onText by EventDispatcher()

  // Own our Lifecycle so CameraX can bind to this view (an ExpoView isn't a
  // LifecycleOwner). setActive drives it RESUMED/CREATED to start/stop capture.
  private val lifecycleRegistry = LifecycleRegistry(this)
  override fun getLifecycle(): Lifecycle = lifecycleRegistry

  private val previewView = PreviewView(context).apply {
    layoutParams = ViewGroup.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.MATCH_PARENT,
    )
    scaleType = PreviewView.ScaleType.FILL_CENTER
    // TextureView (not the default SurfaceView) so the preview composites in the
    // normal view hierarchy — the RN overlay (hint/result card) draws cleanly on
    // top, and it's captured by screenshots. SurfaceView is a separate hardware
    // layer that can occlude overlays and shows black in screencap.
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
  }

  private val analysisExecutor = Executors.newSingleThreadExecutor()
  private val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  private val barcodeScanner = BarcodeScanning.getClient(
    BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build(),
  )

  private var cameraProvider: ProcessCameraProvider? = null
  private var active = false
  var scanning = true

  // ML Kit passes are async; skip frames while one is in flight and enforce a
  // floor between passes (matches the iOS 0.1s throttle) so the preview never
  // stutters. STRATEGY_KEEP_ONLY_LATEST means we never build a backlog.
  @Volatile private var busy = false
  private var lastPass = 0L
  private val minIntervalMs = 100L

  init {
    addView(previewView)
    lifecycleRegistry.currentState = Lifecycle.State.CREATED
  }

  // RN sizes this view directly and does NOT run the normal measure/layout pass
  // on its children, so PreviewView (and its TextureView) stay 0×0 and the
  // preview renders black. Force children to lay out to our bounds on every
  // requestLayout — the standard workaround for native views hosting subviews.
  private val layoutRunnable = Runnable {
    measure(
      MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
    )
    layout(left, top, right, bottom)
  }

  override fun requestLayout() {
    super.requestLayout()
    post(layoutRunnable)
  }

  fun setActive(value: Boolean) {
    if (active == value) return
    active = value
    // Only touch the camera while attached; onAttachedToWindow (re)starts it when
    // active. rnscreens native tabs create the view before it's attached and
    // detach/re-attach it on tab switches.
    if (isAttachedToWindow) {
      if (value) start() else stop()
    }
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (active) start()
  }

  private fun start() {
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      try {
        val provider = future.get()
        cameraProvider = provider
        bind(provider)
        moveTo(Lifecycle.State.RESUMED)
      } catch (_: Exception) {
        // No camera available (e.g. permission not yet granted) — JS gates the
        // permission prompt, so this is a benign no-op until it's granted.
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun bind(provider: ProcessCameraProvider) {
    val preview = Preview.Builder().build().also {
      it.setSurfaceProvider(previewView.surfaceProvider)
    }
    val analysis = ImageAnalysis.Builder()
      .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
      .build()
      .also { it.setAnalyzer(analysisExecutor, ::analyze) }

    provider.unbindAll()
    provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
  }

  private fun stop() {
    cameraProvider?.unbindAll()
    moveTo(Lifecycle.State.CREATED)
  }

  // A LifecycleRegistry can never move out of DESTROYED; guard every transition
  // so a double-detach or a late async callback can't throw.
  private fun moveTo(state: Lifecycle.State) {
    if (lifecycleRegistry.currentState != Lifecycle.State.DESTROYED) {
      lifecycleRegistry.currentState = state
    }
  }

  @SuppressLint("UnsafeOptInUsageError")
  private fun analyze(proxy: ImageProxy) {
    val media = proxy.image
    val now = System.currentTimeMillis()
    if (media == null || !scanning || busy || now - lastPass < minIntervalMs) {
      proxy.close()
      return
    }
    lastPass = now
    busy = true

    val image = InputImage.fromMediaImage(media, proxy.imageInfo.rotationDegrees)

    val textTask = textRecognizer.process(image).addOnSuccessListener { visionText ->
      if (!scanning) return@addOnSuccessListener
      val lines = ArrayList<String>()
      for (block in visionText.textBlocks) for (line in block.lines) lines.add(line.text)
      if (lines.isNotEmpty()) onText(mapOf("lines" to lines))
    }
    val barcodeTask = barcodeScanner.process(image).addOnSuccessListener { codes ->
      if (!scanning) return@addOnSuccessListener
      val value = codes.firstOrNull { it.format == Barcode.FORMAT_QR_CODE }?.rawValue
      if (value != null) onBarcode(mapOf("data" to value))
    }
    // Close the frame only once BOTH detectors finish, or ImageAnalysis stalls.
    Tasks.whenAllComplete(textTask, barcodeTask).addOnCompleteListener {
      busy = false
      proxy.close()
    }
  }

  // Detach = tab switched away. rnscreens native tabs reuse this same view, so we
  // must stay reusable: release the camera and pause to CREATED — do NOT destroy
  // the lifecycle or shut down the executor/recognizers, or a re-attach would be
  // stuck DESTROYED / hit a dead executor. The view lives for the app session
  // (one Scan tab), so its executor + ML Kit clients are left to the process.
  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    stop()
  }
}
