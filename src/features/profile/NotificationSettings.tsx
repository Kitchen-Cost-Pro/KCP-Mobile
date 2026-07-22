import { useEffect, useState } from 'react';
import { Bell, BellOff, ChevronRight, LoaderCircle, Smartphone, Trash2, X } from 'lucide-react';
import { DEFAULT_NOTIFICATION_PREFERENCES, loadNotificationSettings, revokeNotificationDevice, saveNotificationPreferences, type NotificationDevice, type NotificationPreferences } from '../../core/notifications/notificationApi';
import { enableNotifications, notificationPermission } from '../../core/notifications/notificationService';

const choices:Array<{key:keyof NotificationPreferences;label:string;detail:string}>=[
  {key:'taskAssigned',label:'Action assigned',detail:'New KCP Flow Actions assigned to you, your Role Set or location'},
  {key:'taskOverdue',label:'Action overdue',detail:'Assigned Actions that have passed their due time'},
  {key:'approvalRequested',label:'Approval requested',detail:'Protected exceptions awaiting your decision'},
  {key:'approvalCompleted',label:'Approval completed',detail:'Your submitted exception was approved or rejected'},
  {key:'lowStock',label:'Low stock',detail:'Location items reach their configured threshold'},
  {key:'incomingTransfer',label:'Incoming transfer',detail:'A transfer is ready for your location'},
  {key:'purchaseOrderDelivery',label:'PO delivery reminder',detail:'An open purchase order is due for delivery'}
];
export function NotificationSettings({workspaceId,deviceId,onCurrentRevoked}:{workspaceId:string;deviceId:string;onCurrentRevoked:()=>void}){
  const [open,setOpen]=useState(false);const [loaded,setLoaded]=useState(false);
  const [preferences,setPreferences]=useState(DEFAULT_NOTIFICATION_PREFERENCES);const [devices,setDevices]=useState<NotificationDevice[]>([]);const [permission,setPermission]=useState<string>('unknown');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  useEffect(()=>{void notificationPermission().then(setPermission).catch(()=>undefined);},[]);
  useEffect(()=>{if(!open||loaded)return;void Promise.all([loadNotificationSettings(workspaceId),notificationPermission()]).then(([result,state])=>{setPreferences({...DEFAULT_NOTIFICATION_PREFERENCES,...result.preferences});setDevices(result.devices.map((item)=>({...item,current:item.id===deviceId})));setPermission(state);setLoaded(true);}).catch(()=>setMessage('Notification settings are unavailable until KCP reconnects.'));},[open,loaded,deviceId,workspaceId]);
  async function enable(){setBusy(true);setMessage('');try{const result=await enableNotifications();setPermission(result);setMessage(result==='granted'?'Notifications enabled on this device.':result==='denied'?'Notifications are disabled in system settings.':'Push notifications require the installed Android or iOS app.');}finally{setBusy(false);}}
  async function toggle(key:keyof NotificationPreferences){const next={...preferences,[key]:!preferences[key]};setPreferences(next);setBusy(true);try{const result=await saveNotificationPreferences(workspaceId,next);setPreferences(result.preferences);setMessage('Notification preferences saved.');}catch{setPreferences(preferences);setMessage('Preferences could not be saved.');}finally{setBusy(false);}}
  async function revoke(id:string){if(id===deviceId&&!window.confirm('Revoke notifications and the mobile session for this device?'))return;setBusy(true);try{await revokeNotificationDevice(workspaceId,id);setDevices((items)=>items.filter((item)=>item.id!==id));setMessage('Device access and notification token revoked.');if(id===deviceId)onCurrentRevoked();}finally{setBusy(false);}}
  const activeCount=choices.filter((choice)=>preferences[choice.key]).length;
  return <>
    <section className="settings-group">
      <p className="settings-label">Notifications</p>
      <button className="settings-row" type="button" onClick={()=>setOpen(true)}>
        <span className="settings-icon">{permission==='granted'?<Bell size={19}/>:<BellOff size={19}/>}</span>
        <span><strong>Operational alerts</strong><small>{loaded?`${activeCount} of ${choices.length} active`:'Choose which notifications are active'}</small></span>
        <ChevronRight size={18}/>
      </button>
    </section>
    {open&&<div className="sheet-backdrop" role="presentation" onMouseDown={(event)=>event.target===event.currentTarget&&setOpen(false)}>
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <div className="sheet-handle"/>
        <header className="sheet-header">
          <div><p className="eyebrow">Notifications</p><h2 id="notification-title">Operational alerts</h2></div>
          <button className="icon-button" type="button" onClick={()=>setOpen(false)} aria-label="Close notifications"><X size={20}/></button>
        </header>
        <div className="notification-sheet-body">
          <span className={`notification-permission is-${permission}`}>{permission==='granted'?<Bell size={16}/>:<BellOff size={16}/>} {permission}</span>
          {message&&<div className="notification-message" role="status">{message}</div>}
          {permission!=='granted'&&<button className="button button-secondary" type="button" onClick={()=>void enable()} disabled={busy}>{busy?<LoaderCircle className="spin" size={17}/>:<Bell size={17}/>} Enable notifications</button>}
          <div className="notification-preferences">{choices.map((choice)=><label key={choice.key}><span><strong>{choice.label}</strong><small>{choice.detail}</small></span><input type="checkbox" checked={preferences[choice.key]} onChange={()=>void toggle(choice.key)} disabled={busy}/></label>)}</div>
          <h3 className="notification-devices-heading">Registered devices</h3>
          <div className="notification-devices">{devices.map((device)=><div key={device.id}><Smartphone size={18}/><span><strong>{device.deviceName||device.platform}</strong><small>{device.platform} · v{device.appVersion||'unknown'}{device.current?' · This device':''}</small></span><button className="icon-button" type="button" onClick={()=>void revoke(device.id)} disabled={busy} aria-label={`Revoke ${device.deviceName||device.platform}`}><Trash2 size={16}/></button></div>)}{!devices.length&&<div className="empty-inline">No devices are registered for notifications yet.</div>}</div>
        </div>
      </section>
    </div>}
  </>;
}
