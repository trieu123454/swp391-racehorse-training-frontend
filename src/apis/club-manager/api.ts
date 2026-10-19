import { ApiRequestError, authenticatedRequest } from "@/api/client";
import type { RoleName } from "@/lib/types";
import type { HorseRegistrationRequest } from "@/api/horse-owner/api";

export type AssignableRoleName = Exclude<RoleName, "CLUB_MANAGER">;
export type CreatableRoleName = Exclude<RoleName, "HORSE_OWNER">;

export type PendingUser = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role_name: RoleName;
  status: "PENDING" | "APPROVED" | "LOCKED" | "REJECTED";
  created_at: string;
};

export type PendingUserPage = {
  data: PendingUser[];
  total: number;
  page: number;
  limit: number;
};

export type RoleChangeRequest = {
  id: string;
  user_id: number;
  full_name: string;
  email: string;
  current_role: string | null;
  requested_role: string;
  reason: string | null;
  status: "Pending" | "Approved" | "Rejected";
  created_at: string;
  reviewed_by: number | null;
  reviewed_at: string | null;
};

export type ManagerHorseRegistrationRequest = HorseRegistrationRequest & {
  owner_name: string;
  owner_email: string;
  owner_phone: string | null;
};

export type InventoryStatus = "SUFFICIENT" | "LOW_STOCK" | "OUT_OF_STOCK" | "EXPIRING" | "EXPIRED" | "INACTIVE";
export type InventoryLot = {
  id: string; lot_number: string; expiry_date: string | null; quantity_received: number;
  quantity_remaining: number; received_at: string;
};
export type InventoryItem = {
  id: string; item_code: string; item_name: string; category: string; unit: string;
  quantity_in_stock: number; usable_quantity: number; reorder_threshold: number;
  description: string | null; is_active: boolean; status: InventoryStatus;
  nearest_expiry_date: string | null; is_low_stock: boolean; is_expiring: boolean; lots?: InventoryLot[];
};
export type InventoryItemDetail = Pick<InventoryItem, "id" | "item_code" | "item_name" | "description"> & { lots: InventoryLot[] };
export type InventorySummary = {
  total_items: number; low_stock: number; expiring_soon: number; pending_requests: number;
  expired: number; out_of_stock: number;
};
export type InventoryTransaction = {
  id: string; item_id: string; item_code: string; item_name: string; lot_id: string | null;
  lot_number: string | null; expiry_date: string | null; actor_id: number; actor_name: string;
  transaction_type: "OPENING" | "RECEIPT" | "USAGE" | "ADJUSTMENT";
  quantity_change: number; quantity_before: number; quantity_after: number; reason: string | null;
  created_at: string;
};

export type SupplyRequest = {
  id: string; requested_by: number; groom_name: string | null; item_id: string; item_name: string;
  item_code: string; quantity_requested: number; quantity_approved: number | null; reason: string | null;
  review_note: string | null; status: "Pending" | "Approved" | "PartiallyApproved" | "Rejected";
  reviewed_by: number | null; created_at: string; reviewed_at: string | null;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return authenticatedRequest<T>(`/api/club-manager${path}`, options);
}

export function listInventoryItems() {
  return request<{ data: InventoryItem[]; summary: InventorySummary }>("/inventory-items");
}

export function getInventoryItem(id: string) {
  return request<InventoryItemDetail>(`/inventory-items/${encodeURIComponent(id)}`);
}

export function createInventoryItem(input: {
  item_name: string; category: string; unit: string; quantity_in_stock: number;
  reorder_threshold: number; description?: string | null; initial_lot_number?: string | null;
  initial_expiry_date?: string | null;
}) {
  return request<Record<string, unknown>>("/inventory-items", { method: "POST", body: JSON.stringify(input) });
}

