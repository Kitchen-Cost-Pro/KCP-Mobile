import { describe, expect, it } from 'vitest';
import { normalizeWorkspaceLogo, resolveWorkspaceTheme } from './presets';

describe('workspace branding', () => {
  it('reuses the main KCP restaurant logo setting', () => {
    const logo = 'data:image/png;base64,a2Nw';
    expect(resolveWorkspaceTheme({ restaurantLogoDataUrl: logo }).logoDataUrl).toBe(logo);
  });

  it('supports legacy KCP logo keys and rejects non-image content', () => {
    expect(resolveWorkspaceTheme({ logoDataUrl: 'data:image/webp;base64,a2Nw' }).logoDataUrl).toBe('data:image/webp;base64,a2Nw');
    expect(normalizeWorkspaceLogo('https://example.com/logo.png')).toBe('');
    expect(normalizeWorkspaceLogo('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
    expect(normalizeWorkspaceLogo(`data:image/png;base64,${'a'.repeat(450_001)}`)).toBe('');
  });
});
