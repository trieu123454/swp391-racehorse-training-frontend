import type { RoleName } from "@/types/auth";
import { Activity, Bone, BookOpen, Boxes, CalendarDays, ClipboardList, FilePlus2, HeartPulse, History, House, LayoutDashboard, Network, Shield, Stethoscope, Trophy, Users, Utensils, Wallet, Warehouse, type LucideIcon } from "lucide-react";
import { Routes } from "@/routes/Routes";
import { routeForRole } from "@/lib/roles";

export type SidebarItem = { key: string; label: string; icon: LucideIcon; href?: string; badge?: number; children?: { key: string; label: string; href: string }[] };
export type SidebarSection = { label: string; items: SidebarItem[] };
const menuIcons: Record<string, LucideIcon> = { overview: LayoutDashboard, dispatch: Network, care: ClipboardList, stables: Warehouse, exams: Stethoscope, medical: HeartPulse, injuries: Bone, diet: Utensils, incidents: Shield, plans: BookOpen, calendar: CalendarDays, simulation: Activity, analysis: Activity, races: Trophy, inventory: Boxes, finance: Wallet, audit: History, "horse-requests": FilePlus2, horses: BookOpen, health: HeartPulse, training: CalendarDays };

/** The renderer consumes only these sections; role tabs remain the route source. */
export function sidebarSections(role: RoleName, pendingRequests = 0): SidebarSection[] {
  const route = routeForRole(role);
  const tabs = workspaceNavigation[role];
  const medicalKeys = ["exams", "medical", "injuries"];
  const medical = tabs.filter((item) => medicalKeys.includes(item.id));
  const items: SidebarItem[] = [];
  for (const item of tabs) {
    if (medicalKeys.includes(item.id)) {
      if (item === medical[0]) items.push({ key: "medical-group", label: "Y tế", icon: Stethoscope, children: medical.map((child) => ({ key: child.id, label: child.label, href: Routes.dashboardTab(route, child.id) })) });
      continue;
    }
    items.push({ key: item.id, label: item.label, icon: menuIcons[item.id] ?? LayoutDashboard, href: Routes.dashboardTab(route, item.id), badge: role === "CLUB_MANAGER" && item.id === "horse-requests" ? pendingRequests : undefined });
  }
  return [
    { label: "CÔNG VIỆC", items },
    { label: "QUẢN LÝ CHUNG", items: [
      ...(role !== "HORSE_OWNER" ? [{ key: "horse-records", label: "Hồ sơ ngựa", icon: BookOpen, href: Routes.horses }] : []),
      ...(role === "CLUB_MANAGER" ? [{ key: "users", label: "Quản lý tài khoản", icon: Users, href: Routes.clubManagerUsers }] : []),
      { key: "home", label: "Trang chủ", icon: House, href: Routes.home },
    ] },
  ];
}

export const workspaceNavigation: Record<RoleName, readonly { id: string; label: string }[]> = {
  CLUB_MANAGER: [
    { id: "overview", label: "Tổng quan" }, { id: "care", label: "Phân công" },
    { id: "inventory", label: "Vật tư" }, { id: "incidents", label: "Sự cố" },
    { id: "finance", label: "Thu chi" }, { id: "races", label: "Giải đấu" },
    { id: "horse-requests", label: "Yêu cầu hồ sơ" }, { id: "audit", label: "Nhật ký" },
  ],
  HEAD_TRAINER: [
    { id: "overview", label: "Tổng quan" }, { id: "plans", label: "Giáo án" },
    { id: "calendar", label: "Lịch tập" }, { id: "simulation", label: "Mô phỏng" },
    { id: "analysis", label: "Phân tích" }, { id: "races", label: "Thi đấu" }, { id: "incidents", label: "Sự cố" },
  ],
  VETERINARIAN: [
    { id: "overview", label: "Sức khỏe" },
    { id: "care", label: "Lịch chăm sóc" },
    { id: "stables", label: "Chuồng trại" },
    { id: "exams", label: "Khám bệnh" },
    { id: "medical", label: "Điều trị" },
    { id: "diet", label: "Dinh dưỡng" },
    { id: "injuries", label: "Chấn thương" },
    { id: "incidents", label: "Sự cố" }
  ],
  HEAD_VETERINARIAN: [
    { id: "overview", label: "Sức khỏe" },
    { id: "dispatch", label: "Điều phối" },
    { id: "care", label: "Lịch chăm sóc" },
    { id: "stables", label: "Chuồng trại" },
    { id: "exams", label: "Khám bệnh" },
    { id: "medical", label: "Điều trị" },
    { id: "diet", label: "Dinh dưỡng" },
    { id: "injuries", label: "Chấn thương" },
    { id: "incidents", label: "Sự cố" }
  ],
  GROOM: [
    { id: "overview", label: "Việc hôm nay" }, { id: "calendar", label: "Lịch làm việc" },
    { id: "horses", label: "Ngựa phụ trách" }, { id: "diet", label: "Khẩu phần" },
    { id: "inventory", label: "Vật tư" }, { id: "incidents", label: "Sự cố" },
  ],
  HORSE_OWNER: [
    { id: "overview", label: "Tổng quan" }, { id: "health", label: "Sức khỏe" },
    { id: "training", label: "Huấn luyện" }, { id: "races", label: "Thành tích" },
    { id: "finance", label: "Chi phí" }, { id: "horse-requests", label: "Yêu cầu hồ sơ" },
  ],
};
