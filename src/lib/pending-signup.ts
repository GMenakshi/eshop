let pending: { email: string; password: string } | null = null;

export function setPendingSignup(email: string, password: string) {
  pending = { email, password };
}

// Returns the credentials once, then clears them.
export function takePendingSignup(email: string) {
  const value = pending && pending.email === email ? pending : null;
  pending = null;
  return value;
}