import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
const key=(feature:string,workspaceId:string,userId:string,scope:string)=>`read-snapshot-v1-${feature}-${workspaceId}-${userId}-${scope||'all'}`;
export const readSnapshotStore={
  async get<T>(feature:string,workspaceId:string,userId:string,scope='all'):Promise<T|null>{try{const id=key(feature,workspaceId,userId,scope);if(Capacitor.isNativePlatform())return (await SecureStorage.get(id) as T)||null;const raw=sessionStorage.getItem(id);return raw?JSON.parse(raw) as T:null;}catch{return null;}},
  async set<T>(feature:string,workspaceId:string,userId:string,scope:string,value:T){try{const id=key(feature,workspaceId,userId,scope);if(Capacitor.isNativePlatform()){await SecureStorage.set(id,value as never,false,false,KeychainAccess.whenUnlockedThisDeviceOnly);return;}sessionStorage.setItem(id,JSON.stringify(value));}catch{/* optional read-only snapshot */}}
};
