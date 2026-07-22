export type ApprovalPending = {
  ok: true;
  approvalRequired: true;
  locked: true;
  requestId: string;
  status: 'submitted';
  message: string;
};

export function isApprovalPending(value: unknown): value is ApprovalPending {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ApprovalPending>;
  return candidate.approvalRequired === true && candidate.locked === true && typeof candidate.requestId === 'string';
}
