import { useAuth } from "@/context/auth-context";

export function usePincode() {
  const { user } = useAuth();
  const p = user?.address?.pincode?.trim();
  return p && /^\d{6}$/.test(p) ? p : undefined;
}