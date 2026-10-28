export type KitchenStatus = 'pending' | 'preparing' | 'ready';
export type KitchenOrder = {
  id: string; number: number; status: KitchenStatus; notes: string;
  created_at: number; updated_at: number; version: number;
  table_label: string; seat: number; waiter: string;
  items: { name: string; quantity: number }[];
};
export type KitchenState = { orders: KitchenOrder[]; operationStatus: string; callPending: boolean; serverTime: number };
export type KitchenFilter = 'all' | KitchenStatus;
export const kitchenDesktopQuery = '(min-width: 1024px)';
export function kitchenPage(orders: KitchenOrder[], filter: KitchenFilter, requestedPage: number, pageSize: 2 | 4) {
  const filtered = orders.filter(order => filter === 'all' || order.status === filter)
    .sort((a, b) => a.created_at - b.created_at || a.number - b.number);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(0, Math.floor(requestedPage) || 0), pageCount - 1);
  const start = page * pageSize;
  return { orders: filtered.slice(start, start + pageSize), total: filtered.length, page, pageCount, start };
}
