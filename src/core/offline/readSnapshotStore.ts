import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { Capacitor } from '@capacitor/core';
import { isSnapshotFresh } from './snapshotCache';
const key=(feature:string,workspaceId:string,userId:string,scope:string)=>`read-snapshot-v1-${feature}-${workspaceId}-${userId}-${scope||'all'}`;
type Wrapped<T>={__snap:1;t:number;v:T};
function unwrap<T>(value:unknown):T|null{if(!value||typeof value!=='object')return null;const wrapped=value as Partial<Wrapped<T>>;if(wrapped.__snap!==1||!isSnapshotFresh(wrapped.t??null))return null;return (wrapped.v as T)??null;}
export const readSnapshotStore={
  async get<T>(feature:string,workspaceId:string,userId:string,scope='all'):Promise<T|null>{try{const id=key(feature,workspaceId,userId,scope);if(Capacitor.isNativePlatform())return unwrap<T>(await SecureStorage.get(id));const raw=sessionStorage.getItem(id);return raw?unwrap<T>(JSON.parse(raw)):null;}catch{return null;}},
  async set<T>(feature:string,workspaceId:string,userId:string,scope:string,value:T){try{const id=key(feature,workspaceId,userId,scope);const wrapped:Wrapped<T>={__snap:1,t:Date.now(),v:value};if(Capacitor.isNativePlatform()){await SecureStorage.set(id,wrapped as never,false,false,KeychainAccess.whenUnlockedThisDeviceOnly);return;}sessionStorage.setItem(id,JSON.stringify(wrapped));}catch{/* optional read-only snapshot */}}
};
