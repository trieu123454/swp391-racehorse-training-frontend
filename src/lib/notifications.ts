import type { RoleName } from "@/types/auth";
import { roleLabels, routeForRole } from "./roles";

export type BellNotification = {
  id: string; message: string; is_read: boolean; related_table: string | null;
  related_id: string | null; created_at: string; scheduled_at: string | null;
  type?: string | null; title?: string | null; params?: Record<string, unknown> | null; link?: string | null;
};
export type NotificationTarget = { horse_id?: string; schedule_id?: string; incident_id?: string; event_date?: string };

export function notificationDescription(message?: string | null): string {
  return (message ?? "").replace(/\s+/gu, " ").trim();
}

const notificationLabels: Record<string, string> = {
  Vaccination: "Tiêm phòng", Deworming: "Tẩy giun", Dental: "Khám răng", DentalCheck: "Khám răng", DentalCare: "Chăm sóc răng",
  HoofCare: "Chăm sóc móng", HoofCheck: "Kiểm tra móng", HoofTrimming: "Cắt sửa móng", HealthCheck: "Kiểm tra sức khỏe", MedicalCheckup: "Khám định kỳ", GeneralCheckup: "Khám tổng quát",
  Feeding: "Cho ăn", Watering: "Cho uống nước", Grooming: "Vệ sinh ngựa", Cleaning: "Vệ sinh chuồng", StableCleaning: "Vệ sinh chuồng", Exercise: "Vận động", Medication: "Dùng thuốc",
  Healthy: "Khỏe mạnh", Injured: "Chấn thương", Quarantine: "Cách ly", Sick: "Bị bệnh", Recovering: "Đang hồi phục", Warning: "Cảnh báo", Critical: "Nghiêm trọng",
  Scheduled: "đã lên lịch", Cancelled: "đã hủy", Pending: "đang chờ", InProgress: "đang xử lý", AwaitingClosure: "chờ xác nhận kết quả", Resolved: "đã giải quyết", Completed: "đã hoàn thành", Approved: "đã phê duyệt", Rejected: "đã từ chối", NeedsInformation: "cần bổ sung thông tin", PartiallyApproved: "đã phê duyệt một phần",
};
const labelKey = (value: string) => value.replace(/[\s_-]/g, "").toLowerCase();
const localizedLabels = Object.fromEntries(Object.entries(notificationLabels).map(([key, value]) => [labelKey(key), value]));
const localizeLabel = (value: string) => localizedLabels[labelKey(value)] ?? value;

