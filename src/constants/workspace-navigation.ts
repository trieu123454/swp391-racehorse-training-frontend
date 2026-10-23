import type { RoleName } from "@/types/auth";

export const workspaceNavigation: Record<RoleName, readonly { id: string; label: string }[]> = {
  CLUB_MANAGER: [
    { id: "overview", label: "Tổng quan" }, { id: "care", label: "Phân công" },
    { id: "inventory", label: "Vật tư" }, { id: "incidents", label: "Sự cố" },
    { id: "finance", label: "Thu chi" }, { id: "races", label: "Giải đấu" },
    { id: "horse-requests", label: "Yêu cầu hồ sơ" }, { id: "audit", label: "Nhật ký" },
  ],
  HEAD_TRAINER: [
    { id: "overview", label: "Tổng quan" }, { id: "plans", label: "Giáo án" },
    { id: "diet", label: "Khẩu phần" },
    { id: "calendar", label: "Lịch tập" }, { id: "simulation", label: "Mô phỏng" },
    { id: "analysis", label: "Phân tích" }, { id: "races", label: "Thi đấu" }, { id: "incidents", label: "Sự cố" },
  ],
  VETERINARIAN: [
    { id: "overview", label: "Sức khỏe" }, { id: "stables", label: "Chuồng trại" },
    { id: "exams", label: "Khám bệnh" },
    { id: "medical", label: "Điều trị" }, { id: "diet", label: "Dinh dưỡng" },
    { id: "injuries", label: "Chấn thương" }, { id: "care", label: "Lịch chăm sóc" },
    { id: "incidents", label: "Sự cố" }, { id: "notifications", label: "Thông báo" },
  ],
  GROOM: [
    { id: "overview", label: "Việc hôm nay" }, { id: "horses", label: "Ngựa phụ trách" },
    { id: "diet", label: "Khẩu phần" }, { id: "inventory", label: "Vật tư" },
    { id: "incidents", label: "Sự cố" },
  ],
  HORSE_OWNER: [
    { id: "overview", label: "Tổng quan" }, { id: "health", label: "Sức khỏe" },
    { id: "training", label: "Huấn luyện" }, { id: "races", label: "Thành tích" },
    { id: "finance", label: "Chi phí" },
  ],
};
