export function createId(prefix: string) {
  const safePrefix = String(prefix || 'id').replace(/[^a-z0-9_-]/gi, '').slice(0, 24) || 'id';
  const bytes = new Uint8Array(12);
  try {
    globalThis.crypto?.getRandomValues(bytes);
  } catch {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  const random = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
  return `${safePrefix}-${Date.now().toString(36)}-${random}`;
}