/** Match historical system templates; captures (names, reasons, notes) remain intact. */
function legacyNotificationContent(message: string): { type?: string; description: string } {
  const patterns: [RegExp, string, (...parts: string[]) => string][] = [
    [/^Your supply request was (approved|rejected)\.?$/i, "SUPPLY_UPDATED", (status) => `Yêu cầu vật tư của bạn ${localizeLabel(status)}.`],
    [/^New supply request for (.+) \(quantity ([^)]+)\)\.?$/i, "SUPPLY_UPDATED", (name, quantity) => `Có yêu cầu vật tư mới: ${name} · Số lượng: ${quantity}.`],
    [/^Horse registration (APPROVED|REJECTED|NEEDS_INFORMATION)(?::\s*(.*))?\.?$/i, "REGISTRATION_UPDATED", (status, note) => `Yêu cầu đăng ký ngựa ${localizeLabel(status)}.${note ? ` ${note}` : ""}`],
    [/^(.+?) care task completed for (.+) on (\d{4}-\d{2}-\d{2})\.?$/i, "TASK_UPDATED", (task, horse, date) => `Đã hoàn thành ${localizeLabel(task)} cho ngựa ${horse} vào ${date}.`],
    [/^(.+?) task assigned for (\d{4}-\d{2}-\d{2})\.?$/i, "TASK_UPDATED", (task, date) => `Bạn được giao ca ${localizeLabel(task)} vào ${date}.`],
    [/^A care task (?:was assigned|scheduled) for (\d{4}-\d{2}-\d{2})(?: was (cancelled|reassigned))?\.?$/i, "TASK_UPDATED", (date, action) => `Ca chăm sóc ngày ${date} ${action === "cancelled" ? "đã bị hủy" : action === "reassigned" ? "đã được phân công lại" : "đã được giao cho bạn"}.`],
    [/^Groom confirmed the training session for (.+) on (\d{4}-\d{2}-\d{2})\.?$/i, "TRAINING_UPDATED", (horse, date) => `Nhân viên chăm sóc đã xác nhận buổi tập của ngựa ${horse} ngày ${date}.`],
    [/^Ban duoc phan cong buoi tap (.+) vao (\d{4}-\d{2}-\d{2}) luc (\d{2}:\d{2}(?::\d{2})?)\.?$/i, "TRAINING_UPDATED", (horse, date, time) => `Bạn được phân công buổi tập của ngựa ${horse} vào ${date} lúc ${time}.`],
    [/^A new training video is available for (.+?)\.?$/i, "VIDEO_UPLOADED", (horse) => `Có video tập luyện mới của ngựa ${horse}.`],
    [/^Race result recorded for (.+): position (\d+)\.?$/i, "RACE_UPDATED", (race, position) => `Đã ghi nhận kết quả cuộc đua ${race}: hạng ${position}.`],
    [/^A new veterinary health examination is available for (.+?)\.?$/i, "HEALTH_UPDATED", (horse) => `Có kết quả khám thú y mới của ngựa ${horse}.`],
    [/^Horse (.+) has an active injury marker at (.+); training has been locked\.?$/i, "HEALTH_UPDATED", (horse, part) => `Ngựa ${horse} đang có chấn thương tại ${part}; đã khóa huấn luyện.`],
    [/^Ngua (.+) bi tu dong khoa huan luyen do trang thai (\w+)\.?$/i, "HEALTH_UPDATED", (horse, status) => `Ngựa ${horse} bị tự động khóa huấn luyện do trạng thái ${localizeLabel(status)}.`],
    [/^Training metric alert for (.+): heart rate, speed, or stamina exceeded the configured safety threshold\.?$/i, "MONITORING_ALERT", (horse) => `Cảnh báo chỉ số tập luyện của ngựa ${horse}: nhịp tim, tốc độ hoặc thể lực vượt ngưỡng an toàn.`],
    [/^Training simulation for horse (.+) exceeded a configured monitoring threshold; review the sensor readings\.?$/i, "MONITORING_ALERT", (horse) => `Chỉ số mô phỏng tập luyện của ngựa ${horse} vượt ngưỡng theo dõi. Vui lòng kiểm tra dữ liệu cảm biến.`],
    [/^(?:URGENT: )?New Groom incident for (.+?): (.+)$/i, "INCIDENT_UPDATED", (horse, note) => `Nhân viên chăm sóc báo sự cố ở ngựa ${horse}: ${note}`],
    [/^(?:URGENT: )?A Groom reported an incident involving your horse (.+?)\. (.+)$/i, "INCIDENT_UPDATED", (horse, note) => `Nhân viên chăm sóc báo sự cố ở ngựa ${horse}. ${note}`],
    [/^(?:URGENT: )?A stable incident was reported for (.+); please review it because this horse has active training\.?$/i, "INCIDENT_UPDATED", (horse) => `Có sự cố ở ngựa ${horse}. Vui lòng kiểm tra vì ngựa đang có lịch tập.`],
    [/^An urgent incident for (.+) was accepted by a veterinarian\.?$/i, "INCIDENT_UPDATED", (horse) => `Bác sĩ thú y đã tiếp nhận sự cố khẩn cấp của ngựa ${horse}.`],
    [/^Incident result submitted for (.+); Club Manager review is pending\.?$/i, "INCIDENT_UPDATED", (horse) => `Đã gửi kết quả xử lý sự cố của ngựa ${horse}, đang chờ Quản lý CLB xem xét.`],
    [/^A result was (?:submitted|recorded) for (?:your incident|the incident reported|the incident) on (.+?)\.?$/i, "INCIDENT_UPDATED", (horse) => `Đã ghi nhận kết quả xử lý sự cố của ngựa ${horse}.`],
    [/^Incident for (.+) assigned to you\. Instructions: (.*)$/i, "INCIDENT_UPDATED", (horse, note) => `Bạn được phân công xử lý sự cố của ngựa ${horse}.${note && note !== "null" ? ` Hướng dẫn: ${note}` : ""}`],
    [/^Incident for (.+) is assigned to (.+)\. Instructions: (.*)$/i, "INCIDENT_UPDATED", (horse, role, note) => `Sự cố của ngựa ${horse} đã được giao cho ${role}.${note && note !== "null" ? ` Hướng dẫn: ${note}` : ""}`],
    [/^Incident for (.+) was reassigned\.?$/i, "INCIDENT_UPDATED", (horse) => `Sự cố của ngựa ${horse} đã được phân công lại.`],
    [/^Your incident report for (.+) has been resolved\.?$/i, "INCIDENT_UPDATED", (horse) => `Sự cố bạn báo cáo về ngựa ${horse} đã được giải quyết.`],
    [/^The incident assigned to you has been closed\.?$/i, "INCIDENT_UPDATED", () => "Sự cố được giao cho bạn đã được đóng."],
    [/^(?:Your account has been|Account) (unlocked|locked|approved|rejected)\.?(?: Reason: (.*))?$/i, "", (action, reason) => `Tài khoản của bạn ${action === "unlocked" ? "đã được mở khóa" : action === "locked" ? "đã bị khóa" : localizeLabel(action)}.${reason ? ` Lý do: ${reason}` : ""}`],
  ];
  for (const [pattern, type, render] of patterns) {
    const match = message.match(pattern);
    if (match) return { type: type || ({ unlocked: "ACCOUNT_UNLOCKED", locked: "ACCOUNT_LOCKED", approved: "ACCOUNT_APPROVED", rejected: "ACCOUNT_REJECTED" })[match[1].toLowerCase()], description: `${/^URGENT:/i.test(message) ? "Khẩn cấp: " : ""}${render(...match.slice(1))}` };
  }
  return { description: message };
}

