import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { AppRoute } from '../types/kcp';
import { refreshSessionForForeground } from '../core/api/client';

export function useNativeLifecycle(
  route: AppRoute,
  onRoute: (route: AppRoute) => void,
  onForeground: () => void
) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handles = [
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void refreshSessionForForeground().then(()=>onForeground()).catch(()=>onForeground());
      }),
      App.addListener('backButton', ({ canGoBack }) => {
        if (route !== 'home') {
          onRoute('home');
          return;
        }
        if (canGoBack) window.history.back();
        else App.exitApp();
      })
    ];
    return () => { handles.forEach((promise) => promise.then((handle) => handle.remove())); };
  }, [onForeground, onRoute, route]);
}
