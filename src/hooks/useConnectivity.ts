import { useEffect, useState } from 'react';
import { Network } from '@capacitor/network';

export function useConnectivity() {
  const [connected, setConnected] = useState(() => navigator.onLine);

  useEffect(() => {
    let active = true;
    let remove: (() => Promise<void>) | null = null;
    Network.getStatus().then((status) => active && setConnected(status.connected)).catch(() => undefined);
    Network.addListener('networkStatusChange', (status) => setConnected(status.connected))
      .then((handle) => { remove = () => handle.remove(); })
      .catch(() => undefined);
    const online = () => setConnected(true);
    const offline = () => setConnected(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      active = false;
      remove?.();
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }, []);

  return connected;
}
