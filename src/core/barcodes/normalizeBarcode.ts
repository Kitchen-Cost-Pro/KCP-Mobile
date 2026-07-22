/**
 * Mobile counterpart of KCP's barcode normalisation contract.
 *
 * KCP stores retail UPC scans as EAN-13, so a twelve-digit numeric UPC is
 * represented with its leading EAN zero.  Do not convert any other barcode:
 * Code 128 and other non-numeric identifiers must remain exact.
 */
export function normalizeKcpBarcode(value: unknown) {
  const raw = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, '');

  return /^\d{12}$/.test(raw) ? `0${raw}` : raw;
}
