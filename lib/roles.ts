import type { RoleName } from "./types";
import { Routes } from "@/routes/Routes";

export const roleRoutes: Record<RoleName, string> = {
  HEAD_TRAINER: Routes.dashboardRole("head-trainer"),
  VETERINARIAN: Routes.dashboardRole("veterinarian"),
  GROOM: Routes.dashboardRole("groom"),
  HORSE_OWNER: Routes.dashboardRole("horse-owner"),
  CLUB_MANAGER: Routes.dashboardRole("club-manager"),
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
