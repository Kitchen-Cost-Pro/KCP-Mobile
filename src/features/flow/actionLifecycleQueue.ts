import type { ActionLifecycleEvent } from './actionApi';

export type QueuedActionLifecycle = { id: string; actionId: string; event: ActionLifecycleEvent; detail: string; queuedAt: string };
function key(workspaceId: string, userId: string) { return `kcp-mobile:action-lifecycle:${workspaceId}:${userId}`; }
function read(workspaceId: string, userId: string): QueuedActionLifecycle[] { try { const value = JSON.parse(localStorage.getItem(key(workspaceId, userId)) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function write(workspaceId: string, userId: string, items: QueuedActionLifecycle[]) { try { if (items.length) localStorage.setItem(key(workspaceId, userId), JSON.stringify(items)); else localStorage.removeItem(key(workspaceId, userId)); } catch { /* server remains authoritative */ } }

export const actionLifecycleQueue = {
  list: read,
  add(workspaceId: string, userId: string, item: Omit<QueuedActionLifecycle, 'id' | 'queuedAt'>) {
    const items = read(workspaceId, userId); const id = `${item.actionId}:${item.event}`;
    if (!items.some((entry) => entry.id === id)) items.push({ ...item, id, queuedAt: new Date().toISOString() });
    write(workspaceId, userId, items);
  },
  remove(workspaceId: string, userId: string, id: string) { write(workspaceId, userId, read(workspaceId, userId).filter((item) => item.id !== id)); }
};
