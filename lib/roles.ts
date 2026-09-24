import type { RoleName } from "./types";

export const roleOptions: Array<{ value: RoleName; label: string }> = [
  { value: "HEAD_TRAINER", label: "Head Trainer - Huấn luyện viên trưởng" },
  { value: "VETERINARIAN", label: "Veterinarian - Bác sĩ thú y" },
  { value: "GROOM", label: "Groom - Nhân viên chăm sóc chuồng trại" },
  { value: "HORSE_OWNER", label: "Horse Owner - Chủ sở hữu ngựa" },
  { value: "CLUB_MANAGER", label: "Club Manager - Quản lý câu lạc bộ" },
];

export const roleRoutes: Record<RoleName, string> = {
  HEAD_TRAINER: "/dashboard/head-trainer",
  VETERINARIAN: "/dashboard/veterinarian",
  GROOM: "/dashboard/groom",
  HORSE_OWNER: "/dashboard/horse-owner",
  CLUB_MANAGER: "/dashboard/club-manager",
};

export const roleLabels: Record<RoleName, string> = {
  HEAD_TRAINER: "Huấn luyện viên trưởng",
  VETERINARIAN: "Bác sĩ thú y",
  GROOM: "Nhân viên chăm sóc chuồng trại",
  HORSE_OWNER: "Chủ sở hữu ngựa",
  CLUB_MANAGER: "Quản lý câu lạc bộ",
};

export function routeForRole(role: RoleName) {
  return roleRoutes[role];
}

export function roleForSlug(slug: string): RoleName | null {
  const entry = Object.entries(roleRoutes).find(([, route]) =>
    route.endsWith(`/${slug}`),
  );
  return entry ? (entry[0] as RoleName) : null;
}
