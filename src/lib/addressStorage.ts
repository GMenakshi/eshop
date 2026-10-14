import { API_BASE_URL } from "@/lib/api";

export type SavedAddress = {
  _id?: string;
  label?: string;
  fullName?: string;
  phone?: string;
  addressLine: string;
  area?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  isDefault?: boolean;
};

type Contact = { fullName?: string; phone?: string };

const BASE = `${API_BASE_URL}/login/addresses`;

async function call<T>(
  url: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-access-token": token,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json as T;
}

// only the fields the backend schema knows about
const toPayload = (a: SavedAddress) => ({
  label: a.label || "HOME",
  addressLine: a.addressLine.trim(),
  ...(a.area?.trim() ? { area: a.area.trim() } : {}),
  city: a.city.trim(),
  state: a.state.trim(),
  pincode: a.pincode.trim(),
  country: a.country?.trim() || "India",
});

const norm = (v?: string) => (v ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const sameAddress = (a: SavedAddress, b: SavedAddress) =>
  norm(a.addressLine) === norm(b.addressLine) &&
  norm(a.area) === norm(b.area) &&
  norm(a.city) === norm(b.city) &&
  norm(a.state) === norm(b.state) &&
  norm(a.pincode) === norm(b.pincode);

// Default address first, so "pick the first saved address" picks the default.
export async function getSavedAddresses(
  token: string,
  contact?: Contact,
): Promise<SavedAddress[]> {
  const res = await call<{ addresses?: SavedAddress[] }>(BASE, token);
  return [...(res.addresses ?? [])]
    .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault))
    .map((a) => ({
      ...a,
      fullName: a.fullName || contact?.fullName || "",
      phone: a.phone || contact?.phone || "",
    }));
}

// Used after an order: skips duplicates and never throws,
// so a failed save can't make a successful order look failed.
export async function addSavedAddress(token: string, address: SavedAddress) {
  try {
    const existing = await getSavedAddresses(token);
    if (existing.some((a) => sameAddress(a, address))) return;
    await call(BASE, token, {
      method: "POST",
      body: JSON.stringify(toPayload(address)),
    });
  } catch (e) {
    console.warn("[Addresses] could not save address", e);
  }
}

// Used by the Profile screen: throws, so the screen can show the error.
export const createSavedAddress = (token: string, address: SavedAddress) =>
  call(BASE, token, { method: "POST", body: JSON.stringify(toPayload(address)) });

export const updateSavedAddress = (
  token: string,
  id: string,
  address: SavedAddress,
) =>
  call(`${BASE}/${encodeURIComponent(id)}`, token, {
    method: "PUT",
    body: JSON.stringify(toPayload(address)),
  });

export const deleteSavedAddress = (token: string, id: string) =>
  call(`${BASE}/${encodeURIComponent(id)}`, token, { method: "DELETE" });

export const setDefaultSavedAddress = (token: string, id: string) =>
  call(`${BASE}/${encodeURIComponent(id)}/default`, token, { method: "PATCH" });