function localizeSystemTerms(value: string): string {
  let result = value.replace(/Club Manager/gi, "Quản lý CLB").replace(/Horse Owner/gi, "Chủ sở hữu ngựa");
  for (const [key, label] of Object.entries(roleLabels).sort(([a], [b]) => b.length - a.length)) result = result.replace(new RegExp(`\\b${key.replaceAll("_", "[ _]")}\\b`, "gi"), label);
  result = result.replace(/((?:trạng thái|trang thai)\s+)(Healthy|Injured|Quarantine|Recovering)\b/gi, (_, prefix: string, status: string) => prefix + localizeLabel(status));
  result = result.replace(/\((Warning|Critical)\)/g, (_, level: string) => `(${localizeLabel(level)})`);
  return result.replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "ngựa liên quan")
    .replace(/Ngày mai\s*\((\d{4})-(\d{2})-(\d{2})\)/gi, "$3/$2/$1")
    .replace(/(\d{4})-(\d{2})-(\d{2})/g, "$3/$2/$1")
    .replace(/Lý do:\s*(?:null|undefined|N\/A)?\.?\s*$/i, "").replace(/\b(\d{2}:\d{2}):\d{2}\b/g, "$1").trim();
}

export function notificationKind(item: Pick<BellNotification, "message" | "related_table" | "type">) {
  const type = item.type ?? "";
  if (type === "ROLE_CHANGED" || type === "ROLE_REJECTED") return "role";
  if (type === "ACCOUNT_UNLOCKED") return "unlocked";
  if (type === "ACCOUNT_LOCKED" || type === "ACCOUNT_REJECTED") return "locked";
  if (type.startsWith("ACCOUNT_")) return "account";
  if (type === "CARE_OVERDUE") return "overdue";
  if (type.startsWith("INCIDENT") || type === "MONITORING_ALERT") return "incident";
  if (type === "CARE_REASSIGNED") return "reassigned";
  if (/^(CARE_|TRAINING_|TASK_)/.test(type)) return "assigned";
  const text = (item.message ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");
  const account = /tai khoan|account/.test(text);
  if (account && /mo khoa|unlock/.test(text)) return "unlocked";
  if (account && /bi khoa|locked/.test(text)) return "locked";
  if (/vai tro|role/.test(text)) return "role";
  if (item.related_table?.toLowerCase() === "users" && /tai khoan|account/.test(text)) return "account";
  if (/incident/i.test(item.related_table ?? "")) return "incident";
  if (/qua han|overdue/.test(text)) return "overdue";
  if (/doi bac si|dieu chuyen|reassign/.test(text)) return "reassigned";
  if (/incident|su co|emergency/.test(text) || /incident/i.test(item.related_table ?? "")) return "incident";
  if (/calendar|periodic|training_schedules|daily_task/i.test(item.related_table ?? "")) return "assigned";
  return "general";
}

export function notificationExactTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return `${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(date)} lúc ${new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)}`;
}

