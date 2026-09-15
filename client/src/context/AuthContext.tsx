import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthUser, forgotPassword, getCurrentUser, loginUser, logoutUser, refreshSession, registerUser, resendVerification, resetPassword, verifyEmail } from '../services/authService';

interface AuthContextValue {
  user: AuthUser | null;
  role: AuthUser['role'] | null;
  authorStatus: AuthUser['authorStatus'] | null;
  emailVerified: boolean;
  accountStatus: AuthUser['accountStatus'] | null;
  isAuthenticated: boolean;
  loading: boolean;
  isLoading: boolean;
  login: (payload: { email: string; password: string }) => Promise<AuthUser>;
  register: (payload: { username: string; email: string; password: string }) => Promise<AuthUser>;
  verifyEmail: (email: string, otp: string) => Promise<AuthUser>;
  resendVerification: (email: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (payload: { email: string; otp: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  loadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = useCallback(async () => {
    setIsLoading(true);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = useCallback(async (payload: { email: string; password: string }) => {
    const result = await loginUser(payload);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(async (payload: { username: string; email: string; password: string }) => {
    const result = await registerUser(payload);
    return result.user;
  }, []);

  const verify = useCallback(async (email: string, otp: string) => {
    const result = await verifyEmail(email, otp);
    // Verification does not issue tokens. Keep the client as a guest until the
    // user explicitly logs in and authStorage receives backend-issued JWTs.
    return result.user;
  }, []);

  const resend = useCallback(async (email: string) => {
    await resendVerification(email);
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    await forgotPassword(email);
  }, []);

  const completePasswordReset = useCallback(async (payload: { email: string; otp: string; password: string }) => {
    await resetPassword(payload);
  }, []);

  const logout = useCallback(async () => {
    await logoutUser();
    setUser(null);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const accessToken = await refreshSession();
    if (!accessToken) {
      setUser(null);
      return;
    }

    await loadUser();
  }, [loadUser]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    role: user?.role || null,
    authorStatus: user?.authorStatus || null,
    emailVerified: Boolean(user?.emailVerified),
    accountStatus: user?.accountStatus || null,
    isAuthenticated: Boolean(user?.emailVerified && user.accountStatus === 'ACTIVE'),
    loading: isLoading,
    isLoading,
    login,
    register,
    verifyEmail: verify,
    resendVerification: resend,
    forgotPassword: requestPasswordReset,
    resetPassword: completePasswordReset,
    logout,
    refreshAccessToken,
    loadUser,
  }), [loadUser, login, logout, refreshAccessToken, user, isLoading, register, verify, resend, requestPasswordReset, completePasswordReset]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
