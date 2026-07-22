import { Capacitor } from '@capacitor/core';
import { normalizeKcpBarcode } from '../../core/barcodes/normalizeBarcode';

export async function scanBarcodeWithDevice() {
  if (!Capacitor.isNativePlatform() && !window.isSecureContext) {
    throw new Error('Camera scanning requires the installed KCP Lite app or a secure HTTPS browser. Enter the barcode manually on this preview.');
  }
  // Keep the camera/WebAssembly stack out of the initial KCP Lite bundle. It is loaded only when
  // the user explicitly opens the scanner.
  const {
    CapacitorBarcodeScanner,
    CapacitorBarcodeScannerAndroidScanningLibrary,
    CapacitorBarcodeScannerCameraDirection,
    CapacitorBarcodeScannerScanOrientation,
    CapacitorBarcodeScannerTypeHint
  } = await import('@capacitor/barcode-scanner');
  const result = await CapacitorBarcodeScanner.scanBarcode({
    hint: CapacitorBarcodeScannerTypeHint.ALL,
    scanInstructions: 'Align the stock-item barcode inside the frame',
    scanButton: false,
    scanText: 'Scan',
    cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
    scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
    cancelButtonAccessibilityLabel: 'Cancel barcode scan',
    torchButtonOnAccessibilityLabel: 'Turn torch off',
    torchButtonOffAccessibilityLabel: 'Turn torch on',
    android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.MLKIT },
    web: { showCameraSelection: true, scannerFPS: 12 }
  });
  const barcode = normalizeKcpBarcode(result.ScanResult);
  if (!barcode) throw new Error('No barcode was captured. Try again or enter it manually.');
  return barcode;
}
