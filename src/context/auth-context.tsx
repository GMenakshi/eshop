import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { unregisterPush } from "@/lib/push";

import { api, type ApiUser } from "@/lib/api";
import { getSavedAddresses } from "@/lib/addressStorage";

type AuthContextValue = {
  token: string | null;
  user: ApiUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  applySession: (
    token: string,
    user: Partial<ApiUser>,
    fallbackEmail?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "authUser";

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [savedToken, savedUser] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);
        if (!active) return;
        setToken(savedToken);
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser) as ApiUser);
          } catch {
            void AsyncStorage.removeItem(AUTH_USER_KEY);
          }
        }
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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

  const applySession = useCallback(
    async (
      newToken: string,
      payload: Partial<ApiUser>,
      fallbackEmail = "",
    ) => {
      const normalizedUser: ApiUser = {
        _id: payload._id ?? payload.id,
        id: payload.id ?? payload._id,
        name: payload.name,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email ?? fallbackEmail,
        role: payload.role,
        phone: payload.phone,
        isActive: payload.isActive,
      };
      setToken(newToken);
      setUser(normalizedUser);
      await AsyncStorage.multiSet([
        [AUTH_TOKEN_KEY, newToken],
        [AUTH_USER_KEY, JSON.stringify(normalizedUser)],
      ]);
    },
    [],
  );

  const refreshUser = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.dashboard(token);
      const payload = (response.user ?? response.data ?? {}) as Partial<ApiUser>;
      const userId = payload._id ?? payload.id;

      const saved = await getSavedAddresses(token).catch(() => []);
      const userAddress = saved[0] ?? payload.address; // default address comes first

      const normalizedUser: ApiUser = {
        _id: userId,
        id: payload.id ?? payload._id,
        name: payload.name,
        first_name: payload.first_name,
        last_name: payload.last_name,
        email: payload.email ?? "",
        role: payload.role,
        phone: payload.phone,
        isActive: payload.isActive,
        address: userAddress,
      };
      setUser(normalizedUser);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));
    } catch (err) {
      console.warn("[Auth] refreshUser warning:", err);
    }
  }, [token]);

  const signOut = useCallback(async () => {
  if (token) await unregisterPush(token); // must run before the token is cleared
  setToken(null);
  setUser(null);
  await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
}, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        ready,
        signIn,
        applySession,
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