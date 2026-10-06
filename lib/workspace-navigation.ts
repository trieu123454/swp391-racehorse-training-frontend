import type { RoleName } from "./types";

export const workspaceNavigation: Record<RoleName, readonly { id: string; label: string }[]> = {
  CLUB_MANAGER: [
    { id: "overview", label: "Tổng quan" }, { id: "care", label: "Phân công chăm sóc" },
    { id: "inventory", label: "Kho vật tư" }, { id: "incidents", label: "Xử lý sự cố" },
    { id: "finance", label: "Thu chi" }, { id: "races", label: "Giải đấu" }, { id: "audit", label: "Nhật ký hoạt động" },
  ],
  HEAD_TRAINER: [
    { id: "overview", label: "Tổng quan" }, { id: "plans", label: "Giáo án huấn luyện" },
    { id: "calendar", label: "Lịch tập" }, { id: "simulation", label: "Mô phỏng buổi tập" },
    { id: "analysis", label: "Phân tích kết quả" }, { id: "races", label: "Thi đấu" }, { id: "incidents", label: "Xử lý sự cố" },
  ],
  VETERINARIAN: [
    { id: "overview", label: "Tổng quan sức khỏe" }, { id: "exams", label: "Khám sức khỏe" },
    { id: "medical", label: "Hồ sơ điều trị" }, { id: "diet", label: "Dinh dưỡng" },
    { id: "injuries", label: "Chấn thương" }, { id: "care", label: "Chăm sóc định kỳ" },
    { id: "incidents", label: "Xử lý sự cố" }, { id: "notifications", label: "Thông báo" },
  ],
  GROOM: [
    { id: "overview", label: "Công việc hôm nay" }, { id: "horses", label: "Ngựa được phân công" },
    { id: "diet", label: "Khẩu phần ăn" }, { id: "inventory", label: "Vật tư chuồng trại" },
    { id: "incidents", label: "Báo cáo & sự cố" },
  ],
  HORSE_OWNER: [
    { id: "overview", label: "Tổng quan" }, { id: "health", label: "Sức khỏe" },
    { id: "training", label: "Quá trình huấn luyện" }, { id: "races", label: "Thành tích thi đấu" },
    { id: "finance", label: "Chi phí & tiền thưởng" },
  ],
};
