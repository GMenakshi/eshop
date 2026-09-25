import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import { api, type ApiUser } from "@/lib/api";

type AuthContextValue = {
  token: string | null;
  user: ApiUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "authUser";

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(AUTH_TOKEN_KEY),
      AsyncStorage.getItem(AUTH_USER_KEY),
    ]).then(([savedToken, savedUser]) => {
      if (!active) return;
      setToken(savedToken);
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser) as ApiUser);
        } catch {
          void AsyncStorage.removeItem(AUTH_USER_KEY);
        }
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const timeout = setTimeout(
      () => {
        setToken(null);
        setUser(null);
        void AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
      },
      30 * 60 * 1000,
    );
    return () => clearTimeout(timeout);
  }, [token]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await api.signIn(email, password);
    const payload = (
      "user" in response ? response.user : (response.data ?? {})
    ) as Partial<ApiUser>;
    const normalizedUser: ApiUser = {
      _id: payload._id ?? payload.id,
      id: payload.id ?? payload._id,
      name: payload.name,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email ?? email,
      role: payload.role,
      phone: payload.phone,
      isActive: payload.isActive,
    };
    setToken(response.token);
    setUser(normalizedUser);
    await AsyncStorage.multiSet([
      [AUTH_TOKEN_KEY, response.token],
      [AUTH_USER_KEY, JSON.stringify(normalizedUser)],
    ]);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const response = await api.dashboard(token);
    const payload = (response.user ?? response.data ?? {}) as Partial<ApiUser>;
    const normalizedUser: ApiUser = {
      _id: payload._id ?? payload.id,
      id: payload.id ?? payload._id,
      name: payload.name,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email ?? "",
      role: payload.role,
      phone: payload.phone,
      isActive: payload.isActive,
      address: payload.address,
    };
    setUser(normalizedUser);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
  }, [token]);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    void AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        signIn,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
