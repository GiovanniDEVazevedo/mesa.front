export type StaffRole = 'admin' | 'waiter';
export type StaffUser = { id:string; userId:string; email:string; name:string; role:StaffRole; owner:boolean };
export type StaffRecord = { id:string; email:string; name:string; role:StaffRole; active:number; is_owner:number; user_id:string|null; version:number };
export type Session = { status:'active'; user:StaffUser } | { status:'anonymous'|'pending'|'error'; error?:string; email?:string };
export const waiterActions = new Set(['open-account','create-order','pickup-order','deliver-order','acknowledge-call','pay-account']);
export const adminActions = new Set([...waiterActions,'add-table','order-status','call-waiter','kitchen-call','product-availability','save-product','archive-product','edit-order','admin-cancel-order']);
export function canAct(role:StaffRole,action:unknown) { return typeof action==='string'&&(role==='admin'?adminActions:waiterActions).has(action); }
