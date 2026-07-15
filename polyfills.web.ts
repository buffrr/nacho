import { Buffer } from "buffer";

// Set synchronously at module load (before any render) so code paths that use
// Buffer during the first render — e.g. key derivation in the handle list —
// don't race an async import.
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}

if (!("BarcodeDetector" in window)) {
  const loadZbarWasm = async () => {
    try {
      const zbarWasm = await import("@undecaf/zbar-wasm");
      return zbarWasm;
    } catch (error) {
      console.warn("Failed to load zbar-wasm:", error);
      return null;
    }
  };

  (window as any).BarcodeDetector = class BarcodeDetector {
    private zbarWasm: any = null;
    private loaded = false;

    constructor(options: any = {}) {}

    async detect(imageData: any) {
      if (!this.loaded) {
        this.zbarWasm = await loadZbarWasm();
        this.loaded = true;
      }

      if (!this.zbarWasm) {
        return [];
      }

      try {
        const results = await this.zbarWasm.scanRGBABuffer(
          imageData.data || imageData,
          imageData.width,
          imageData.height,
        );
        return results.map((result: any) => ({
          rawValue: result.decode(),
          format: result.typeName,
          boundingBox: result.points
            ? {
                x: Math.min(...result.points.map((p: any) => p.x)),
                y: Math.min(...result.points.map((p: any) => p.y)),
                width:
                  Math.max(...result.points.map((p: any) => p.x)) -
                  Math.min(...result.points.map((p: any) => p.x)),
                height:
                  Math.max(...result.points.map((p: any) => p.y)) -
                  Math.min(...result.points.map((p: any) => p.y)),
              }
            : undefined,
        }));
      } catch (error) {
        console.warn("QR scanning failed:", error);
        return [];
      }
    }
  };
}
