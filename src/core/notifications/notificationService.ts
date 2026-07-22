import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, type PushNotificationSchema, type Token } from '@capacitor/push-notifications';
import { receiveDeepLink, type DeepLinkIntent } from '../navigation/deepLinks';
import { captureOperationalError } from '../monitoring/monitoring';
import { registerNotificationToken } from './notificationApi';

type Context={workspaceId:string;deviceId:string;onIntent:(intent:DeepLinkIntent)=>void};
let context:Context|null=null;let initialized=false;let currentToken='';
function appVersion(){return '0.20.0';}
async function sendToken(token:string){if(!context?.workspaceId||!context.deviceId||!token)return;await registerNotificationToken(context.workspaceId,{deviceId:context.deviceId,token,platform:Capacitor.getPlatform(),appVersion:appVersion()});currentToken=token;}
function open(value:unknown){receiveDeepLink(String(value||''));}
export async function initializeNotifications(next:Context){context=next;if(initialized){if(currentToken)await sendToken(currentToken).catch((error)=>captureOperationalError(error,{feature:'push_token_refresh'}));return;}initialized=true;
  App.addListener('appUrlOpen',({url})=>open(url));
  if(!Capacitor.isNativePlatform())return;
  PushNotifications.addListener('registration',(token:Token)=>void sendToken(token.value).catch((error)=>captureOperationalError(error,{feature:'push_token_register'})));
  PushNotifications.addListener('registrationError',(error)=>captureOperationalError(error,{feature:'push_registration'}));
  PushNotifications.addListener('pushNotificationReceived',(notification:PushNotificationSchema)=>window.dispatchEvent(new CustomEvent('kcp:push-received',{detail:{title:notification.title||'KCP Lite',body:notification.body||'New operational alert',deepLink:notification.data?.deepLink||notification.data?.url||''}})));
  PushNotifications.addListener('pushNotificationActionPerformed',(action)=>open(action.notification.data?.deepLink||action.notification.data?.url));
  const permission=await PushNotifications.checkPermissions();if(permission.receive==='granted')await PushNotifications.register();
}
export async function enableNotifications(){if(!Capacitor.isNativePlatform())return 'unsupported' as const;const current=await PushNotifications.checkPermissions();const permission=current.receive==='prompt'||current.receive==='prompt-with-rationale'?await PushNotifications.requestPermissions():current;if(permission.receive!=='granted')return 'denied' as const;await PushNotifications.register();return 'granted' as const;}
export async function notificationPermission(){if(!Capacitor.isNativePlatform())return 'unsupported' as const;return (await PushNotifications.checkPermissions()).receive;}
