import { apiRequest } from '../../core/api/client';
import type { ActionActivity, ActionProgress, ActionsResponse, KcpAction, OperationsControlResponse, OperationsControlView } from './actionModel';

function base(workspaceId: string) { return `api/mobile/v1/workspaces/${encodeURIComponent(workspaceId.trim())}/actions`; }

export function loadActions(workspaceId: string, locationId: string, signal?: AbortSignal) {
  return apiRequest<ActionsResponse>(base(workspaceId), { query: { locationId }, signal });
}

export function loadAction(workspaceId: string, actionId: string) {
  return apiRequest<{ ok: boolean; action: KcpAction; history: ActionActivity[] }>(`${base(workspaceId)}/${encodeURIComponent(actionId)}`);
}

export function saveActionProgress(workspaceId: string, actionId: string, progress: ActionProgress) {
  return apiRequest<{ ok: boolean; action: KcpAction }>(`${base(workspaceId)}/${encodeURIComponent(actionId)}/progress`, { method: 'PUT', payload: progress, timeoutMs: 60_000 });
}

export function completeAction(workspaceId: string, actionId: string, progress: ActionProgress) {
  return apiRequest<{ ok: boolean; duplicate: boolean; action: KcpAction }>(`${base(workspaceId)}/${encodeURIComponent(actionId)}/complete`, { method: 'POST', payload: { ...progress, confirm: true }, timeoutMs: 60_000 });
}

export function deferAction(workspaceId: string, actionId: string, revision: number, reason = '') {
  return apiRequest<{ ok: boolean; action: KcpAction }>(`${base(workspaceId)}/${encodeURIComponent(actionId)}/defer`, { method: 'POST', payload: { revision, reason }, timeoutMs: 60_000 });
}

export function loadOperationsControl(workspaceId: string, view: OperationsControlView = 'all', locationId = '') {
  return apiRequest<OperationsControlResponse>(`${base(workspaceId)}/manager/control`, { query: { view, ...(locationId ? { locationId } : {}) } });
}

export function manageAction(workspaceId: string, actionId: string, operation: 'reassign' | 'escalate' | 'defer' | 'priority' | 'resolve_blocker', payload: Record<string, unknown>) {
  return apiRequest<{ ok: boolean; action: KcpAction }>(`${base(workspaceId)}/manager/actions/${encodeURIComponent(actionId)}/${operation}`, { method: 'POST', payload, timeoutMs: 60_000 });
}

export type ActionLifecycleEvent = 'start' | 'waiting' | 'complete' | 'reject' | 'cancel';
export function recordActionLifecycle(workspaceId: string, actionId: string, event: ActionLifecycleEvent, detail = '') {
  return apiRequest<{ ok: boolean; duplicate: boolean; action: KcpAction }>(`${base(workspaceId)}/${encodeURIComponent(actionId)}/source-event`, { method: 'POST', payload: { event, detail: detail.trim() }, timeoutMs: 60_000 });
}
