import type { AppRoute } from '../../types/kcp';

export type QuickAccessRoute = Exclude<AppRoute, 'home' | 'more'>;

export const QUICK_ACCESS_LIMIT = 3;

export function reconcileQuickAccess(
  saved: readonly string[],
  available: readonly QuickAccessRoute[],
  limit = QUICK_ACCESS_LIMIT
): QuickAccessRoute[] {
  const allowed = new Set<QuickAccessRoute>(available);
  const selected: QuickAccessRoute[] = [];

  for (const route of saved) {
    if (!allowed.has(route as QuickAccessRoute) || selected.includes(route as QuickAccessRoute)) continue;
    selected.push(route as QuickAccessRoute);
    if (selected.length === limit) return selected;
  }

  for (const route of available) {
    if (!selected.includes(route)) selected.push(route);
    if (selected.length === limit) break;
  }

  return selected;
}

export function toggleQuickAccess(
  selected: readonly QuickAccessRoute[],
  route: QuickAccessRoute,
  limit = QUICK_ACCESS_LIMIT
): QuickAccessRoute[] {
  if (selected.includes(route)) return [...selected];
  if (selected.length >= limit) return [...selected.slice(1), route];
  return [...selected, route];
}

export function parseQuickAccess(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
