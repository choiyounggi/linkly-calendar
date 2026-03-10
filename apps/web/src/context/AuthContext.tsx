"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (provider: "kakao" | "google" | "naver") => void;
  logout: () => void;
  setToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 초기화: localStorage에서 토큰 로드
  useEffect(() => {
    const stored = localStorage.getItem("auth_token");
    if (stored) {
      setTokenState(stored);
    } else {
      setLoading(false);
    }
  }, []);

  // 토큰이 있으면 사용자 정보 조회
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Unauthorized");
        const data = (await res.json()) as AuthUser;
        if (!cancelled) setUser(data);
      } catch {
        // 토큰 만료 시 정리
        if (!cancelled) {
          localStorage.removeItem("auth_token");
          setTokenState(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const setToken = useCallback((newToken: string) => {
    localStorage.setItem("auth_token", newToken);
    setTokenState(newToken);
  }, []);

  const login = useCallback((provider: "kakao" | "google" | "naver") => {
    window.location.href = `${API_URL}/v1/auth/${provider}`;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("auth_token");
    setTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, login, logout, setToken }),
    [token, user, loading, login, logout, setToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