const titles: Record<string, string> = {
  CARE_ASSIGNED: "Lịch chăm sóc mới", CARE_REASSIGNED: "Thay đổi bác sĩ phụ trách", CARE_OVERDUE: "Chăm sóc quá hạn",
  ROLE_CHANGED: "Vai trò đã thay đổi", ROLE_REJECTED: "Yêu cầu đổi vai trò bị từ chối",
  ACCOUNT_LOCKED: "Tài khoản bị khóa", ACCOUNT_UNLOCKED: "Tài khoản đã được mở khóa", ACCOUNT_APPROVED: "Tài khoản đã được phê duyệt", ACCOUNT_REJECTED: "Tài khoản bị từ chối",
  INCIDENT_UPDATED: "Cập nhật sự cố", MONITORING_ALERT: "Cảnh báo sức khỏe", TRAINING_UPDATED: "Cập nhật lịch tập", TASK_UPDATED: "Cập nhật ca chăm sóc",
  HEALTH_UPDATED: "Cập nhật sức khỏe ngựa", SUPPLY_UPDATED: "Cập nhật yêu cầu vật tư", REGISTRATION_UPDATED: "Cập nhật đăng ký ngựa", RACE_UPDATED: "Cập nhật đăng ký đua", VIDEO_UPLOADED: "Video tập luyện mới",
};
export function notificationIsAccount(item: BellNotification) { return /^(ACCOUNT_|ROLE_)/.test(item.type ?? "") || ["account", "role", "locked", "unlocked"].includes(notificationKind(item)); }
export function notificationGroup(item: BellNotification, now = new Date()): "Hôm nay" | "Tuần này" | "Cũ hơn" {
  const date = new Date(item.created_at);
  if (Number.isNaN(date.valueOf())) return "Cũ hơn";
  if (notificationIsAccount(item) && now.valueOf() - date.valueOf() > 14 * 86400000) return "Cũ hơn";
  if (dayKey(date) === dayKey(now)) return "Hôm nay";
  const localNow = new Date(`${dayKey(now)}T00:00:00Z`);
  localNow.setUTCDate(localNow.getUTCDate() - (localNow.getUTCDay() + 6) % 7);
  return dayKey(date) >= dayKey(localNow) && date <= now ? "Tuần này" : "Cũ hơn";
}
export function notificationPresentation(item: BellNotification) {
  const p = item.params ?? {};
  const text = (key: string) => typeof p[key] === "string" || typeof p[key] === "number" ? String(p[key]) : "";
  const role = (value: string) => roleLabels[value.trim().toUpperCase().replace(/[ -]/g, "_") as RoleName] ?? "vai trò mới";
  const horse = text("horse_name") ? `ngựa ${text("horse_name")}` : "ngựa";
  const date = text("event_date");
  const when = date ? `${date.slice(0, 10).split("-").reverse().join("/")}${text("start_time") ? ` lúc ${text("start_time").slice(0, 5)}` : ""}` : "";
  const reason = text("reason").trim();
  const status = localizedLabels[labelKey(text("status"))];
  const kind = notificationKind(item);
  let description = "";
  switch (item.type) {
    case "ROLE_CHANGED": description = `Quản lý CLB đã đổi vai trò của bạn${text("old_role") ? ` từ ${role(text("old_role"))}` : ""}${text("new_role") ? ` sang ${role(text("new_role"))}` : ""}. Vui lòng đăng nhập lại để áp dụng quyền mới.`; break;
    case "ROLE_REJECTED": description = "Quản lý CLB đã từ chối yêu cầu đổi vai trò của bạn."; break;
    case "ACCOUNT_UNLOCKED": description = "Quản lý CLB đã mở khóa tài khoản của bạn. Bạn có thể đăng nhập lại."; break;
    case "ACCOUNT_LOCKED": description = `Quản lý CLB đã khóa tài khoản của bạn.${reason ? ` Lý do: ${reason}` : ""}`; break;
    case "ACCOUNT_APPROVED": description = "Quản lý CLB đã phê duyệt tài khoản của bạn."; break;
    case "ACCOUNT_REJECTED": description = `Quản lý CLB đã từ chối tài khoản của bạn.${reason ? ` Lý do: ${reason}` : ""}`; break;
    case "CARE_ASSIGNED": case "CARE_REASSIGNED": case "CARE_OVERDUE": description = `${localizeLabel(text("care_label") || text("care_type")) || "Chăm sóc"} cho ${horse}${when ? ` · ${when}` : ""}.${item.type === "CARE_OVERDUE" ? " Cần cập nhật kết quả hoặc điều phối lại." : ""}`; break;
    case "INCIDENT_UPDATED": case "MONITORING_ALERT": description = `${item.type === "MONITORING_ALERT" ? "Chỉ số tập luyện vượt ngưỡng an toàn" : `Sự cố${status ? ` ${status}` : " cần theo dõi"}`} ở ${horse}.${text("issue_description") ? ` ${text("issue_description")}` : ""}${text("assignment_note") ? ` Hướng dẫn: ${text("assignment_note")}` : ""}${text("result_note") ? ` Kết quả: ${text("result_note")}` : ""}`; break;
    case "TRAINING_UPDATED": description = `Lịch tập của ${horse}${when ? ` · ${when}` : ""} đã được cập nhật.`; break;
    case "TASK_UPDATED": description = `Ca chăm sóc ${horse}${when ? ` · ${when}` : ""}${status ? ` ${status}` : " đã được cập nhật"}.`; break;
    case "HEALTH_UPDATED": description = `Hồ sơ sức khỏe của ${horse} đã được cập nhật.`; break;
    case "VIDEO_UPLOADED": description = `Có video tập luyện mới của ${horse}.`; break;
    case "RACE_UPDATED": description = `Đăng ký đua của ${horse} đã được cập nhật.`; break;
    case "SUPPLY_UPDATED": description = `Yêu cầu vật tư${text("item_name") ? ` ${text("item_name")}` : ""}${text("quantity_requested") ? ` · ${text("quantity_requested")}` : ""}${status ? ` ${status}` : " đã được cập nhật"}.`; break;
    case "REGISTRATION_UPDATED": description = `Yêu cầu đăng ký ${horse}${status ? ` ${status}` : " đã được cập nhật"}.${text("review_note") ? ` ${text("review_note")}` : ""}`; break;
  }
  const legacy = !description ? legacyNotificationContent(notificationDescription(item.message)) : null;
  if (legacy) description = localizeSystemTerms(legacy.description);
  return { title: titles[item.type ?? legacy?.type ?? ""] ?? ({ overdue: "Chăm sóc quá hạn", assigned: "Lịch chăm sóc mới", reassigned: "Thay đổi bác sĩ phụ trách", incident: "Sự cố cần xử lý", role: "Vai trò đã thay đổi", locked: "Tài khoản bị khóa", unlocked: "Tài khoản đã được mở khóa", account: "Cập nhật tài khoản", general: "Cập nhật hoạt động" })[kind], description, action: kind === "overdue" ? "Xem ngựa quá hạn" : kind === "assigned" || kind === "reassigned" ? "Xem lịch" : kind === "incident" ? "Xem sự cố" : "Xem chi tiết" };
}

