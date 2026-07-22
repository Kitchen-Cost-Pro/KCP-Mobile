import { apiRequest } from '../../core/api/client';

export type ApprovalOperationType = 'stock_take_variance'|'high_value_wastage'|'large_transfer'|'purchase_order'|'manual_stock_adjustment'|'manufacturing_exception';
export type ApprovalStatus = 'submitted'|'approved'|'rejected'|'executing'|'executed';
export type ApprovalLevel = { level: number; label: string; approvalsRequired: number; approvalsReceived: number; roles: string[]; maxValue: number|null; state: 'pending'|'active'|'approved'|'rejected' };
export type ApprovalHistoryEvent = { id:string; eventType:string; actorName:string; reason:string; level:number; occurredAt:string };
export type ApprovalRequest = {
  id:string; operationType:ApprovalOperationType; title:string; summary:string; status:ApprovalStatus; bucket:'submitted'|'approved'|'rejected';
  creator:{uid:string;name:string}; location:{id:string;name:string}|null; amount:number|null; currency:string; submittedAt:string; updatedAt:string;
  currentLevel:number; totalLevels:number; canDecide:boolean; selfApprovalBlocked:boolean; detail:Record<string,unknown>; levels:ApprovalLevel[];
};
export type ApprovalDashboard = { ok:boolean; generatedAt:string; counts:{submitted:number;approved:number;rejected:number}; requests:ApprovalRequest[] };
export type ApprovalDecisionResult = { ok:boolean; request:ApprovalRequest; history:ApprovalHistoryEvent[]; execution?:{resource:string;method:string} };
const base=(workspaceId:string)=>`api/mobile/v1/workspaces/${encodeURIComponent(workspaceId.trim())}/approvals`;
export function loadApprovals(workspaceId:string,locationId:string,signal?:AbortSignal){return apiRequest<ApprovalDashboard>(base(workspaceId),{query:{locationId},signal});}
export function loadApproval(workspaceId:string,requestId:string){return apiRequest<{ok:boolean;request:ApprovalRequest;history:ApprovalHistoryEvent[]}>(`${base(workspaceId)}/${encodeURIComponent(requestId)}`);}
export function decideApproval(workspaceId:string,requestId:string,decision:'approve'|'reject',reason:string){return apiRequest<ApprovalDecisionResult>(`${base(workspaceId)}/${encodeURIComponent(requestId)}/decision`,{method:'POST',payload:{decision,reason:reason.trim(),confirm:true}});}
