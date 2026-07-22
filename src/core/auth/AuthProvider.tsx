import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import type { AuthState, WorkspaceOption } from '../../types/kcp';
import { sessionStore } from '../session/sessionStore';
import {
  changeForcedPassword,
  claimInvitation,
  confirmPasswordReset,
  loadCurrentUser,
  loadInvitation,
  login as loginRequest,
  logout as logoutRequest,
  requestPasswordReset
} from './authApi';
import {
  clearLastWorkspace,
  readLastWorkspace,
  resolveWorkspaceOptions,
  saveLastWorkspace
} from './workspaces';
import { loadWorkspaceBootstrap } from '../api/workspaceApi';
import { applyWorkspaceTheme, THEME_PRESETS } from '../theme/presets';

const defaultTheme = THEME_PRESETS['kcp-classic'];

const initialState: AuthState = {
  stage: 'booting',
  session: null,
  user: null,
  profile: null,
  workspaces: [],
  workspace: null,
  workspaceBootstrap: null,
  error: '',
  notice: '',
  busy: false,
  resetToken: new URLSearchParams(window.location.search).get('resetToken') || ''
};

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  confirmReset: (password: string) => Promise<void>;
  completeForcedPassword: (password: string) => Promise<void>;
  selectWorkspace: (workspace: WorkspaceOption) => Promise<void>;
  showWorkspacePicker: () => void;
  showLogin: () => void;
  showResetRequest: () => void;
  refreshWorkspace: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  clearMessage: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const mounted = useRef(true);
  const didBoot = useRef(false);

  const patchState = useCallback((patch: Partial<AuthState>) => {
    if (mounted.current) setState((current) => ({ ...current, ...patch }));
  }, []);

  const selectWorkspaceInternal = useCallback(async (
    workspace: WorkspaceOption,
    user = state.user,
    workspaces = state.workspaces
  ) => {
    if (!user) throw new Error('Your KCP session has expired.');
    patchState({ busy: true, error: '', notice: '', workspace, workspaceBootstrap: null });
    try {
      const workspaceBootstrap = await loadWorkspaceBootstrap(workspace.id, user);
      applyWorkspaceTheme(workspaceBootstrap.theme);
      saveLastWorkspace(user.uid, workspace.id);
      patchState({
        stage: 'ready',
        busy: false,
        workspace,
        workspaces,
        workspaceBootstrap,
        error: ''
      });
    } catch (error) {
      patchState({
        stage: workspaces.length ? 'workspace-select' : 'signed-out',
        busy: false,
        workspace: null,
        workspaceBootstrap: null,
        error: toMessage(error, 'Could not open this workspace.')
      });
    }
  }, [patchState, state.user, state.workspaces]);

  const hydrateAuthenticated = useCallback(async () => {
    patchState({ stage: 'booting', busy: true, error: '' });
    try {
      let current = await loadCurrentUser();
      const invitation = await loadInvitation(current.user.email).catch(() => null);
      if (invitation?.id) {
        await claimInvitation(invitation.id);
        current = await loadCurrentUser();
      }

      const session = await sessionStore.get();
      if (!session) throw new Error('Your secure session could not be restored.');
      const profile = current.profile || {};
      const workspaces = resolveWorkspaceOptions(profile);
      patchState({ session, user: current.user, profile, workspaces, busy: false });

      if (profile.mustChangePassword || profile.firstLoginRequired) {
        patchState({ stage: 'force-password', busy: false });
        return;
      }

      if (!workspaces.length) {
        patchState({
          stage: 'pending',
          busy: false,
          error: '',
          notice: profile.status === 'pending'
            ? `Your request for ${profile.requestedWorkspace?.siteName || 'this workspace'} is awaiting approval.`
            : 'Your account is active but is not assigned to an active workspace.'
        });
        return;
      }

      const lastId = readLastWorkspace(current.user.uid);
      const preferred = workspaces.find((workspace) => workspace.id === lastId);
      if (workspaces.length === 1 || preferred) {
        await selectWorkspaceInternal(preferred || workspaces[0], current.user, workspaces);
        return;
      }
      patchState({ stage: 'workspace-select', busy: false, error: '' });
    } catch (error) {
      await sessionStore.clear();
      patchState({
        ...initialState,
        resetToken: '',
        stage: 'signed-out',
        error: toMessage(error, 'Your session could not be restored.')
      });
    }
  }, [patchState, selectWorkspaceInternal]);

  useEffect(() => {
    mounted.current = true;
    if (!didBoot.current) {
      didBoot.current = true;
      applyWorkspaceTheme(defaultTheme);
      if (initialState.resetToken) {
        patchState({ stage: 'reset-confirm', busy: false });
      } else {
        sessionStore.get().then((session) => {
          if (!session) {
            patchState({ stage: 'signed-out', busy: false });
            return;
          }
          patchState({ session, user: session.user });
          hydrateAuthenticated();
        });
      }
    }
    return () => { mounted.current = false; };
    // Bootstrap once. StrictMode's second setup only restores the mounted flag.
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    patchState({ busy: true, error: '', notice: '' });
    try {
      const session = await loginRequest(email, password);
      patchState({ session, user: session.user });
      await hydrateAuthenticated();
    } catch (error) {
      patchState({ busy: false, stage: 'signed-out', error: toMessage(error, 'Could not sign in.') });
      throw error;
    }
  }, [hydrateAuthenticated, patchState]);

  const signOut = useCallback(async () => {
    patchState({ busy: true, error: '' });
    const userId = state.user?.uid || '';
    try {
      await logoutRequest();
    } catch {
      await sessionStore.clear();
    }
    if (userId) clearLastWorkspace(userId);
    applyWorkspaceTheme(defaultTheme);
    patchState({ ...initialState, resetToken: '', stage: 'signed-out', busy: false });
  }, [patchState, state.user?.uid]);

  const requestReset = useCallback(async (email: string) => {
    patchState({ busy: true, error: '', notice: '' });
    try {
      const result = await requestPasswordReset(email);
      patchState({
        stage: 'signed-out',
        busy: false,
        notice: result.message || 'If the account exists, a reset email has been sent.'
      });
    } catch (error) {
      patchState({ busy: false, error: toMessage(error, 'Could not request a password reset.') });
      throw error;
    }
  }, [patchState]);

  const confirmReset = useCallback(async (password: string) => {
    patchState({ busy: true, error: '' });
    try {
      const result = await confirmPasswordReset(state.resetToken, password);
      window.history.replaceState({}, document.title, window.location.pathname);
      patchState({
        ...initialState,
        resetToken: '',
        stage: 'signed-out',
        busy: false,
        notice: result.message || 'Password updated. Sign in with your new password.'
      });
    } catch (error) {
      patchState({ busy: false, error: toMessage(error, 'Could not update your password.') });
      throw error;
    }
  }, [patchState, state.resetToken]);

  const completeForcedPassword = useCallback(async (password: string) => {
    patchState({ busy: true, error: '' });
    try {
      await changeForcedPassword(password);
      await hydrateAuthenticated();
    } catch (error) {
      patchState({ busy: false, error: toMessage(error, 'Could not save your new password.') });
      throw error;
    }
  }, [hydrateAuthenticated, patchState]);

  const refreshWorkspace = useCallback(async () => {
    if (!state.workspace || !state.user) return;
    patchState({ busy: true, error: '' });
    try {
      const workspaceBootstrap = await loadWorkspaceBootstrap(state.workspace.id, state.user);
      applyWorkspaceTheme(workspaceBootstrap.theme);
      patchState({ workspaceBootstrap, busy: false, error: '' });
    } catch (error) {
      patchState({ busy: false, error: toMessage(error, 'Could not refresh workspace access.') });
    }
  }, [patchState, state.user, state.workspace]);

  const value = useMemo<AuthContextValue>(() => ({
    ...state,
    signIn,
    signOut,
    requestReset,
    confirmReset,
    completeForcedPassword,
    selectWorkspace: (workspace) => selectWorkspaceInternal(workspace),
    showWorkspacePicker: () => patchState({ stage: 'workspace-select', workspaceBootstrap: null, error: '' }),
    showLogin: () => patchState({ stage: 'signed-out', error: '', notice: '' }),
    showResetRequest: () => patchState({ stage: 'reset-request', error: '', notice: '' }),
    refreshWorkspace,
    refreshAccount: hydrateAuthenticated,
    clearMessage: () => patchState({ error: '', notice: '' })
  }), [
    completeForcedPassword, confirmReset, hydrateAuthenticated, patchState, refreshWorkspace, requestReset,
    selectWorkspaceInternal, signIn, signOut, state
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
