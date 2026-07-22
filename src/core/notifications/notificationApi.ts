import { apiRequest } from '../api/client';

export type NotificationPreferences = { taskAssigned:boolean;taskOverdue:boolean;approvalRequested:boolean;approvalCompleted:boolean;lowStock:boolean;incomingTransfer:boolean;purchaseOrderDelivery:boolean };
export type NotificationDevice = { id:string;deviceName:string;platform:string;appVersion:string;active:boolean;lastSeenAt:string;current:boolean };
export const DEFAULT_NOTIFICATION_PREFERENCES:NotificationPreferences={taskAssigned:true,taskOverdue:true,approvalRequested:true,approvalCompleted:true,lowStock:true,incomingTransfer:true,purchaseOrderDelivery:true};
const base=(workspaceId:string)=>`api/mobile/v1/workspaces/${encodeURIComponent(workspaceId)}/notifications`;
export function loadNotificationSettings(workspaceId:string){return apiRequest<{ok:boolean;preferences:NotificationPreferences;devices:NotificationDevice[]}>(base(workspaceId));}
export function saveNotificationPreferences(workspaceId:string,preferences:NotificationPreferences){return apiRequest<{ok:boolean;preferences:NotificationPreferences}>(`${base(workspaceId)}/preferences`,{method:'PUT',payload:preferences});}
export function registerNotificationToken(workspaceId:string,payload:{deviceId:string;token:string;platform:string;appVersion:string}){return apiRequest<{ok:boolean}>(`${base(workspaceId)}/devices`,{method:'POST',payload});}
export function revokeNotificationDevice(workspaceId:string,deviceId:string){return apiRequest<{ok:boolean}>(`${base(workspaceId)}/devices/${encodeURIComponent(deviceId)}`,{method:'DELETE'});}
