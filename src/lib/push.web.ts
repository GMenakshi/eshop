export async function registerForPush(_authToken: string) { return undefined; }
export async function unregisterPush(_authToken: string) {}
export function listenForeground(_onReceive?: () => void) { return () => {}; }
export function listenNotificationTap(_onOrder: (orderId: string) => void) { return () => {}; }