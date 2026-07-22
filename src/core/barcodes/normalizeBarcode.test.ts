import { describe, expect, it } from 'vitest';
import { normalizeKcpBarcode } from './normalizeBarcode';

describe('KCP barcode normalisation', () => {
  it('converts a twelve-digit UPC into KCP’s EAN-13 representation', () => {
    expect(normalizeKcpBarcode(' 012345678905 ')).toBe('0012345678905');
  });

  it('keeps already canonical and non-numeric barcode values exact', () => {
    expect(normalizeKcpBarcode('6001234567890')).toBe('6001234567890');
    expect(normalizeKcpBarcode('KCP-CASE-12')).toBe('KCP-CASE-12');
  });
});
