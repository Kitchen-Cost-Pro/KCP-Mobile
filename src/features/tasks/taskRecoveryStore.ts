import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import { normalizeAction, type ActionProgress, type KcpAction } from '../flow/actionModel';

export type TaskRecovery = { workspaceId: string; userId: string; task: KcpAction; progress: ActionProgress; updatedAt: string };
const PREFIX = 'task-recovery-v1-';
let initialized: Promise<void> | null = null;
async function initialize() { initialized ||= (async () => { await SecureStorage.setKeyPrefix('kcp-mobile_'); await SecureStorage.setSynchronize(false); await SecureStorage.setDefaultKeychainAccess(KeychainAccess.whenUnlockedThisDeviceOnly); })(); return initialized; }
function key(workspaceId: string, userId: string) { return `${PREFIX}${workspaceId.trim()}-${userId.trim()}`; }
function valid(value: unknown): value is TaskRecovery { const item = value as Partial<TaskRecovery> | null; return Boolean(item && item.workspaceId && item.userId && item.task?.id && item.progress); }
export const taskRecoveryStore = {
  async get(workspaceId: string, userId: string): Promise<TaskRecovery | null> { try { let value: unknown; if (Capacitor.isNativePlatform()) { await initialize(); value = await SecureStorage.get(key(workspaceId, userId)); } else { const raw = window.sessionStorage.getItem(key(workspaceId, userId)); value = raw ? JSON.parse(raw) : null; } return valid(value) && value.workspaceId === workspaceId && value.userId === userId ? { ...value, task: normalizeAction(value.task, workspaceId) } : null; } catch { return null; } },
  async set(value: TaskRecovery) { if (Capacitor.isNativePlatform()) { await initialize(); await SecureStorage.set(key(value.workspaceId, value.userId), value, false, false, KeychainAccess.whenUnlockedThisDeviceOnly); } else window.sessionStorage.setItem(key(value.workspaceId, value.userId), JSON.stringify(value)); },
  async clear(workspaceId: string, userId: string) { try { if (Capacitor.isNativePlatform()) { await initialize(); await SecureStorage.remove(key(workspaceId, userId), false); } else window.sessionStorage.removeItem(key(workspaceId, userId)); } catch { /* authoritative completion wins */ } }
};
