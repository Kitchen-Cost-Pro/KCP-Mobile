import { useAuth } from '../core/auth/AuthProvider';
import { BootScreen } from '../features/auth/BootScreen';
import { LoginScreen } from '../features/auth/LoginScreen';
import { PasswordScreen } from '../features/auth/PasswordScreen';
import { ResetRequestScreen } from '../features/auth/ResetRequestScreen';
import { PendingScreen } from '../features/workspace/PendingScreen';
import { WorkspaceSelectScreen } from '../features/workspace/WorkspaceSelectScreen';
import { AppShell } from './AppShell';

export function App() {
  const auth = useAuth();
  if (auth.stage === 'booting') return <BootScreen />;
  if (auth.stage === 'reset-request') return <ResetRequestScreen />;
  if (auth.stage === 'reset-confirm') return <PasswordScreen mode="reset" />;
  if (auth.stage === 'force-password') return <PasswordScreen mode="forced" />;
  if (auth.stage === 'workspace-select') return <WorkspaceSelectScreen />;
  if (auth.stage === 'pending') return <PendingScreen />;
  if (auth.stage === 'ready' && auth.workspace && auth.workspaceBootstrap) return <AppShell />;
  return <LoginScreen />;
}
