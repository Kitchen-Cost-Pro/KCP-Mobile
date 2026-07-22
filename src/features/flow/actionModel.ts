export const ACTION_STATUSES = ['upcoming', 'ready', 'in_progress', 'waiting', 'completed', 'deferred', 'cancelled'] as const;

export type ActionStatus = typeof ACTION_STATUSES[number];
export type ActionPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ActionAssignment = {
  type: 'user' | 'role_set' | 'location';
  id: string;
  label: string;
};
export type ActionSourceRecord = { type: string; id: string };
export type ActionFinancialImpact = { amount: number; currency: string } | null;
export type ActionRouting = {
  score?: number;
  explanation?: string;
  operationalRisk?: 'low' | 'normal' | 'high' | 'critical';
  locationUrgency?: number;
  confidence?: number;
  estimatedMinutes?: number | null;
  blockingActionIds?: string[];
  approvalStatus?: 'not_required' | 'pending' | 'approved' | 'rejected';
  assignmentReason?: string;
};
export type ActionStep = { id: string; label: string; required: boolean; completed: boolean; completedAt?: string; note?: string };
export type ActionEvidence = { id: string; stepId?: string | null; fileName: string; mimeType: string; byteSize: number; createdAt: string; createdByName?: string };
export type ActionActivity = { id: string; eventType: string; actorName: string; occurredAt: string; detail?: string };

/**
 * Shared KCP Flow contract. Legacy Phase 14 rows are projected into this model
 * by the Worker; no stock or ledger mutation is performed by KCP Flow.
 */
export type KcpAction = {
  id: string;
  workspaceId: string;
  location: { id: string; name: string } | null;
  actionType: string;
  sourceRecord: ActionSourceRecord;
  assignment: ActionAssignment;
  title: string;
  description?: string;
  contextLine?: string;
  whyItMatters?: string;
  priority: ActionPriority;
  dueAt: string;
  status: ActionStatus;
  progress: { completed: number; total: number; percent: number };
  requiredPermission: string;
  financialImpact: ActionFinancialImpact;
  deepLink: string;
  steps: ActionStep[];
  notes: string;
  evidence: ActionEvidence[];
  activityHistory?: ActionActivity[];
  revision: number;
  completedAt?: string;
  completedByName?: string;
  updatedAt: string;
  routineId?: string;
  isOverdue?: boolean;
  escalation?: { isEscalated: boolean; reason?: string; escalatedAt?: string };
  routing?: ActionRouting;
};

export type ActionCounts = Record<ActionStatus, number>;
export type ActionsResponse = { ok: boolean; generatedAt: string; locationId: string; counts: ActionCounts; actions: KcpAction[] };
export type OperationsControlView = 'all' | 'location' | 'role_set' | 'user' | 'overdue' | 'waiting' | 'blocked' | 'completed' | 'high_impact' | 'unassigned';
export type OperationsMetrics = {
  completionRate: number; averageCompletionMinutes: number | null; overdueRate: number;
  approvalTurnaroundMinutes: number | null; deferredActions: number; rejectedSubmissions: number;
  financialImpactResolved: number; currency: string; locationReadiness: Array<{ locationId: string; locationName: string; readiness: number; openActions: number; overdueActions: number }>;
  workload: Array<{ key: string; label: string; kind: 'user' | 'role_set'; openActions: number; overdueActions: number }>;
};
export type OperationsControlResponse = { ok: boolean; generatedAt: string; actions: KcpAction[]; metrics: OperationsMetrics; filters: { view: OperationsControlView; locationId?: string } };
export type ActionProgress = {
  revision: number;
  notes: string;
  steps: Array<{ id: string; completed: boolean; note?: string }>;
  evidence?: Array<{ clientId: string; stepId?: string | null; fileName: string; mimeType: string; dataUrl: string }>;
};

export function actionStatusLabel(status: ActionStatus) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeAction(value: unknown, workspaceId = ''): KcpAction {
  const item = (value && typeof value === 'object' ? value : {}) as Record<string, any>;
  const steps = Array.isArray(item.steps) ? item.steps : [];
  const completed = steps.filter((step: Record<string, unknown>) => step.completed === true).length;
  const total = steps.length;
  const legacyStatus = String(item.status || '').toLowerCase();
  const legacyBucket = String(item.bucket || '').toLowerCase();
  const status: ActionStatus = ACTION_STATUSES.includes(legacyStatus as ActionStatus)
    ? legacyStatus as ActionStatus
    : legacyStatus === 'completed' || legacyBucket === 'completed' ? 'completed'
      : completed > 0 ? 'in_progress'
        : legacyBucket === 'open' ? 'upcoming' : 'ready';
  const assignmentType = String(item.assignment?.type || 'location');
  return {
    ...item,
    workspaceId: String(item.workspaceId || workspaceId),
    actionType: String(item.actionType || 'routine_checklist'),
    sourceRecord: item.sourceRecord || { type: 'routine', id: String(item.templateId || item.routineId || '') },
    assignment: { ...item.assignment, type: assignmentType === 'role' ? 'role_set' : assignmentType },
    status,
    progress: item.progress || { completed, total, percent: total ? Math.round(completed * 100 / total) : 0 },
    requiredPermission: String(item.requiredPermission || 'nav-tasks'),
    financialImpact: item.financialImpact ?? null,
    deepLink: String(item.deepLink || ''),
    steps,
    notes: String(item.notes || ''),
    contextLine: String(item.contextLine || item.context_line || ''),
    whyItMatters: String(item.whyItMatters || item.why_it_matters || ''),
    evidence: Array.isArray(item.evidence) ? item.evidence : [],
    revision: Number(item.revision || 1),
    updatedAt: String(item.updatedAt || new Date(0).toISOString()),
    routineId: String(item.routineId || item.templateId || '') || undefined,
    isOverdue: item.isOverdue === true || legacyBucket === 'overdue',
    routing: item.routing && typeof item.routing === 'object' ? item.routing : {
      score: Number(item.priorityScore || 0) || undefined,
      explanation: String(item.priorityExplanation || item.routingExplanation || ''),
      operationalRisk: item.operationalRisk,
      locationUrgency: Number(item.locationUrgency || 0) || 0,
      confidence: item.confidence == null ? undefined : Number(item.confidence),
      estimatedMinutes: item.estimatedMinutes == null ? null : Number(item.estimatedMinutes),
      blockingActionIds: Array.isArray(item.blockingActionIds) ? item.blockingActionIds.map(String) : [],
      approvalStatus: item.approvalStatus,
      assignmentReason: String(item.assignmentReason || '')
    }
  } as KcpAction;
}
