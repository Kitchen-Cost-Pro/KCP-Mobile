import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './core/auth/AuthProvider';
import { App } from './app/App';
import './styles.css';
import { initializeMonitoring } from './core/monitoring/monitoring';
import { initializeLiveUpdates } from './core/updates/liveUpdates';

initializeMonitoring();
void initializeLiveUpdates();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