const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
export function notificationIsToday(item: BellNotification, now = new Date()) {
  const date = new Date(item.scheduled_at ?? item.created_at);
  return !Number.isNaN(date.valueOf()) && dayKey(date) === dayKey(now);
}
export function notificationRelativeTime(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const minutes = Math.max(0, Math.floor((now.valueOf() - date.valueOf()) / 60_000));
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (dayKey(date) === dayKey(now)) return `${Math.floor(minutes / 60)} giờ trước`;
  if (dayKey(date) === dayKey(new Date(now.valueOf() - 86400000))) return "Hôm qua";
  return `${Math.max(1, Math.floor(minutes / 1440))} ngày trước`;
}

export function notificationHref(item: BellNotification, target: NotificationTarget, role: RoleName): string {
  if (item.link?.startsWith("/") && !item.link.startsWith("//")) return item.link;
  const base = routeForRole(role);
  const table = (item.related_table ?? "").toLowerCase();
  const vet = role === "VETERINARIAN" || role === "HEAD_VETERINARIAN";
  const params = new URLSearchParams();
  if (table) params.set("source", table);
  if (table.includes("registration") && role === "HORSE_OWNER") return `/horses?notificationTarget=${encodeURIComponent(item.related_id ?? "")}`;
  if (table.includes("registration")) params.set("tab", role === "CLUB_MANAGER" ? "horse-requests" : "overview");
  else if (table === "supply_requests") params.set("tab", "inventory");
  else if (table === "daily_task_logs") params.set("tab", role === "CLUB_MANAGER" ? "care" : "overview");
  else if (table === "horse_race_entries") params.set("tab", "races");
  else if (table === "training_videos") params.set("tab", role === "HORSE_OWNER" ? "training" : "calendar");
  else if (table === "race_simulations") params.set("tab", role === "HEAD_TRAINER" ? "simulation" : "overview");
  else if (table === "training_schedules") params.set("tab", role === "HEAD_TRAINER" ? "calendar" : role === "HORSE_OWNER" ? "training" : "overview");
  else if (notificationKind(item) === "incident") params.set("tab", role === "HORSE_OWNER" ? "health" : "incidents");
  else if (vet && target.horse_id) params.set("tab", role === "HEAD_VETERINARIAN" && notificationKind(item) === "overdue" ? "dispatch" : table.includes("injury") ? "injuries" : table.includes("medical") ? "medical" : table.includes("exam") ? "exams" : table === "horses" ? "overview" : "care");
  else if (role === "HEAD_TRAINER" && target.horse_id) params.set("tab", "calendar");
  else if (role === "HORSE_OWNER" && target.horse_id) params.set("tab", "health");
  if (target.horse_id) params.set("horse", target.horse_id);
  if (target.schedule_id) params.set("schedule", target.schedule_id);
  if (target.incident_id) params.set("incident", target.incident_id);
  if (target.event_date) params.set("date", target.event_date.slice(0, 10));
  if (item.related_id) params.set("notificationTarget", target.incident_id ?? target.horse_id ?? item.related_id);
  return params.size ? `${base}?${params}` : base;
}
