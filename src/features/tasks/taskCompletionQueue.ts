import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import type { ActionProgress } from '../flow/actionModel';
export type QueuedTaskCompletion={id:string;workspaceId:string;userId:string;taskId:string;progress:ActionProgress;queuedAt:string};
const key=(workspaceId:string,userId:string)=>`task-completion-queue-v1-${workspaceId}-${userId}`;
async function read(workspaceId:string,userId:string):Promise<QueuedTaskCompletion[]>{try{if(Capacitor.isNativePlatform())return (await SecureStorage.get(key(workspaceId,userId)) as QueuedTaskCompletion[])||[];const raw=sessionStorage.getItem(key(workspaceId,userId));return raw?JSON.parse(raw):[];}catch{return[];}}
async function write(workspaceId:string,userId:string,items:QueuedTaskCompletion[]){if(Capacitor.isNativePlatform()){await SecureStorage.set(key(workspaceId,userId),items,false,false,KeychainAccess.whenUnlockedThisDeviceOnly);return;}sessionStorage.setItem(key(workspaceId,userId),JSON.stringify(items));}
export const taskCompletionQueue={
  list:read,
  async enqueue(item:Omit<QueuedTaskCompletion,'id'|'queuedAt'>){const items=await read(item.workspaceId,item.userId);const entry={...item,id:`${item.workspaceId}:${item.taskId}`,queuedAt:new Date().toISOString()};await write(item.workspaceId,item.userId,[...items.filter((queued)=>queued.taskId!==item.taskId),entry]);return entry;},
  async remove(workspaceId:string,userId:string,id:string){await write(workspaceId,userId,(await read(workspaceId,userId)).filter((item)=>item.id!==id));}
};
