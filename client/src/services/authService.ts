import { apiFetch, authStorage } from './api';

export const AUTH_ENDPOINTS = Object.freeze({
  login: '/auth/login',
  register: '/auth/register',
  verifyEmail: '/auth/verify-email',
  resendVerification: '/auth/resend-verification',
  forgotPassword: '/auth/forgot-password',
  resetPassword: '/auth/reset-password',
  refresh: '/auth/refresh',
  me: '/auth/me',
  logout: '/auth/logout',
});

export type Role = 'USER' | 'ADMIN';
export type AuthorStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface AuthProfile {
  bio?: string | null;
  avatar?: string | null;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  authorStatus: AuthorStatus;
  emailVerified: boolean;
  accountStatus: AccountStatus;
  status?: string;
  profile?: AuthProfile;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthTokensResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResponse {
  user: AuthUser;
  emailVerificationRequired: boolean;
  verificationExpiresAt?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
}

export async function loginUser(payload: LoginInput): Promise<AuthTokensResponse> {
  const data = await apiFetch<AuthTokensResponse>(AUTH_ENDPOINTS.login, {method: 'POST', body: JSON.stringify(payload)});
  authStorage.setTokens({accessToken: data.accessToken, refreshToken: data.refreshToken});
  return data;
}

export async function registerUser(payload: RegisterInput): Promise<RegisterResponse> {
  return apiFetch<RegisterResponse>(AUTH_ENDPOINTS.register, {method: 'POST', body: JSON.stringify(payload)});
}

export async function verifyEmail(email: string, otp: string): Promise<{user: AuthUser}> {
  return apiFetch<{user: AuthUser}>(AUTH_ENDPOINTS.verifyEmail, {method: 'POST', body: JSON.stringify({email, otp})});
}

export async function resendVerification(email: string) {
  return apiFetch<{sent: boolean; expiresAt?: string}>(AUTH_ENDPOINTS.resendVerification, {method: 'POST', body: JSON.stringify({email})});
}

export async function forgotPassword(email: string) {
  return apiFetch<{sent: boolean}>(AUTH_ENDPOINTS.forgotPassword, {method: 'POST', body: JSON.stringify({email})});
}

export async function resetPassword(payload: {email: string; otp: string; password: string}) {
  return apiFetch<{reset: boolean}>(AUTH_ENDPOINTS.resetPassword, {method: 'POST', body: JSON.stringify(payload)});
}

export async function refreshSession(): Promise<string | null> {
  const refreshToken = authStorage.getRefreshToken();
  if (!refreshToken) return null;
  try {
    const data = await apiFetch<{accessToken: string}>(AUTH_ENDPOINTS.refresh, {method: 'POST', body: JSON.stringify({refreshToken})});
    authStorage.setTokens({accessToken: data.accessToken, refreshToken});
    return data.accessToken;
  } catch {
    authStorage.clearTokens();
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!authStorage.getAccessToken()) return null;
  try {
    const data = await apiFetch<{user: AuthUser}>(AUTH_ENDPOINTS.me);
    return data.user;
  } catch {
    authStorage.clearTokens();
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  try {
    if (authStorage.getAccessToken()) await apiFetch(AUTH_ENDPOINTS.logout, {method: 'POST'});
  } catch {
    // Local credentials are always cleared even if the server is unavailable.
  } finally {
    authStorage.clearTokens();
  }
}
