import { ApiRequestError, validateSession } from "./api";
import { getAccessToken } from "./session";
import type { RoleName } from "./types";

export type AssignableRoleName = Exclude<RoleName, "CLUB_MANAGER">;

const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const send = () => fetch(`${base}/api/club-manager${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
      Authorization: `Bearer ${getAccessToken()}`,
    },
  });
  let response = await send();
  if (response.status === 401) {
    await validateSession();
    response = await send();
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiRequestError(body.message || "Không thể thực hiện yêu cầu.", response.status);
  }
  return response.json() as Promise<T>;
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

export const clubManagerError = (error: unknown) =>
  error instanceof Error ? error.message : "Có lỗi xảy ra. Vui lòng thử lại.";
