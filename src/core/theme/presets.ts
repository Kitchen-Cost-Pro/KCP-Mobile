import type { WorkspaceTheme } from '../../types/kcp';

type ThemePreset = WorkspaceTheme & { label: string };

export const THEME_PRESETS: Record<string, ThemePreset> = {
  'kcp-classic': preset('kcp-classic', 'Kitchen Pass', 'kcp-classic', '/backgrounds/kitchen-pass.png', '#2563eb', '#38bdf8'),
  'chef-pass': preset('chef-pass', 'Chef Station', 'chef-pass', '/backgrounds/chef-station.png', '#0284c7', '#2dd4bf'),
  'espresso-bar': preset('espresso-bar', 'Coffee Bar', 'espresso-bar', '/backgrounds/coffee-bar.png', '#0ea5e9', '#f59e0b'),
  'wine-cellar': preset('wine-cellar', 'Wine Room', 'wine-cellar', '/backgrounds/wine-room.png', '#9333ea', '#fb7185'),
  'market-garden': preset('market-garden', 'Market Prep', 'market-garden', '/backgrounds/market-prep.png', '#16a34a', '#84cc16'),
  'bakery-case': preset('bakery-case', 'Bakery Counter', 'bakery-case', '/backgrounds/bakery-counter.png', '#d97706', '#38bdf8'),
  'ocean-bistro': preset('ocean-bistro', 'Ocean Bistro', 'ocean-bistro', '/backgrounds/ocean-bistro.svg', '#0284c7', '#2dd4bf'),
  'basic-green': preset('basic-green', 'Basic Green', 'basic-green', '/backgrounds/basic-green.svg', '#16a34a', '#4ade80'),
  'basic-purple': preset('basic-purple', 'Basic Purple', 'basic-purple', '/backgrounds/basic-purple.svg', '#7c3aed', '#a78bfa')
};

function preset(
  id: string,
  label: string,
  backgroundId: string,
  backgroundImage: string,
  accent: string,
  accentSecondary: string
): ThemePreset {
  return { id, label, backgroundId, backgroundImage, backgroundPosition: 'center', accent, accentSecondary };
}

export function resolveWorkspaceTheme(settings: Record<string, unknown>): WorkspaceTheme {
  const themeId = String(settings.restaurantThemeId || settings.themePreset || 'kcp-classic');
  const backgroundId = String(settings.restaurantBackgroundId || settings.backgroundPreset || themeId || 'kcp-classic');
  const theme = THEME_PRESETS[themeId] || THEME_PRESETS['kcp-classic'];
  const background = THEME_PRESETS[backgroundId] || theme;
  const customBackground = String(
    settings.restaurantBackgroundDataUrl || settings.backgroundDataUrl || settings.customerBackgroundDataUrl || ''
  ).trim();
  const logoDataUrl = normalizeWorkspaceLogo(
    settings.restaurantLogoDataUrl || settings.logoDataUrl || settings.customerLogoDataUrl || ''
  );
  return {
    ...theme,
    backgroundId,
    backgroundImage: background.backgroundImage,
    backgroundPosition: background.backgroundPosition,
    customBackground: customBackground.startsWith('data:image/') ? customBackground : '',
    logoDataUrl
  };
}

export function normalizeWorkspaceLogo(value: unknown): string {
  const logo = String(value || '').trim();
  if (!/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,/i.test(logo)) return '';
  return logo.length <= 450_000 ? logo : '';
}

export function applyWorkspaceTheme(theme: WorkspaceTheme) {
  const root = document.documentElement;
  root.style.setProperty('--kcp-accent', theme.accent);
  root.style.setProperty('--kcp-accent-secondary', theme.accentSecondary);
  root.style.setProperty('--kcp-workspace-background', `url("${theme.customBackground || theme.backgroundImage}")`);
  root.style.setProperty('--kcp-workspace-background-position', theme.backgroundPosition || 'center');
  root.dataset.workspaceTheme = theme.id;
}
