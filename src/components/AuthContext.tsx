import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  api,
  clearStoredAuthToken,
  getStoredAuthToken,
  setStoredAuthToken,
  type AuthUser,
} from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  loginWithCredentials: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  setAuthenticatedUser: (user: AuthUser, token?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser?: AuthUser | null | undefined;
}) {
  const hasExplicitInitial = initialUser !== undefined;
  const [user, setUser] = useState<AuthUser | null>(initialUser ?? null);
  const [loading, setLoading] = useState<boolean>(!hasExplicitInitial);

  useEffect(() => {
    if (hasExplicitInitial) return;

    let cancelled = false;
    const token = getStoredAuthToken();

    api
      .me()
      .then((res) => {
        if (!cancelled) {
          setUser(res.authenticated ? res.user : null);
          if (!res.authenticated && token) {
            clearStoredAuthToken();
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          if (token) {
            clearStoredAuthToken();
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasExplicitInitial]);

  const setAuthenticatedUser = useCallback((nextUser: AuthUser, token?: string) => {
    if (token) setStoredAuthToken(token);
    setUser(nextUser);
  }, []);

  const loginWithCredentials = useCallback(async (username: string, password: string) => {
    const res = await api.login({ username, password });
    setStoredAuthToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear local state even if network request fails
    } finally {
      clearStoredAuthToken();
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithCredentials,
        logout,
        setAuthenticatedUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
