import type { KcpAction } from '../flow/actionModel';
import type { RoleSet } from '../role-sets/roleSetModel';

export type ActionRank = { score: number; explanation: string; reasons: string[] };

const priorityWeight: Record<KcpAction['priority'], number> = { low: 5, normal: 20, high: 40, urgent: 60 };
const riskWeight: Record<string, number> = { low: 0, normal: 8, high: 18, critical: 30 };

/** Deterministic KCP rules. AI may add recommendations later, never replace these. */
export function rankAction(action: KcpAction, roleSet: Pick<RoleSet, 'id' | 'preferredActionTypes' | 'priorityOrder'>, clock = new Date()): ActionRank {
  const reasons: string[] = [];
  const due = new Date(action.dueAt).getTime();
  const minutesLate = Number.isFinite(due) ? Math.floor((clock.getTime() - due) / 60_000) : 0;
  let score = priorityWeight[action.priority] || 0;
  if (minutesLate > 0) { score += 100 + Math.min(60, Math.floor(minutesLate / 10)); reasons.push('it is overdue'); }
  else if (Number.isFinite(due) && due - clock.getTime() <= 60 * 60_000) { score += 35; reasons.push('it is due within the hour'); }
  if (action.assignment.type === 'role_set' && action.assignment.id === roleSet.id) { score += 24; reasons.push('it is assigned to your Role Set'); }
  else if (action.assignment.type === 'user') { score += 28; reasons.push('it is assigned to you'); }
  if (roleSet.preferredActionTypes.map(key).includes(key(action.actionType))) { score += 15; reasons.push('it matches your operational role'); }
  const impact = Number(action.financialImpact?.amount || 0);
  if (impact > 0) { score += Math.min(25, Math.ceil(Math.log10(impact + 1) * 5)); reasons.push('it has financial impact'); }
  const risk = action.routing?.operationalRisk || (action.escalation?.isEscalated ? 'high' : 'normal');
  if ((riskWeight[risk] || 0) > 0) { score += riskWeight[risk] || 0; reasons.push(`${risk} operational risk`); }
  if (Number(action.routing?.locationUrgency || 0) > 0) { score += Math.min(20, Number(action.routing?.locationUrgency)); reasons.push('the location is urgent'); }
  if ((action.routing?.blockingActionIds || []).length) { score += 40; reasons.push('it is blocking today’s work'); }
  if (action.routing?.approvalStatus === 'rejected') { score += 35; reasons.push('rejected work needs resubmission'); }
  if (action.routing?.approvalStatus === 'pending') { score -= 50; }
  if (action.status === 'in_progress') score += 55;
  if (action.status === 'waiting' || action.status === 'deferred') score -= 75;
  if (action.status === 'completed' || action.status === 'cancelled') score = -1000;
  const explanation = action.routing?.explanation?.trim() || (reasons.length ? `Shown first because ${joinReasons(reasons)}.` : 'Shown based on your due time and KCP operational priority.');
  return { score, explanation, reasons };
}

export function rankActions(actions: KcpAction[], roleSet: Pick<RoleSet, 'id' | 'preferredActionTypes' | 'priorityOrder'>, clock = new Date()) {
  const priorityIndex = new Map(roleSet.priorityOrder.map((priority, index) => [priority, index]));
  return [...actions].sort((left, right) => {
    const score = rankAction(right, roleSet, clock).score - rankAction(left, roleSet, clock).score;
    if (score) return score;
    const priority = (priorityIndex.get(left.priority) ?? 99) - (priorityIndex.get(right.priority) ?? 99);
    if (priority) return priority;
    return new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime();
  });
}

function joinReasons(items: string[]) { return items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`; }
function key(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
