import { Capacitor } from '@capacitor/core';
import { apiRequest } from '../api/client';
import { sessionStore } from '../session/sessionStore';
import type { AuthUser, KcpSession, UserProfile } from '../../types/kcp';

type MeResponse = {
  ok: boolean;
  user: AuthUser;
  profile: UserProfile;
};

type LoginResponse = {
  ok: boolean;
  accessToken: string;
  accessExpiresAt?: string;
  user: AuthUser;
  mustChangePassword?: boolean;
};

type DeviceRegistrationResponse = {
  ok: boolean;
  device: { id: string; deviceName: string; platform: string };
  refreshToken: string;
  refreshExpiresAt?: string;
};

function normalizeUser(user: Partial<AuthUser> = {}): AuthUser {
  const uid = String(user.uid || user.id || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  return {
    uid,
    id: String(user.id || uid),
    email,
    displayName: String(user.displayName || email.split('@')[0] || 'Workspace User'),
    providerData: Array.isArray(user.providerData) ? user.providerData : [{ providerId: 'cloudflare' }]
  };
}

export async function login(email: string, password: string): Promise<KcpSession> {
  const result = await apiRequest<LoginResponse>('api/mobile/v1/session/login', {
    method: 'POST',
    token: '',
    payload: {
      email: String(email || '').trim(),
      password
    }
  });
  const accessToken = String(result.accessToken || '');
  if (!accessToken) throw new Error('KCP returned an invalid mobile access session.');

  const platform = Capacitor.getPlatform();
  const deviceName = platform === 'ios'
    ? 'KCP Lite on iPhone'
    : platform === 'android'
      ? 'KCP Lite on Android'
      : 'KCP Lite browser preview';
  const registration = await apiRequest<DeviceRegistrationResponse>('api/mobile/v1/devices/register', {
    method: 'POST',
    token: accessToken,
    payload: {
      device: {
        deviceName,
        platform,
        platformVersion: String(navigator.platform || ''),
        deviceModel: String(navigator.userAgent || '').slice(0, 180),
        appVersion: '0.20.0'
      }
    }
  });

  const session: KcpSession = {
    token: accessToken,
    expiresAt: String(result.accessExpiresAt || ''),
    refreshToken: String(registration.refreshToken || ''),
    refreshExpiresAt: String(registration.refreshExpiresAt || ''),
    deviceId: String(registration.device?.id || ''),
    user: normalizeUser(result.user)
  };
  if (!session.refreshToken || !session.deviceId || !session.user.uid) {
    throw new Error('KCP could not register this mobile session.');
  }
  await sessionStore.set(session);
  return session;
}

export async function loadCurrentUser(): Promise<MeResponse> {
  const result = await apiRequest<MeResponse>('api/auth/me');
  return {
    ...result,
    user: normalizeUser(result.user),
    profile: result.profile || {}
  };
}

export async function loadInvitation(email: string) {
  const result = await apiRequest<{ invitation: null | { id: string; workspaceId?: string; wsId?: string } }>('api/auth/invitations', {
    query: { email: String(email || '').trim().toLowerCase() }
  });
  return result.invitation || null;
}

export async function claimInvitation(invitationId: string) {
  return apiRequest<{ claimed: boolean }>('api/auth/invitations/claim', {
    method: 'POST',
    payload: { invitationId }
  });
}

export async function changeForcedPassword(password: string) {
  return apiRequest<{ ok: boolean }>('api/auth/change-password', {
    method: 'POST',
    payload: { password }
  });
}

export async function requestPasswordReset(email: string) {
  const value = String(email || '').trim();
  const target = new URL('https://kcp-live.pages.dev');
  if (value) target.searchParams.set('email', value);
  window.open(target, '_blank', 'noopener,noreferrer');
  return { ok: true, message: 'Continue password recovery in the secure KCP web page.' };
}

export async function confirmPasswordReset(resetToken: string, password: string) {
  return apiRequest<{ ok: boolean; message?: string }>('api/auth/password-reset/confirm', {
    method: 'POST',
    token: '',
    payload: { resetToken, password }
  });
}

export async function logout() {
  try {
    await apiRequest('api/mobile/v1/session/logout', { method: 'POST' });
  } finally {
    await sessionStore.clear();
  }
}