export function updateInventoryItem(id: string, input: Partial<Pick<InventoryItem,
  "item_name" | "category" | "unit" | "reorder_threshold" | "description" | "is_active">>) {
  return request<Record<string, unknown>>(`/inventory-items/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function receiveInventory(id: string, input: {
  quantity: number; received_date: string; lot_number?: string | null; expiry_date?: string | null; reason?: string | null;
}) {
  return request<Record<string, unknown>>(`/inventory-items/${encodeURIComponent(id)}/receipts`, { method: "POST", body: JSON.stringify(input) });
}

export function adjustInventory(id: string, input: { quantity_change: number; reason: string; lot_number?: string | null; expiry_date?: string | null }) {
  return request<Record<string, unknown>>(`/inventory-items/${encodeURIComponent(id)}/adjustments`, { method: "POST", body: JSON.stringify(input) });
}

export function deactivateInventoryItem(id: string) {
  return request<Record<string, unknown>>(`/inventory-items/${encodeURIComponent(id)}/deactivate`, { method: "PATCH" });
}

export function listInventoryTransactions(limit = 100) {
  return request<{ data: InventoryTransaction[] }>(`/inventory-transactions?limit=${limit}`);
}

export function listSupplyRequests(status = "Pending") {
  return request<{ data: SupplyRequest[] }>(`/supply-requests?status=${encodeURIComponent(status)}`);
}

export function reviewSupplyRequest(id: string, input: { action: "APPROVE" | "REJECT"; quantity_approved?: number; review_note?: string }) {
  return request<SupplyRequest>(`/supply-requests/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function listPendingUsers(role?: string, page = 1, limit = 10) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (role && role !== "ALL") query.set("role", role);
  return request<PendingUserPage>(`/users/pending?${query.toString()}`);
}

export function listUsers(status = "APPROVED", role?: string) {
  const query = new URLSearchParams({ status });
  if (role && role !== "ALL") query.set("role", role);
  return request<PendingUser[]>(`/users?${query.toString()}`);
}

export function approveUser(id: number) {
  return request(`/users/${id}/approve`, { method: "PATCH" });
}

export function rejectUser(id: number, reason: string) {
  return request(`/users/${id}/reject`, { method: "PATCH", body: JSON.stringify({ reason: reason || null }) });
}

export function lockUser(id: number, reason: string) {
  return request(`/users/${id}/lock`, { method: "PATCH", body: JSON.stringify({ reason: reason || null }) });
}

export function unlockUser(id: number) {
  return request(`/users/${id}/unlock`, { method: "PATCH" });
}

export function createStaffAccount(input: {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  roleName: CreatableRoleName;
}) {
  return request<{ id: number; email: string; role_name: string; status: string; must_change_password: boolean }>(
    "/users",
    { method: "POST", body: JSON.stringify(input) },
  );
}

export function updateUserRole(id: number, roleName: AssignableRoleName) {
  return request<{ id: number; previous_role: RoleName; role_name: AssignableRoleName }>(
    `/users/${id}/role`,
    { method: "PATCH", body: JSON.stringify({ roleName }) },
  );
}

export function listRoleChangeRequests(status = "Pending") {
  return request<RoleChangeRequest[]>(`/role-change-requests?status=${encodeURIComponent(status)}`);
}

export function handleRoleChange(id: string, action: "approve" | "reject") {
  return request(`/role-change-requests/${id}`, { method: "PATCH", body: JSON.stringify({ action }) });
}

export function listPendingHorseRegistrationRequests() {
  return request<ManagerHorseRegistrationRequest[]>("/horse-registration-requests");
}

export function reviewHorseRegistrationRequest(id: string, input: {
  action: "APPROVE" | "REJECT";
  stableBoxId?: string;
  horseId?: string;
  reviewNote?: string;
}) {
  return request(`/horse-registration-requests/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export const clubManagerError = (error: unknown) => {
  if (error instanceof ApiRequestError && error.status === 401) {
    return "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng xuất rồi đăng nhập lại.";
  }
  return error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";
};
