export const staffRoles = ['admin', 'waiter', 'kitchen'] as const;
export type StaffRole = typeof staffRoles[number];
export function isStaffRole(value: unknown): value is StaffRole { return typeof value === 'string' && (staffRoles as readonly string[]).includes(value); }
export const roleLabels: Record<StaffRole, string> = { admin: 'Administrador', waiter: 'Garçom', kitchen: 'Cozinha' };
export type StaffUser = { id:string; userId:string; email:string; name:string; role:StaffRole; owner:boolean };
export type StaffRecord = { id:string; email:string; name:string; role:StaffRole; active:number; is_owner:number; user_id:string|null; version:number };
export type Session = { status:'active'; user:StaffUser } | { status:'anonymous'|'pending'|'error'; error?:string; email?:string };
export const waiterActions = new Set(['open-account','create-order','pickup-order','deliver-order','acknowledge-call','pay-account']);
export const kitchenActions = new Set(['order-status','kitchen-call']);
export const adminActions = new Set([...waiterActions,'add-table','order-status','call-waiter','kitchen-call','product-availability','save-product','archive-product','edit-order','admin-cancel-order']);
const actionsByRole: Record<StaffRole, ReadonlySet<string>> = { admin: adminActions, waiter: waiterActions, kitchen: kitchenActions };
export function canAct(role:StaffRole,action:unknown) { return isStaffRole(role) && typeof action==='string' && actionsByRole[role].has(action); }
