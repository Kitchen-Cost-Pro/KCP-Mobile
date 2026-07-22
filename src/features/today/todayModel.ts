import type { KcpAction } from '../flow/actionModel';
import type { RoleSet } from '../role-sets/roleSetModel';
import { sortActionsForRoleSet } from '../role-sets/roleSetModel';
import { rankAction } from './actionPriority';

export type TodayBuckets = {
  resume: KcpAction | null;
  now: KcpAction[];
  next: KcpAction[];
  waiting: KcpAction[];
  completed: KcpAction[];
};

const ACTIVE = new Set(['ready', 'in_progress']);

export function bucketTodayActions(actions: KcpAction[], roleSet: RoleSet, clock = new Date()): TodayBuckets {
  const sorted = sortActionsForRoleSet(actions, roleSet);
  const endOfDay = new Date(clock); endOfDay.setHours(23, 59, 59, 999);
  const recentCutoff = clock.getTime() - 48 * 60 * 60 * 1000;
  const active = sorted.filter((action) => ACTIVE.has(action.status));
  const resume = active.find((action) => action.status === 'in_progress') || null;
  const now = active.filter((action) => {
    if (action.id === resume?.id) return false;
    const due = new Date(action.dueAt).getTime();
    return action.priority === 'urgent' || action.isOverdue === true || (!Number.isNaN(due) && due <= clock.getTime());
  });
  const nowIds = new Set(now.map((action) => action.id));
  const next = active.filter((action) => {
    if (action.id === resume?.id || nowIds.has(action.id)) return false;
    const due = new Date(action.dueAt).getTime();
    return Number.isNaN(due) || due <= endOfDay.getTime();
  });
  return {
    resume,
    now,
    next,
    waiting: sorted.filter((action) => action.status === 'waiting'),
    completed: sorted.filter((action) => action.status === 'completed' && new Date(action.completedAt || action.updatedAt).getTime() >= recentCutoff).slice(0, 5)
  };
}

export function actionWhy(action: KcpAction) {
  if (action.routing?.explanation) return action.routing.explanation;
  if (action.whyItMatters) return action.whyItMatters;
  if (action.escalation?.isEscalated) return action.escalation.reason || 'This needs attention before it blocks the shift.';
  const explanations: Record<string, string> = {
    expected_delivery: 'Receiving on time keeps stock and supplier balances accurate.',
    receiving: 'Completing this updates received stock from the approved purchase order.',
    stock_count: 'An accurate count protects ordering, food cost and availability.',
    recount: 'The variance must be confirmed before the count can be finalised.',
    transfer: 'The sending location is waiting for confirmation of stock received.',
    manufacturing: 'Production must be recorded before finished stock is available.',
    low_stock: 'Early intervention reduces the risk of a service stockout.',
    approval: 'The protected operation cannot continue until a decision is recorded.',
    barcode_exception: 'Resolving the barcode prevents repeated catalogue interruptions.',
    wastage_exception: 'Review protects stock accuracy and makes the loss accountable.'
  };
  return explanations[action.actionType] || action.description || 'Completing this keeps today’s operation moving.';
}

export function dueLabel(value: string, clock = new Date()) {
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return 'No due time';
  const time = new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit' }).format(due);
  const sameDay = due.toDateString() === clock.toDateString();
  if (sameDay) return `Due ${time}`;
  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(due);
}
