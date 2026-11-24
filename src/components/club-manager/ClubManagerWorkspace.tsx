"use client";

import { formatDisplayDate } from "@/lib/display-format";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useAutoRefresh } from "@/shared/hooks/use-auto-refresh";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  History,
  MapPin,
  Medal,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { HorseImage, Modal, Notice } from "@/components/horses/HorseUI";
import IncidentPhoto from "@/components/groom/IncidentPhoto";
import InventoryManagerPanel from "@/components/club-manager/InventoryManagerPanel";
import { CompactId } from "@/components/shared/CompactId";
import { roleLabels } from "@/lib/roles";
import { authenticatedRequest, ApiRequestError } from "@/api/client";
import { getHorseStables, horseGender, listHorses, type Horse, type Stable } from "@/api/horses/api";
import { openFreshDocument } from "@/api/horses/api";
import {
  cancelOfficialRace,
  cancelOfficialRaceEntry,
  getCompetitionReport,
  getManagerRegistrationDocumentUrl,
  listHorseRegistrationRequests,
  listOfficialRaceEntries,
  listOfficialRaces,
  reviewHorseRegistrationRequest,
  updateOfficialRace,
  type CompetitionReport,
  type HorseRegistrationStatusFilter,
  type ManagerHorseRegistrationRequest,
  type OfficialRace,
  type OfficialRaceEntry,
} from "@/api/club-manager/api";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";

type Option = { id: string | number; full_name?: string; horse_name?: string; breed?: string | null; birth_year?: number | null; microchip_number?: string | null; passport_number?: string | null; owner_id?: number | null; owner_name?: string | null };
type ManagerTask = { id: string; horse_name: string; groom_name: string | null; task_type: string; task_date: string; status: string };
type IncidentAssignee = { id: number; full_name: string; email: string; role_name: "HEAD_TRAINER" | "VETERINARIAN" | "HEAD_VETERINARIAN" | "GROOM" };
type AssignmentRole = IncidentAssignee["role_name"] | "CLUB_MANAGER";
type Incident = {
  id: string; horse_name: string; groom_name: string | null; issue_description: string; image_url: string | null;
  is_emergency: boolean; status: string; assigned_to: number | null; assigned_role: string | null;
  assignee_name: string | null; assignment_note: string | null; result_note: string | null; created_at: string;
};
type AuditRow = { id: string; user_name: string | null; email: string | null; action_performed: string; created_at: string };
type Report = {
  from: string;
  to: string;
  horses_by_health_status: { current_status: string; total: number }[];
  approved_staff_by_role: { role_name: string; total: number }[];
  scheduled_training_sessions: number;
  groom_tasks: { total: number; completed: number };
  pending_incidents: number;
  training_performance: { scheduled: number; in_progress: number; completed: number; cancelled: number; blocked: number };
  operating_costs_and_prize_income: { care_cost: number; medical_cost: number; prize_income: number; other_amount: number };
  official_competition: {
    registered: number;
    completed: number;
    blocked?: number;
    cancelled?: number;
    wins?: number;
    podiums?: number;
    total_prize?: number;
  };
};

type WorkspaceTab = "overview" | "care" | "inventory" | "incidents" | "finance" | "races" | "audit" | "horse-requests";
const workspaceTabIds: readonly WorkspaceTab[] = ["overview", "care", "inventory", "incidents", "finance", "races", "audit", "horse-requests"];
type TabError = { section: string; message: string };
type LoadErrors = Record<WorkspaceTab, TabError[]>;

const EMPTY_ERRORS: LoadErrors = {
  overview: [], care: [], inventory: [], incidents: [], finance: [], races: [], audit: [], "horse-requests": [],
};

const assignmentRoles: { value: AssignmentRole; label: string }[] = [
  { value: "HEAD_TRAINER", label: "Huấn luyện viên trưởng" },
  { value: "HEAD_VETERINARIAN", label: "Trưởng ban thú y" },
  { value: "VETERINARIAN", label: "Bác sĩ thú y" },
  { value: "GROOM", label: "Groom" },
  { value: "CLUB_MANAGER", label: "Tôi tự xử lý · Club Manager" },
];

const incidentRoleLabels: Record<string, string> = {
  HEAD_TRAINER: "Huấn luyện viên trưởng",
  HEAD_VETERINARIAN: "Trưởng ban thú y",
  VETERINARIAN: "Bác sĩ thú y",
  GROOM: "Groom",
  CLUB_MANAGER: "Club Manager",
};

function isAssignmentRole(role: string | null): role is AssignmentRole {
  return assignmentRoles.some((item) => item.value === role);
}

function IncidentAssignmentForm({
  incident,
  assignees,
  busy,
  onSubmit,
}: {
  incident: Pick<Incident, "id" | "assigned_to" | "assigned_role" | "assignment_note">;
  assignees: IncidentAssignee[];
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>, incidentId: string) => void | Promise<void>;
}) {
  const currentAssignee = assignees.find((person) => person.id === incident.assigned_to);
  const initialRole = isAssignmentRole(incident.assigned_role) ? incident.assigned_role : "";
  const [role, setRole] = useState<AssignmentRole | "">(initialRole);
  const [search, setSearch] = useState(currentAssignee?.full_name ?? "");
  const [selectedId, setSelectedId] = useState(currentAssignee ? String(currentAssignee.id) : "");
  const normalizedSearch = search.trim().toLocaleLowerCase("vi");
  const matches = role && role !== "CLUB_MANAGER" && normalizedSearch.length >= 2
    ? assignees.filter((person) => person.role_name === role
      && `${person.full_name} ${person.email}`.toLocaleLowerCase("vi").includes(normalizedSearch)).slice(0, 8)
    : [];
  const selected = assignees.find((person) => String(person.id) === selectedId && person.role_name === role);
  const assignmentValue = role === "CLUB_MANAGER"
    ? role
    : role && selectedId ? `${role}:${selectedId}` : "";

  return <form onSubmit={(event) => void onSubmit(event, incident.id)} className="mt-4 grid gap-3 rounded-xl border border-equine-line bg-white p-3 sm:grid-cols-2">
    <label className="block"><span className="field-label">Vai trò phụ trách</span>
      <select className="field-control px-3" value={role} onChange={(event) => {
        setRole(event.target.value as AssignmentRole | "");
        setSearch("");
        setSelectedId("");
      }} required>
        <option value="">Chọn vai trò</option>
        {assignmentRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </label>
    {role && role !== "CLUB_MANAGER" && <div className="block">
      <label className="block"><span className="field-label">Tìm người phụ trách theo tên hoặc email</span>
        <input className="field-control px-3" type="search" value={search} onChange={(event) => {
          setSearch(event.target.value);
          setSelectedId("");
        }} placeholder="Nhập ít nhất 2 ký tự" autoComplete="off" />
      </label>
      {selected && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
        Đã chọn: <strong>{selected.full_name}</strong> · {selected.email}
      </p>}
      {normalizedSearch.length >= 2 && <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-equine-line" role="listbox" aria-label="Kết quả tìm người phụ trách">
          {matches.map((person) => <button key={person.id} type="button" role="option" aria-selected={selectedId === String(person.id)}
            onClick={() => setSelectedId(String(person.id))}
            className={`block w-full px-3 py-2 text-left hover:bg-slate-50 ${selectedId === String(person.id) ? "bg-emerald-50" : "bg-white"}`}>
            <span className="block text-sm font-semibold text-equine-navy">{person.full_name}</span>
            <span className="block text-xs text-slate-500">{person.email}</span>
          </button>)}
          {!matches.length && <p className="px-3 py-3 text-sm text-slate-500">Không tìm thấy người đang hoạt động phù hợp.</p>}
        </div>}
    </div>}
    <input type="hidden" name="assignee" value={assignmentValue} />
    <label className="block sm:col-span-2"><span className="field-label">Ghi chú xử lý / hướng dẫn</span>
      <textarea className="field-control min-h-20 px-3 py-2" name="assignment_note" maxLength={1000} defaultValue={incident.assignment_note ?? ""} required />
    </label>
    <button className="soft-button sm:col-span-2" disabled={busy || !role || (role !== "CLUB_MANAGER" && !selectedId)}>
      {incident.assigned_to ? "Cập nhật người phụ trách / ghi chú" : "Giao xử lý"}
    </button>
  </form>;
}

function today() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function shiftDays(iso: string, days: number) {
  const value = new Date(`${iso}T12:00:00`);
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function shiftYears(iso: string, years: number) {
  const value = new Date(`${iso}T12:00:00`);
  value.setFullYear(value.getFullYear() + years);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function requestError(reason: unknown) {
  if (reason instanceof ApiRequestError && reason.status === 401) {
    return "Máy chủ yêu cầu xác thực. Hãy đăng xuất, đăng nhập lại rồi tải lại mục này.";
  }
  return reason instanceof Error ? reason.message : "Không thể tải dữ liệu.";
}

export default function ClubManagerWorkspace() {
  const [date, setDate] = useState(today());
  const [tab] = useDashboardTab(workspaceTabIds, "overview");
  const [horses, setHorses] = useState<Option[]>([]);
  const [stables, setStables] = useState<Stable[]>([]);
  const [horseRequests, setHorseRequests] = useState<ManagerHorseRegistrationRequest[]>([]);
  const [requestStatusFilter, setRequestStatusFilter] = useState<HorseRegistrationStatusFilter>("PENDING");
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [grooms, setGrooms] = useState<Option[]>([]);
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentAssignees, setIncidentAssignees] = useState<IncidentAssignee[]>([]);
  const [incidentFilter, setIncidentFilter] = useState("Open");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [officialRaces, setOfficialRaces] = useState<OfficialRace[]>([]);
  const [competitionReport, setCompetitionReport] = useState<CompetitionReport | null>(null);
  const [loadErrors, setLoadErrors] = useState<LoadErrors>(EMPTY_ERRORS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (tab === "inventory") return;

    type FetchJob = {
      section: string;
      run: () => Promise<unknown>;
      apply: (value: unknown) => void;
    };

    const jobs: FetchJob[] = [];
    const add = (section: string, run: () => Promise<unknown>, apply: (value: unknown) => void) => {
      jobs.push({ section, run, apply });
    };

    if (tab === "overview" || tab === "finance") {
      add("Báo cáo vận hành", () => authenticatedRequest<Report>(`/api/club-manager/operations-report?from=${date}&to=${date}`), (v) => setReport(v as Report));
    }
    if (tab === "care") {
      add("Việc chăm sóc", () => authenticatedRequest<{ data: ManagerTask[] }>(`/api/club-manager/groom-tasks?date=${date}`), (v) => setTasks((v as { data: ManagerTask[] }).data));
      add("Danh sách Groom", () => authenticatedRequest<Option[]>("/api/club-manager/grooms"), (v) => setGrooms((v as Option[]).map((groom) => ({ ...groom, id: Number(groom.id) }))));
    }
    if (tab === "care" || tab === "finance" || tab === "horse-requests" || tab === "audit") {
      add("Danh sách ngựa", () => authenticatedRequest<{ items: Option[] }>("/api/horses?page=1&size=100&limit=100"), (v) => setHorses((v as { items: Option[] }).items.map((horse) => ({ ...horse, id: String(horse.id) }))));
    }
    if (tab === "incidents") {
      add("Sự cố Groom", () => authenticatedRequest<{ data: Incident[] }>(`/api/club-manager/groom-incidents?status=${incidentFilter}`), (v) => setIncidents((v as { data: Incident[] }).data));
      add("Người phụ trách sự cố", () => authenticatedRequest<{ data: IncidentAssignee[] }>("/api/club-manager/groom-incidents/assignees"), (v) => setIncidentAssignees((v as { data: IncidentAssignee[] }).data));
    }
    if (tab === "races") {
      add("Danh sách giải đấu", () => listOfficialRaces(), (v) => setOfficialRaces((v as { data: OfficialRace[] }).data));
      add("Báo cáo thành tích thi đấu", () => getCompetitionReport(), (v) => setCompetitionReport(v as CompetitionReport));
    }
    if (tab === "audit") {
      add("Nhật ký thao tác", () => authenticatedRequest<{ data: AuditRow[] }>(`/api/club-manager/audit-logs?from=${date}&to=${date}&page=1&limit=20`), (v) => setAudit((v as { data: AuditRow[] }).data));
    }
    if (tab === "horse-requests") {
      add("Yêu cầu hồ sơ ngựa", () => listHorseRegistrationRequests(requestStatusFilter), (v) => setHorseRequests(v as ManagerHorseRegistrationRequest[]));
      add("Danh sách chuồng", () => getHorseStables(), (v) => setStables(v as Stable[]));
    }

    const results = await Promise.allSettled(jobs.map((job) => job.run()));
    const tabErrors: LoadErrors[WorkspaceTab] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        jobs[index].apply(result.value);
      } else {
        tabErrors.push({ section: jobs[index].section, message: requestError(result.reason) });
      }
    });
    setLoadErrors((current) => ({ ...current, [tab]: tabErrors }));
  }, [tab, date, incidentFilter, requestStatusFilter]);

  useEffect(() => { void load(); }, [load]);
  useAutoRefresh(load, { enabled: !busy && tab !== "inventory", intervalMs: 25_000 });

  async function send(path: string, method: string, body?: Record<string, unknown>, success = "Đã lưu thay đổi."): Promise<boolean> {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await authenticatedRequest(path, { method, body: body ? JSON.stringify(body) : undefined });
      setNotice(success);
      await load();
      return true;
    } catch (reason) {
      setError(requestError(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function assignTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const saved = await send("/api/club-manager/groom-tasks", "POST", {
      horse_id: String(values.get("horse_id")), groom_id: Number(values.get("groom_id")),
      task_type: String(values.get("task_type")), task_date: String(values.get("task_date")),
    }, "Đã giao việc chăm sóc cho Groom.");
    if (saved) form.reset();
  }

  async function addFinancial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const saved = await send("/api/club-manager/financial-transactions", "POST", {
      horse_id: String(values.get("horse_id")), transaction_type: String(values.get("transaction_type")),
      amount: Number(values.get("amount")), billing_period: String(values.get("billing_period")),
    }, "Đã ghi nhận khoản thu chi cho Horse Owner.");
    if (saved) form.reset();
  }

  async function addOfficialRace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const saved = await send("/api/club-manager/races", "POST", {
      race_name: String(values.get("race_name")),
      race_date: String(values.get("race_date")),
      grade: String(values.get("grade") ?? "").trim() || null,
      distance_category: String(values.get("distance_category") ?? "").trim() || null,
      distance_meters: String(values.get("distance_meters") ?? "").trim() ? Number(values.get("distance_meters")) : null,
      location: String(values.get("location") ?? "").trim() || null,
      description: String(values.get("description") ?? "").trim() || null,
    }, "Đã thêm giải đấu chính thức.");
    if (saved) form.reset();
  }

  async function reviewHorseRequest(id: string, action: "APPROVE" | "REQUEST_INFORMATION" | "REJECT", form: HTMLFormElement): Promise<boolean> {
    const values = new FormData(form);
    const reviewNote = String(values.get("reviewNote") ?? "").trim();
    const setCardError = (message: string) => setCardErrors((current) => ({ ...current, [id]: message }));
    setCardError("");

    if (action !== "APPROVE" && !reviewNote) {
      setCardError(action === "REJECT" ? "Vui lòng nhập lý do từ chối." : "Vui lòng nêu rõ thông tin hoặc giấy tờ cần bổ sung.");
      const reviewNoteField = form.elements.namedItem("reviewNote");
      if (reviewNoteField instanceof HTMLElement) reviewNoteField.focus();
      return false;
    }

    const request = horseRequests.find((item) => item.id === id);
    const body: { action: "APPROVE" | "REQUEST_INFORMATION" | "REJECT"; stableBoxId?: string; horseId?: string; reviewNote?: string } = {
      action,
      reviewNote: reviewNote || undefined,
    };
    if (action === "APPROVE") {
      if (request?.request_type === "REGISTER") {
        const stableBoxId = String(values.get("stableBoxId") ?? "").trim();
        if (!stableBoxId) {
          setCardError("Vui lòng chọn chuồng trại cho hồ sơ ngựa mới.");
          return false;
        }
        body.stableBoxId = stableBoxId;
      }
      if (request?.request_type === "LINK") {
        const horseId = String(values.get("horseId") ?? "").trim();
        if (!horseId) {
          setCardError("Vui lòng chọn hồ sơ ngựa cần liên kết.");
          return false;
        }
        body.horseId = horseId;
      }
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await reviewHorseRegistrationRequest(id, body);
      setNotice(action === "APPROVE" ? "Đã duyệt hồ sơ; nếu ngựa đang có chủ, yêu cầu đang chờ chủ hiện tại xác nhận." : action === "REQUEST_INFORMATION" ? "Đã yêu cầu Horse Owner bổ sung thông tin." : "Đã từ chối yêu cầu và gửi lý do cho Horse Owner.");
      await load();
      return true;
    } catch (reason) {
      setCardError(requestError(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function assignIncident(event: FormEvent<HTMLFormElement>, incidentId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const assignee = String(values.get("assignee"));
    const [role, id] = assignee.split(":");
    const body: Record<string, unknown> = {
      assigned_role: role,
      assignment_note: String(values.get("assignment_note") ?? "").trim(),
    };
    if (role !== "CLUB_MANAGER") body.assignee_id = Number(id);
    const saved = await send(`/api/club-manager/groom-incidents/${incidentId}/assignment`, "PATCH", body,
      "Đã giao người phụ trách và gửi ghi chú xử lý.");
    if (saved) form.reset();
  }

  async function recordIncidentResult(event: FormEvent<HTMLFormElement>, incidentId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const saved = await send(`/api/club-manager/groom-incidents/${incidentId}/result`, "PATCH", {
      result_note: String(values.get("result_note") ?? "").trim(),
    }, "Đã ghi kết quả. Sự cố đang chờ Club Manager đóng.");
    if (saved) form.reset();
  }

  async function closeIncident(incidentId: string) {
    await send(`/api/club-manager/groom-incidents/${incidentId}/resolve`, "PATCH", undefined,
      "Đã đóng sự cố sau khi ghi nhận kết quả.");
  }

  const todayStr = today();
  const minReportDate = shiftYears(todayStr, -5);
  const maxReportDate = shiftDays(todayStr, 60);
  const minTaskDate = shiftDays(todayStr, -1);
  const defaultTaskDate = date >= minTaskDate && date <= maxReportDate ? date : todayStr;

  const dateApplies = tab === "overview" || tab === "care" || tab === "finance" || tab === "audit";

  return <section className="space-y-5" aria-label="Điều hành câu lạc bộ">
    {tab !== "inventory" && (
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-equine-line pb-4">
        {dateApplies && (
          <input aria-label="Ngày báo cáo" type="date" min={minReportDate} max={maxReportDate} className="field-control px-3" value={date} onChange={(event) => { const next = event.target.value; if (next) setDate(next); }} />
        )}
        <button type="button" className="soft-button" onClick={() => void load()} disabled={busy}><RefreshCw size={15} /> Làm mới</button>
      </div>
    )}

    {error && <Notice error>{error}</Notice>}
    {notice && <Notice>{notice}</Notice>}


    <div role="tabpanel" id={`manager-panel-${tab}`} className="space-y-5">
      {loadErrors[tab].map((item) => <Notice key={`${item.section}-${item.message}`} error>{item.section}: {item.message}</Notice>)}

      {tab === "overview" && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Activity} label="Buổi tập trong ngày" value={String(report?.scheduled_training_sessions ?? 0)} />
          <Metric icon={ClipboardList} label="Việc Groom hoàn thành" value={`${report?.groom_tasks.completed ?? 0}/${report?.groom_tasks.total ?? 0}`} />
          <Metric icon={ShieldCheck} label="Sự cố cần xử lý" value={String(report?.pending_incidents ?? incidents.length)} />
          <Metric icon={FileText} label="Trạng thái sức khỏe" value={(report?.horses_by_health_status ?? []).map((item) => `${managerHealthLabel(item.current_status)}: ${item.total}`).join(" · ") || "Chưa có dữ liệu"} />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Hiệu suất huấn luyện" icon={Activity}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric flat icon={Activity} label="Buổi đã lên lịch" value={String(report?.training_performance.scheduled ?? 0)} />
              <Metric flat icon={Activity} label="Đang diễn ra" value={String(report?.training_performance.in_progress ?? 0)} />
              <Metric flat icon={ShieldCheck} label="Hoàn tất / bị khóa" value={`${report?.training_performance.completed ?? 0} / ${report?.training_performance.blocked ?? 0}`} />
              <Metric flat icon={ClipboardList} label="Đã hủy" value={String(report?.training_performance.cancelled ?? 0)} />
              <Metric flat className="sm:col-span-2" icon={Package} label="Giải đấu đã đăng ký" value={String(report?.official_competition.registered ?? 0)} />
            </div>
          </Panel>
          <Panel title="Nhân sự đang hoạt động" icon={ShieldCheck}>
            <div className="space-y-2">
              {report?.approved_staff_by_role.map((item) => <div key={item.role_name} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium text-slate-700">{roleLabels[item.role_name as keyof typeof roleLabels] ?? item.role_name}</span><span className="font-semibold text-equine-navy tabular-nums">{item.total}</span></div>)}
              {!report?.approved_staff_by_role.length && <p className="text-sm text-slate-500">Chưa có dữ liệu nhân sự.</p>}
            </div>
          </Panel>
        </div>
      </>}

      {tab === "care" && <Panel title="Giao việc chăm sóc" icon={ClipboardList}>
        {horses.length === 0 || grooms.length === 0 ? <Notice error>Cần có hồ sơ ngựa và Groom đang hoạt động trước khi giao việc.</Notice> : <form onSubmit={assignTask} className="grid gap-3 sm:grid-cols-2">
          <Select name="horse_id" label="Ngựa" options={horses.map((horse) => [String(horse.id), horse.horse_name ?? ""] as [string, string])} />
          <Select name="groom_id" label="Groom" options={grooms.map((groom) => [String(groom.id), groom.full_name ?? ""] as [string, string])} />
          <Select name="task_type" label="Công việc" options={[["Feeding", "Cho ăn"], ["Cleaning", "Dọn chuồng"], ["Bathing", "Tắm"], ["IceBath", "Ngâm đá"]]} />
          <label className="block"><span className="field-label">Ngày</span><input className="field-control px-3" name="task_date" type="date" required min={minTaskDate} max={maxReportDate} defaultValue={defaultTaskDate} /></label>
          <div className="sm:col-span-2"><button className="gold-button" disabled={busy}><Plus size={15} /> Giao việc</button></div>
        </form>}
        <div className="mt-5 space-y-2">
          {tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <span className="font-medium text-equine-navy">{managerTaskTypeLabel(task.task_type)} · {task.horse_name}{task.groom_name ? ` · ${task.groom_name}` : ""}</span>
            <div className="flex items-center gap-2"><span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">{managerTaskStatusLabel(task.status)}</span>{task.status === "Pending" && <button type="button" className="soft-button h-8 px-2 text-xs text-rose-700" disabled={busy} onClick={() => void send(`/api/club-manager/groom-tasks/${task.id}`, "PATCH", { action: "Cancel" }, "Đã hủy công việc để có thể giao lại.")}>Hủy việc</button>}</div>
          </div>)}
          {!tasks.length && <p className="text-sm text-slate-500">Chưa giao việc trong ngày này.</p>}
        </div>
      </Panel>}

      {tab === "horse-requests" && <HorseRegistrationReviewPanel
        loadFailed={loadErrors["horse-requests"].some((item) => item.section === "Yêu cầu hồ sơ ngựa")}
        requests={horseRequests}
        stables={stables}
        statusFilter={requestStatusFilter}
        onStatusFilterChange={setRequestStatusFilter}
        cardErrors={cardErrors}
        onClearCardError={(id) => setCardErrors((current) => ({ ...current, [id]: "" }))}
        onCardError={(id, message) => setCardErrors((current) => ({ ...current, [id]: message }))}
        busy={busy}
        onReview={reviewHorseRequest}
      />}

      {tab === "inventory" && <InventoryManagerPanel />}
      {tab === "incidents" && <Panel title="Sự cố Groom" icon={AlertTriangle}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">

          <select aria-label="Lọc sự cố" className="field-control h-10 px-3" value={incidentFilter} onChange={(event) => setIncidentFilter(event.target.value)}>
            <option value="Open">Đang xử lý</option><option value="Resolved">Đã đóng</option><option value="All">Tất cả</option>
          </select>
        </div>
        <div className="space-y-3">
          {incidents.map((incident) => <article data-notification-target={incident.id} key={incident.id} className={`rounded-xl border p-4 ${incident.is_emergency ? "border-rose-300 bg-rose-50/50" : "border-equine-line bg-white"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-equine-navy">{incident.horse_name}{incident.groom_name ? ` · ${incident.groom_name}` : ""}</p>
                <p className="mt-1 text-xs text-slate-500">{formatDisplayDate(incident.created_at, true)}</p>
              </div>
              <div className="flex items-center gap-2"><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">{managerIncidentStatusLabel(incident.status)}</span>
                {incident.is_emergency && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-bold text-rose-800">KHẨN CẤP · ĐÃ BÁO BÁC SĨ</span>}
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{incident.issue_description}</p>
            <IncidentPhoto incidentId={incident.id} imageUrl={incident.image_url} />
            {incident.assignee_name && <p className="mt-3 text-sm font-semibold text-equine-navy">Phụ trách: {incident.assignee_name} · {incidentRoleLabels[incident.assigned_role ?? ""] ?? incident.assigned_role}</p>}
            {incident.assignment_note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-blue-50 p-3 text-sm text-blue-900"><strong>Ghi chú giao việc:</strong> {incident.assignment_note}</p>}
            {incident.result_note && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900"><strong>Kết quả xử lý:</strong> {incident.result_note}</p>}
            {(incident.status === "Pending" || incident.status === "InProgress") && <IncidentAssignmentForm
              incident={incident}
              assignees={incidentAssignees}
              busy={busy}
              onSubmit={assignIncident}
            />}
            {incident.status === "InProgress" && incident.assigned_role === "CLUB_MANAGER" && <form onSubmit={(event) => void recordIncidentResult(event, incident.id)} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <label className="block"><span className="field-label">Kết quả xử lý</span><textarea className="field-control min-h-20 px-3 py-2" name="result_note" maxLength={2000} required /></label>
              <button className="soft-button self-end" disabled={busy}>Ghi kết quả</button>
            </form>}
            {incident.status === "AwaitingClosure" && <button type="button" className="soft-button mt-3 border-emerald-200 bg-emerald-50 text-emerald-800" disabled={busy} onClick={() => void closeIncident(incident.id)}><ShieldCheck size={14} /> Đóng sự cố</button>}
          </article>)}
          {!incidents.length && <p className="text-sm text-slate-500">Không có sự cố ở bộ lọc này.</p>}
        </div>
      </Panel>}
      {tab === "races" && <ManagerRacesPanel
        date={date}
        officialRaces={officialRaces}
        competitionReport={competitionReport}
        busy={busy}
        onAddRace={addOfficialRace}
        onUpdateRace={async (raceId, input) => {
          setBusy(true);
          setError("");
          setNotice("");
          try {
            await updateOfficialRace(raceId, input);
            setNotice("Đã cập nhật thông tin giải đấu chính thức.");
            await load();
            return true;
          } catch (reason) {
            setError(requestError(reason));
            return false;
          } finally {
            setBusy(false);
          }
        }}
        onCancelRace={async (raceId, reason) => {
          setBusy(true);
          setError("");
          setNotice("");
          try {
            await cancelOfficialRace(raceId, reason);
            setNotice("Đã hủy giải đấu và giải phóng lịch cho các ngựa đã đăng ký.");
            await load();
            return true;
          } catch (err) {
            setError(requestError(err));
            return false;
          } finally {
            setBusy(false);
          }
        }}
        onCancelEntry={async (entryId, reason) => {
          setBusy(true);
          setError("");
          setNotice("");
          try {
            await cancelOfficialRaceEntry(entryId, reason);
            setNotice("Đã rút ngựa khỏi giải đấu và giải phóng lịch ngày đua.");
            await load();
            return true;
          } catch (err) {
            setError(requestError(err));
            return false;
          } finally {
            setBusy(false);
          }
        }}
      />}

      {tab === "finance" && <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Tổng hợp thu chi" icon={Wallet}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric flat icon={Wallet} label="Chi phí chăm sóc" value={money(report?.operating_costs_and_prize_income.care_cost)} />
            <Metric flat icon={Wallet} label="Chi phí y tế" value={money(report?.operating_costs_and_prize_income.medical_cost)} />
            <Metric flat icon={ShieldCheck} label="Tiền thưởng giải đấu" value={money(report?.operating_costs_and_prize_income.prize_income)} />
            <Metric flat icon={Activity} label="Khoản khác" value={money(report?.operating_costs_and_prize_income.other_amount)} />
            <Metric flat className="sm:col-span-2" icon={Activity} label="Kết quả thi đấu" value={`${report?.official_competition.completed ?? 0} hoàn thành`} />
          </div>
        </Panel>
        <Panel title="Ghi nhận khoản thu chi" icon={FileText}>
          {horses.length > 0 ? <form onSubmit={addFinancial} className="grid gap-3 sm:grid-cols-2">
            <Select name="horse_id" label="Ngựa" options={horses.map((horse) => [String(horse.id), horse.horse_name ?? ""] as [string, string])} />
            <Select name="transaction_type" label="Loại" options={[["Care", "Chăm sóc"], ["Medical", "Y tế"], ["Prize", "Tiền thưởng"], ["Other", "Khác"]]} />
            <label className="block"><span className="field-label">Số tiền</span><input className="field-control px-3" name="amount" type="number" min="0.01" step="0.01" required /></label>
            <label className="block"><span className="field-label">Kỳ thanh toán</span><input className="field-control px-3" name="billing_period" type="month" required defaultValue={date.slice(0, 7)} /></label>
            <div className="sm:col-span-2"><button className="gold-button" disabled={busy}><Wallet size={15} /> Ghi nhận</button></div>
          </form> : <p className="text-sm text-slate-500">Chưa có hồ sơ ngựa.</p>}
        </Panel>
      </div>}

      {tab === "audit" && <Panel title="Nhật ký thao tác" icon={History}>
        <div className="max-h-[620px] space-y-2 overflow-y-auto">
          {audit.map((entry) => <article key={entry.id} className="flex flex-col gap-1 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-normal text-equine-navy">{entry.action_performed}</p>
              <p className="mt-1 text-xs text-slate-500">{entry.user_name ?? entry.email ?? "Tài khoản đã xóa"} · {formatDisplayDate(entry.created_at, true)}</p>
            </div>
            <CompactId id={entry.id} />
          </article>)}
          {!audit.length && <p className="text-sm text-slate-500">Không có thao tác trong ngày này.</p>}
        </div>
      </Panel>}
    </div>
  </section>;
}

const AUDIT_ACTION_META: Record<string, { category: string; badgeCls: string; title: string }> = {
  SUBMIT_HORSE_REGISTRATION: { category: "Xét duyệt hồ sơ", badgeCls: "border-blue-200 bg-blue-50 text-blue-800", title: "Gửi yêu cầu đăng ký hồ sơ ngựa mới" },
  RESUBMIT_HORSE_REGISTRATION: { category: "Xét duyệt hồ sơ", badgeCls: "border-blue-200 bg-blue-50 text-blue-800", title: "Gửi bổ sung thông tin hồ sơ ngựa" },
  REQUEST_INFORMATION_HORSE_REGISTRATION: { category: "Xét duyệt hồ sơ", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Yêu cầu Chủ ngựa bổ sung hồ sơ đăng ký" },
  APPROVE_HORSE_REGISTRATION: { category: "Xét duyệt hồ sơ", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Phê duyệt hồ sơ đăng ký ngựa" },
  REJECT_HORSE_REGISTRATION: { category: "Xét duyệt hồ sơ", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Từ chối yêu cầu đăng ký hồ sơ ngựa" },
  APPROVE_HORSE_LINK_PENDING_OWNER_CONSENT: { category: "Xét duyệt hồ sơ", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Xác minh liên kết ngựa (chờ chủ hiện tại đồng ý)" },
  CONSENT_HORSE_OWNERSHIP_TRANSFER: { category: "Xét duyệt hồ sơ", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Đồng ý chuyển nhượng quyền sở hữu ngựa" },
  DECLINE_HORSE_OWNERSHIP_TRANSFER: { category: "Xét duyệt hồ sơ", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Từ chối chuyển nhượng quyền sở hữu ngựa" },
  UPLOAD_HORSE_IMAGE: { category: "Hồ sơ ngựa", badgeCls: "border-indigo-200 bg-indigo-50 text-indigo-800", title: "Tải ảnh hồ sơ ngựa lên hệ thống" },
  UPDATE_HORSE: { category: "Hồ sơ ngựa", badgeCls: "border-indigo-200 bg-indigo-50 text-indigo-800", title: "Cập nhật thông tin hồ sơ ngựa" },
  DELETE_HORSE: { category: "Hồ sơ ngựa", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Xóa hồ sơ ngựa" },
  CREATE_TRAINING_PLAN: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Tạo giáo án huấn luyện mới" },
  UPDATE_TRAINING_PLAN: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Cập nhật giáo án huấn luyện" },
  DELETE_TRAINING_PLAN: { category: "Huấn luyện", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Xóa giáo án huấn luyện" },
  CREATE_TRAINING_SCHEDULE: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Tạo buổi tập luyện mới" },
  UPDATE_TRAINING_SCHEDULE: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Cập nhật lịch tập luyện" },
  ASSIGN_TRAINING_GROOM: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Phân công Groom phụ trách buổi tập" },
  RECORD_TRAINING_METRICS: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Ghi nhận chỉ số thể chất sau buổi tập" },
  ADD_TRAINING_VIDEO: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Đính kèm video buổi tập" },
  APPROVE_STANDARD_DIET: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Duyệt khẩu phần ăn tiêu chuẩn" },
  UPDATE_STANDARD_DIET: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Cập nhật khẩu phần ăn tiêu chuẩn" },
  CREATE_RACE_SIMULATION: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Bắt đầu phiên mô phỏng buổi tập" },
  RESTART_LEGACY_TRAINING_SIMULATION: { category: "Huấn luyện", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Khởi động lại phiên mô phỏng buổi tập" },
  FINISH_RACE_SIMULATION: { category: "Huấn luyện", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Hoàn tất phiên mô phỏng buổi tập" },
  FINALIZE_TRAINING_SIMULATION: { category: "Huấn luyện", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Đồng bộ kết quả mô phỏng buổi tập" },
  RESET_AND_SEED_CLEAN_TRAINING_DATA: { category: "Huấn luyện", badgeCls: "border-slate-200 bg-slate-100 text-slate-700", title: "Khởi tạo lại dữ liệu giáo án & lịch tập chuẩn" },
  UPDATE_HEALTH_STATUS: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Cập nhật tình trạng sức khỏe ngựa" },
  LOCK_TRAINING: { category: "Thú y & Sức khỏe", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Khóa huấn luyện ngựa (yêu cầu nghỉ y tế)" },
  UNLOCK_TRAINING: { category: "Thú y & Sức khỏe", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Mở khóa huấn luyện cho ngựa" },
  CREATE_HEALTH_EXAM: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Tạo phiếu khám sức khỏe mới" },
  UPDATE_HEALTH_EXAM: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Cập nhật phiếu khám sức khỏe" },
  CREATE_MEDICAL_RECORD: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Tạo bệnh án điều trị mới" },
  UPDATE_MEDICAL_RECORD: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Cập nhật bệnh án điều trị" },
  CREATE_PRESCRIPTION: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Kê đơn thuốc mới" },
  UPDATE_PRESCRIPTION: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Cập nhật đơn thuốc" },
  CREATE_DIET_RECORD: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Tạo chế độ dinh dưỡng y tế" },
  UPDATE_DIET_RECORD: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Cập nhật chế độ dinh dưỡng y tế" },
  CREATE_INJURY_MARKER: { category: "Thú y & Sức khỏe", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Ghi nhận vị trí chấn thương mới" },
  CREATE_PERIODIC_CARE_SCHEDULE: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Tạo lịch chăm sóc y tế định kỳ" },
  BOOK_CARE_EVENT: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Đặt ca khám / chăm sóc y tế" },
  MOVE_CARE_EVENT: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Dời lịch khám / chăm sóc y tế" },
  CANCEL_CARE_EVENT: { category: "Thú y & Sức khỏe", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Hủy lịch khám / chăm sóc y tế" },
  COMPLETE_CARE_SCHEDULE: { category: "Thú y & Sức khỏe", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Hoàn thành lịch chăm sóc y tế" },
  REASSIGN_CARE_SCHEDULE: { category: "Thú y & Sức khỏe", badgeCls: "border-teal-200 bg-teal-50 text-teal-800", title: "Điều chuyển bác sĩ phụ trách lịch y tế" },
  ASSIGN_GROOM_TASK: { category: "Chăm sóc & Sự cố", badgeCls: "border-sky-200 bg-sky-50 text-sky-800", title: "Giao công việc chăm sóc chuồng trại" },
  REASSIGN_GROOM_TASK: { category: "Chăm sóc & Sự cố", badgeCls: "border-sky-200 bg-sky-50 text-sky-800", title: "Đổi Groom phụ trách công việc chăm sóc" },
  CANCEL_GROOM_TASK: { category: "Chăm sóc & Sự cố", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Hủy công việc chăm sóc" },
  COMPLETE_GROOM_TASK: { category: "Chăm sóc & Sự cố", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Hoàn thành công việc chăm sóc chuồng trại" },
  COMPLETE_GROOM_TRAINING_SESSION: { category: "Chăm sóc & Sự cố", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Groom xác nhận hoàn thành buổi tập" },
  REPORT_STABLE_INCIDENT: { category: "Chăm sóc & Sự cố", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Báo cáo sự cố chuồng trại mới" },
  CLAIM_EMERGENCY_STABLE_INCIDENT: { category: "Chăm sóc & Sự cố", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Tiếp nhận xử lý sự cố khẩn cấp" },
  ASSIGN_STABLE_INCIDENT: { category: "Chăm sóc & Sự cố", badgeCls: "border-sky-200 bg-sky-50 text-sky-800", title: "Phân công người xử lý sự cố chuồng trại" },
  SUBMIT_STABLE_INCIDENT_RESULT: { category: "Chăm sóc & Sự cố", badgeCls: "border-sky-200 bg-sky-50 text-sky-800", title: "Gửi báo cáo kết quả xử lý sự cố" },
  RESOLVE_STABLE_INCIDENT: { category: "Chăm sóc & Sự cố", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Đóng và xác nhận hoàn tất xử lý sự cố" },
  CREATE_INVENTORY_ITEM: { category: "Kho vật tư", badgeCls: "border-purple-200 bg-purple-50 text-purple-800", title: "Thêm danh mục vật tư mới vào kho" },
  UPDATE_INVENTORY_ITEM: { category: "Kho vật tư", badgeCls: "border-purple-200 bg-purple-50 text-purple-800", title: "Cập nhật thông tin vật tư" },
  DEACTIVATE_INVENTORY_ITEM: { category: "Kho vật tư", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Ngừng sử dụng danh mục vật tư" },
  INVENTORY_RECEIPT: { category: "Kho vật tư", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Nhập thêm vật tư vào kho" },
  INVENTORY_ADJUSTMENT: { category: "Kho vật tư", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Điều chỉnh kiểm kê số lượng kho" },
  INVENTORY_USAGE: { category: "Kho vật tư", badgeCls: "border-purple-200 bg-purple-50 text-purple-800", title: "Ghi nhận xuất dùng vật tư" },
  CREATE_SUPPLY_REQUEST: { category: "Kho vật tư", badgeCls: "border-purple-200 bg-purple-50 text-purple-800", title: "Gửi yêu cầu cấp phát vật tư" },
  REVIEW_SUPPLY_REQUEST: { category: "Kho vật tư", badgeCls: "border-purple-200 bg-purple-50 text-purple-800", title: "Xét duyệt yêu cầu cấp phát vật tư" },
  CREATE_OFFICIAL_RACE: { category: "Giải đấu", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Tạo giải đấu chính thức mới" },
  UPDATE_OFFICIAL_RACE: { category: "Giải đấu", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Cập nhật thông tin giải đấu" },
  CANCEL_OFFICIAL_RACE: { category: "Giải đấu", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Hủy giải đấu chính thức" },
  REGISTER_HORSE_RACE: { category: "Giải đấu", badgeCls: "border-amber-200 bg-amber-50 text-amber-800", title: "Đăng ký ngựa tham gia giải đấu" },
  CANCEL_HORSE_RACE: { category: "Giải đấu", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Rút ngựa khỏi danh sách thi đấu" },
  RESTORE_HORSE_RACE: { category: "Giải đấu", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Khôi phục đăng ký thi đấu cho ngựa" },
  RECORD_RACE_RESULT: { category: "Giải đấu", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Ghi nhận thứ hạng & giải thưởng thi đấu" },
  CREATE_FINANCIAL_TRANSACTION: { category: "Tài chính", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Ghi nhận giao dịch tài chính" },
  CREATE_STAFF_ACCOUNT: { category: "Tài khoản", badgeCls: "border-purple-200 bg-purple-50 text-purple-800", title: "Tạo tài khoản nhân sự mới" },
  APPROVE_USER: { category: "Tài khoản", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Phê duyệt tài khoản người dùng" },
  REJECT_USER: { category: "Tài khoản", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Từ chối tài khoản người dùng" },
  LOCK_USER: { category: "Tài khoản", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Khóa tài khoản người dùng" },
  UNLOCK_USER: { category: "Tài khoản", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Mở khóa tài khoản người dùng" },
  UPDATE_USER_ROLE: { category: "Tài khoản", badgeCls: "border-purple-200 bg-purple-50 text-purple-800", title: "Thay đổi vai trò tài khoản" },
  APPROVE_ROLE_CHANGE: { category: "Tài khoản", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Chấp thuận yêu cầu đổi vai trò" },
  REJECT_ROLE_CHANGE: { category: "Tài khoản", badgeCls: "border-rose-200 bg-rose-50 text-rose-800", title: "Từ chối yêu cầu đổi vai trò" },
  REQUEST_FORGOT_PASSWORD_OTP: { category: "Tài khoản", badgeCls: "border-slate-200 bg-slate-100 text-slate-700", title: "Yêu cầu mã OTP khôi phục mật khẩu" },
  RESET_PASSWORD_SUCCESS: { category: "Tài khoản", badgeCls: "border-emerald-200 bg-emerald-50 text-emerald-800", title: "Đặt lại mật khẩu thành công" },
  READ_NOTIFICATION: { category: "Thông báo", badgeCls: "border-slate-200 bg-slate-100 text-slate-600", title: "Đánh dấu đã đọc thông báo" },
  READ_ALL_NOTIFICATIONS: { category: "Thông báo", badgeCls: "border-slate-200 bg-slate-100 text-slate-600", title: "Đánh dấu đã đọc tất cả thông báo" },
};

function formatAuditAction(raw: string, horses: Option[], grooms: Option[]): { category: string; badgeCls: string; title: string; detail: string } {
  const trimmed = (raw ?? "").trim();
  const colonIdx = trimmed.indexOf(":");
  const code = (colonIdx >= 0 ? trimmed.slice(0, colonIdx) : trimmed).trim();
  const rest = colonIdx >= 0 ? trimmed.slice(colonIdx + 1).trim() : "";
  const meta = AUDIT_ACTION_META[code] ?? {
    category: "Hệ thống",
    badgeCls: "border-slate-200 bg-slate-100 text-slate-700",
    title: code.replace(/_/g, " "),
  };

  const horseNameById = (id: string) => {
    const clean = id.trim();
    const found = horses.find((h) => String(h.id).toLowerCase() === clean.toLowerCase());
    return found?.horse_name ? `Ngựa: ${found.horse_name}` : null;
  };
  const groomNameById = (id: string) => {
    const found = grooms.find((g) => String(g.id) === id.trim());
    return found?.full_name ? found.full_name : `Groom #${id.trim()}`;
  };

  if (!rest) return { ...meta, detail: "" };

  if (code === "UPLOAD_HORSE_IMAGE") {
    return { ...meta, detail: "Đã lưu tệp hình ảnh lên dịch vụ lưu trữ đám mây" };
  }
  if (code === "UPDATE_HORSE" || code === "DELETE_HORSE") {
    return { ...meta, detail: horseNameById(rest) ?? `Mã hồ sơ: #${rest.slice(0, 8)}` };
  }
  if (code === "APPROVE_HORSE_REGISTRATION" || code === "APPROVE_HORSE_LINK_PENDING_OWNER_CONSENT") {
    const parts = rest.split("->").map((s) => s.trim());
    const horseLabel = parts[1] ? horseNameById(parts[1]) : null;
    return { ...meta, detail: horseLabel ?? (parts[0] ? `Mã đơn: #${parts[0].slice(0, 8)}` : "") };
  }
  if (code.endsWith("_HORSE_REGISTRATION") || code.endsWith("_HORSE_OWNERSHIP_TRANSFER")) {
    return { ...meta, detail: `Mã đơn yêu cầu: #${rest.slice(0, 8)}` };
  }
  if (code === "UPDATE_HEALTH_STATUS") {
    // Format: <horseId>:<old>-><new>:<reason>
    const parts = rest.split(":");
    const hName = parts[0] ? (horseNameById(parts[0]) ?? `Ngựa #${parts[0].slice(0, 8)}`) : "";
    const transition = (parts[1] ?? "")
      .replace(/Healthy/g, "Khỏe mạnh")
      .replace(/Injured/g, "Chấn thương")
      .replace(/Quarantine/g, "Cách ly")
      .replace(/Monitoring/g, "Cần theo dõi")
      .replace(/->/g, " → ");
    const note = parts.slice(2).join(":").trim();
    return {
      ...meta,
      detail: [hName, transition, note].filter(Boolean).join(" · "),
    };
  }
  if (code === "LOCK_TRAINING" || code === "UNLOCK_TRAINING") {
    const parts = rest.split(":");
    const hName = parts[0] ? (horseNameById(parts[0]) ?? `Ngựa #${parts[0].slice(0, 8)}`) : "";
    const extra = parts.slice(1).join(":").trim();
    return { ...meta, detail: [hName, extra].filter(Boolean).join(" · ") };
  }
  if (code === "UPDATE_TRAINING_PLAN") {
    const firstColon = rest.indexOf(":");
    if (firstColon >= 0) {
      const jsonPart = rest.slice(firstColon + 1).trim();
      try {
        const parsed = JSON.parse(jsonPart) as Record<string, unknown>;
        const labels: Record<string, string> = {
          stage_name: "Giai đoạn",
          target_intensity: "Cường độ",
          target_distance_meters: "Cự ly mục tiêu (m)",
          target_duration_minutes: "Thời lượng (phút)",
          start_date: "Ngày bắt đầu",
          end_date: "Ngày kết thúc",
        };
        const summary = Object.entries(parsed)
          .map(([k, v]) => `${labels[k] ?? k}: ${String(v)}`)
          .join(" · ");
        if (summary) return { ...meta, detail: summary };
      } catch { /* ignore JSON parse error */ }
    }
    return { ...meta, detail: "" };
  }
  if (code === "RESET_AND_SEED_CLEAN_TRAINING_DATA") {
    const m = rest.match(/plans=(\d+),schedules=(\d+)/);
    if (m) return { ...meta, detail: `Tạo mới ${m[1]} giáo án và ${m[2]} buổi tập mẫu` };
  }
  if (code === "ASSIGN_GROOM_TASK" || code === "REASSIGN_GROOM_TASK") {
    const parts = rest.split(" to ");
    if (parts[1]) return { ...meta, detail: `Người nhận việc: ${groomNameById(parts[1])}` };
  }
  if (code === "ASSIGN_TRAINING_GROOM") {
    const parts = rest.split(":");
    if (parts[1]) return { ...meta, detail: `Người phụ trách: ${groomNameById(parts[1])}` };
  }
  if (code === "ASSIGN_STABLE_INCIDENT") {
    const parts = rest.split(" to ");
    if (parts[1]) {
      const [rName, uid] = parts[1].split(":");
      const roleLabel = incidentRoleLabels[rName] ?? rName;
      return { ...meta, detail: `Giao cho: ${roleLabel}${uid ? ` (#${uid})` : ""}` };
    }
  }
  if (code === "CREATE_FINANCIAL_TRANSACTION") {
    const parts = rest.split(" for ");
    const hName = parts[1] ? horseNameById(parts[1]) : null;
    return { ...meta, detail: hName ?? "" };
  }
  if (code === "RECORD_RACE_RESULT") {
    const m = rest.match(/position=(\d+)/);
    if (m) return { ...meta, detail: `Kết quả: Hạng #${m[1]}` };
  }
  if (code === "UPDATE_USER_ROLE") {
    const m = rest.match(/^(\d+)\s+(\S+)\s*->\s*(\S+)$/);
    if (m) {
      const fromLabel = roleLabels[m[2] as keyof typeof roleLabels] ?? m[2];
      const toLabel = roleLabels[m[3] as keyof typeof roleLabels] ?? m[3];
      return { ...meta, detail: `Tài khoản #${m[1]}: ${fromLabel} → ${toLabel}` };
    }
  }
  if (code === "CREATE_STAFF_ACCOUNT") {
    const m = rest.match(/^(\d+)\s+(\S+)$/);
    if (m) {
      const rLabel = roleLabels[m[2] as keyof typeof roleLabels] ?? m[2];
      return { ...meta, detail: `Tài khoản #${m[1]} · Vai trò: ${rLabel}` };
    }
  }
  if (code === "LOCK_USER" || code === "REJECT_USER") {
    const dashIdx = rest.indexOf(" - ");
    if (dashIdx >= 0) {
      return { ...meta, detail: `Tài khoản #${rest.slice(0, dashIdx).trim()} · Lý do: ${rest.slice(dashIdx + 3).trim()}` };
    }
    return { ...meta, detail: `Tài khoản #${rest}` };
  }
  if (code === "APPROVE_USER" || code === "UNLOCK_USER") {
    return { ...meta, detail: `Tài khoản #${rest}` };
  }
  if (code === "REVIEW_SUPPLY_REQUEST") {
    const parts = rest.split(":");
    const st = parts[1] === "Approved" ? "Đã duyệt cấp phát" : parts[1] === "Rejected" ? "Từ chối cấp phát" : parts[1];
    return { ...meta, detail: st ?? "" };
  }
  if (code === "INVENTORY_RECEIPT" || code === "INVENTORY_USAGE") {
    const parts = rest.split(":");
    if (parts[1]) return { ...meta, detail: `Số lượng: ${parts[1]}` };
  }
  if (code === "INVENTORY_ADJUSTMENT") {
    const parts = rest.split(":");
    if (parts.length >= 2) {
      return { ...meta, detail: `Chênh lệch: ${parts[1]}${parts[2] ? ` · Lý do: ${parts.slice(2).join(":")}` : ""}` };
    }
  }
  // If rest is just a raw UUID, hide the raw 36-char UUID clutter or show a compact 6-char ref
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rest)) {
    return { ...meta, detail: horseNameById(rest) ?? `Mã tham chiếu: #${rest.slice(0, 6)}` };
  }
  return { ...meta, detail: rest };
}

function Metric({
  icon: Icon,
  label,
  value,
  flat = false,
  className = "",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  flat?: boolean;
  className?: string;
}) {
  if (flat) {
    return (
      <div className={`rounded-lg bg-slate-50 p-3.5 transition-colors ${className}`}>
        <div className="flex items-center gap-2">
          <Icon size={16} className="shrink-0 text-equine-teal" />
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        </div>
        <p className="mt-2 text-lg font-semibold text-equine-navy tabular-nums">{value}</p>
      </div>
    );
  }
  return (
    <div className={`rounded-lg border border-equine-line bg-white p-4 shadow-sm ${className}`}>
      <Icon size={18} className="text-equine-teal" />
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-equine-navy tabular-nums">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: ReactNode }) {
  return <section className="rounded-lg border border-equine-line bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><Icon size={18} />{title}</h2>{children}</section>;
}

const registrationFilterOptions: { value: HorseRegistrationStatusFilter; label: string }[] = [
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "NEEDS_INFORMATION", label: "Cần bổ sung" },
  { value: "AWAITING_OWNER_CONSENT", label: "Chờ chủ xác nhận" },
  { value: "APPROVED", label: "Đã duyệt" },
  { value: "REJECTED", label: "Đã từ chối" },
  { value: "ALL", label: "Tất cả" },
];

const registrationStatusBadge: Record<ManagerHorseRegistrationRequest["status"], { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "bg-sky-50 text-sky-700 border-sky-200" },
  NEEDS_INFORMATION: { label: "Cần bổ sung", cls: "bg-amber-50 text-amber-800 border-amber-200" },
  AWAITING_OWNER_CONSENT: { label: "Chờ chủ hiện tại xác nhận", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  APPROVED: { label: "Đã duyệt", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Đã từ chối", cls: "bg-rose-50 text-rose-700 border-rose-200" },
};

function LinkHorsePicker({
  request,
  onSelectHorse,
}: {
  request: ManagerHorseRegistrationRequest;
  onSelectHorse: (horse: Horse | null) => void;
}) {
  const initialTerm = request.microchip_number || request.passport_number || request.horse_name;
  const [search, setSearch] = useState(initialTerm);
  const [results, setResults] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedHorse, setSelectedHorse] = useState<Horse | null>(null);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void listHorses({ search: search.trim() || undefined, page: 1, size: 20 })
        .then((res) => { if (active) setResults(res.items); })
        .catch(() => { if (active) setResults([]); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search]);

  function choose(horse: Horse | null) {
    setSelectedHorse(horse);
    onSelectHorse(horse);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="horseId" value={selectedHorse?.id ?? ""} />
      <label className="block">
        <span className="field-label">Tìm & chọn hồ sơ ngựa cần liên kết <span className="text-rose-600">*</span></span>
        <input
          type="search"
          className="field-control bg-white px-3"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo tên, giống, microchip hoặc hộ chiếu..."
        />
      </label>

      {selectedHorse && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
          <div>
            <strong>Đã chọn: {selectedHorse.horse_name}</strong>
            <span className="ml-1.5 text-emerald-800">
              {selectedHorse.breed ? `· ${selectedHorse.breed}` : ""}
              {selectedHorse.microchip_number ? ` · Chip ${selectedHorse.microchip_number}` : ""}
              {selectedHorse.passport_number ? ` · HC ${selectedHorse.passport_number}` : ""}
              {selectedHorse.owner_name ? ` · Chủ hiện tại: ${selectedHorse.owner_name}` : " · Chưa có chủ"}
            </span>
          </div>
          <button type="button" className="font-semibold text-emerald-900 underline" onClick={() => choose(null)}>Đổi ngựa</button>
        </div>
      )}

      <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100" role="listbox" aria-label="Danh sách ngựa tìm được">
        {loading && <p className="px-3 py-2.5 text-xs text-slate-500">Đang tìm hồ sơ ngựa…</p>}
        {!loading && results.length === 0 && (
          <p className="px-3 py-2.5 text-xs text-slate-500">Không tìm thấy hồ sơ ngựa khớp từ khóa.</p>
        )}
        {!loading && results.map((horse) => {
          const sameOwner = horse.owner_id != null && horse.owner_id === request.owner_id;
          const chipMatch = Boolean(request.microchip_number && horse.microchip_number && request.microchip_number.trim().toLowerCase() === horse.microchip_number.trim().toLowerCase());
          const passMatch = Boolean(request.passport_number && horse.passport_number && request.passport_number.trim().toLowerCase() === horse.passport_number.trim().toLowerCase());
          const selected = selectedHorse?.id === horse.id;
          return (
            <button
              key={horse.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={sameOwner}
              onClick={() => choose(horse)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition ${
                sameOwner ? "bg-slate-50 opacity-60 cursor-not-allowed" : selected ? "bg-teal-50" : "hover:bg-slate-50"
              }`}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">
                  {horse.horse_name}
                  {horse.breed ? ` · ${horse.breed}` : ""}
                  {horse.birth_year ? ` (${horse.birth_year})` : ""}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {horse.microchip_number ? `Chip: ${horse.microchip_number} · ` : ""}
                  {horse.passport_number ? `HC: ${horse.passport_number} · ` : ""}
                  {horse.owner_name ? `Chủ: ${horse.owner_name}` : "Chưa có chủ"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {(chipMatch || passMatch) && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">Khớp mã định danh</span>
                )}
                {sameOwner && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">Đã thuộc người gửi</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">Nếu hồ sơ đã có chủ khác, sau khi duyệt yêu cầu sẽ gửi thông báo chờ chủ hiện tại xác nhận.</p>
    </div>
  );
}

function HorseRegistrationReviewPanel({
  requests,
  loadFailed,
  stables,
  statusFilter,
  onStatusFilterChange,
  cardErrors,
  onClearCardError,
  onCardError,
  busy,
  onReview,
}: {
  requests: ManagerHorseRegistrationRequest[];
  stables: Stable[];
  loadFailed: boolean;
  statusFilter: HorseRegistrationStatusFilter;
  onStatusFilterChange: (next: HorseRegistrationStatusFilter) => void;
  cardErrors: Record<string, string>;
  onClearCardError: (id: string) => void;
  onCardError: (id: string, message: string) => void;
  busy: boolean;
  onReview: (id: string, action: "APPROVE" | "REQUEST_INFORMATION" | "REJECT", form: HTMLFormElement) => Promise<boolean>;
}) {
  const [selectedLinkHorses, setSelectedLinkHorses] = useState<Record<string, Horse | null>>({});
  const [confirmState, setConfirmState] = useState<{
    request: ManagerHorseRegistrationRequest;
    action: "APPROVE" | "REJECT";
    form: HTMLFormElement;
    summary: string;
  } | null>(null);

  function requestDecision(request: ManagerHorseRegistrationRequest, action: "APPROVE" | "REJECT", form: HTMLFormElement) {
    onClearCardError(request.id);
    const values = new FormData(form);
    if (action === "REJECT") {
      const note = String(values.get("reviewNote") ?? "").trim();
      if (!note) {
        onCardError(request.id, "Vui lòng nhập lý do từ chối.");
        const reviewNoteField = form.elements.namedItem("reviewNote");
        if (reviewNoteField instanceof HTMLElement) reviewNoteField.focus();
        return;
      }
      setConfirmState({
        request,
        action,
        form,
        summary: `Từ chối vĩnh viễn yêu cầu "${request.horse_name}" của ${request.owner_name}? Trạng thái Đã từ chối không thể mở lại; chủ ngựa sẽ phải gửi yêu cầu mới nếu cần.`,
      });
      return;
    }

    if (request.request_type === "REGISTER") {
      const stableId = String(values.get("stableBoxId") ?? "").trim();
      if (!stableId) {
        onCardError(request.id, "Vui lòng chọn chuồng trại còn trống trước khi duyệt.");
        return;
      }
      const chosenStable = stables.find((item) => item.id === stableId);
      setConfirmState({
        request,
        action,
        form,
        summary: `Xác nhận duyệt và tạo hồ sơ ngựa mới "${request.horse_name}" cho ${request.owner_name}, xếp vào chuồng ${chosenStable ? `${chosenStable.box_code} · ${chosenStable.section}` : stableId}?`,
      });
      return;
    }

    const horseId = String(values.get("horseId") ?? "").trim();
    if (!horseId) {
      onCardError(request.id, "Vui lòng chọn hồ sơ ngựa cần liên kết trước khi duyệt.");
      return;
    }
    const targetHorse = selectedLinkHorses[request.id];
    const transferNotice = targetHorse?.owner_id
      ? ` Hồ sơ đang thuộc ${targetHorse.owner_name ?? "chủ hiện tại"}; hệ thống sẽ gửi yêu cầu chờ chủ hiện tại xác nhận chuyển quyền.`
      : " Hồ sơ chưa có chủ; quyền sở hữu sẽ được gán ngay cho người gửi yêu cầu.";
    setConfirmState({
      request,
      action,
      form,
      summary: `Xác nhận duyệt liên kết yêu cầu "${request.horse_name}" của ${request.owner_name} với hồ sơ "${targetHorse?.horse_name ?? horseId}"?${transferNotice}`,
    });
  }

  return (
    <Panel title={`Yêu cầu hồ sơ ngựa · ${requests.length} hồ sơ`} icon={FileText}>
      <div className="mb-5 flex flex-wrap gap-2">
        {registrationFilterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onStatusFilterChange(option.value)}
            className={statusFilter === option.value ? "workspace-tab is-active" : "workspace-tab"}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {requests.map((request) => {
          const badge = registrationStatusBadge[request.status];
          return (
            <article data-notification-target={request.id} key={request.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
              {/* Header Dossier */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-sans text-xl font-bold text-slate-900">{request.horse_name}</h3>
                    <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                      {request.request_type === "LINK" ? "Yêu cầu liên kết" : "Đăng ký hồ sơ mới"}
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {request.revision_no > 1 && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Bổ sung lần {request.revision_no}
                      </span>
                    )}
                    <CompactId id={request.id} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Thời gian gửi: {formatDisplayDate(request.created_at, true)}
                  </p>
                </div>

                {/* Owner info chip */}
                <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs">
                  <div className="grid size-8 place-items-center rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-200">
                    {request.owner_name ? request.owner_name.charAt(0).toUpperCase() : "U"}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{request.owner_name}</p>
                    <p className="text-[11px] text-slate-500">{request.owner_email}</p>
                  </div>
                </div>
              </div>

              {/* Dossier Body */}
              <div className="mt-4 grid gap-5 lg:grid-cols-[240px_1fr]">
                {/* Photo or thumbnail */}
                <div>
                  {request.horse_image_url ? (
                    <div className="h-44 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <HorseImage
                        horse={{ id: request.id, horse_name: request.horse_name, image_url: request.horse_image_url } as Horse}
                        preview={request.horse_image_url}
                      />
                    </div>
                  ) : (
                    <div className="grid h-44 w-full place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
                      Không có ảnh đính kèm
                    </div>
                  )}
                </div>

                {/* Specs Details */}
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Giống</span>
                      <strong className="block text-xs font-semibold text-slate-800 mt-0.5">{request.breed || "Chưa cập nhật"}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Giới tính</span>
                      <strong className="block text-xs font-semibold text-slate-800 mt-0.5">{horseGender(request.gender) || "Chưa cập nhật"}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Năm sinh</span>
                      <strong className="block text-xs font-semibold text-slate-800 mt-0.5">{request.birth_year ?? "—"}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Chiều cao</span>
                      <strong className="block text-xs font-semibold text-slate-800 mt-0.5">{request.height_cm ? `${request.height_cm} cm` : "—"}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Cân nặng</span>
                      <strong className="block text-xs font-semibold text-slate-800 mt-0.5">{request.current_weight_kg ? `${request.current_weight_kg} kg` : "—"}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Số Microchip</span>
                      <strong className="block text-xs font-semibold text-slate-800 mt-0.5">{request.microchip_number || "Chưa có"}</strong>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Số hộ chiếu</span>
                      <strong className="block text-xs font-semibold text-slate-800 mt-0.5">{request.passport_number || "Chưa có"}</strong>
                    </div>
                  </div>

                  {(request.pedigree_father || request.pedigree_mother) && (
                    <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-xs">
                      <span className="block text-[11px] font-medium uppercase tracking-wider text-slate-400">Phả hệ (Sire / Dam)</span>
                      <strong className="block font-semibold text-slate-800 mt-0.5">
                        {[request.pedigree_father, request.pedigree_mother].filter(Boolean).join("  /  ") || "Chưa cập nhật"}
                      </strong>
                    </div>
                  )}

                  {/* Owner Note */}
                  {request.owner_note && (
                    <div className="rounded-lg bg-amber-50/70 border border-amber-200/80 p-3 text-xs">
                      <span className="font-semibold text-amber-900 block mb-0.5">Ghi chú từ chủ sở hữu:</span>
                      <p className="text-amber-800 leading-relaxed whitespace-pre-wrap">{request.owner_note}</p>
                    </div>
                  )}

                  {/* Review Note when present */}
                  {request.review_note && (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs">
                      <span className="font-semibold text-slate-800 block mb-0.5">Ghi chú xét duyệt gần nhất:</span>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{request.review_note}</p>
                    </div>
                  )}

                  {/* Documents */}
                  {request.documents.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Hồ sơ & giấy tờ kiểm định ({request.documents.length})
                      </span>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {request.documents.map((document) => (
                          <div key={document.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="grid size-6 shrink-0 place-items-center rounded bg-slate-100 text-teal-700">
                                <FileText size={13} />
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800" title={document.name}>{document.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {documentTypeLabel(document.document_type)} · Lần {document.revision_no}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void openFreshDocument(() => getManagerRegistrationDocumentUrl(request.id, document.id), document.url)}
                              className="shrink-0 soft-button !min-h-[26px] !px-2.5 !text-[11px]"
                            >
                              Xem <ExternalLink size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* History timeline */}
                  {request.history?.length > 0 && (
                    <details open={request.revision_no > 1} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs">
                      <summary className="cursor-pointer font-semibold text-slate-700 select-none">
                        Lịch sử xử lý ({request.history.length} bước)
                      </summary>
                      <ol className="mt-2.5 ml-2 space-y-2 border-l border-slate-200 pl-3">
                        {request.history.map((entry) => (
                          <li key={entry.id} className="relative">
                            <span className="absolute -left-[17px] top-1 size-2 rounded-full bg-teal-600 ring-2 ring-white" />
                            <p className="font-semibold text-slate-800">{registrationHistoryLabel(entry.action)} (Lần {entry.revision_no})</p>
                            <p className="text-[11px] text-slate-400">{formatDisplayDate(entry.created_at, true)}</p>
                            {entry.note && (
                              <p className="mt-1 rounded border border-slate-200 bg-white p-2 text-slate-700 whitespace-pre-wrap">{entry.note}</p>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                </div>
              </div>

              {/* Review & Decision Box */}
              {request.status === "PENDING" && (
                <form className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                    <CheckCircle2 size={16} className="text-teal-700" />
                    <h4 className="font-sans text-sm font-bold text-slate-900">Quyết định phê duyệt của Quản lý</h4>
                  </div>

                  {cardErrors[request.id] && <Notice error>{cardErrors[request.id]}</Notice>}

                  <div className="grid gap-3 lg:grid-cols-2">
                    {request.request_type === "REGISTER" ? (
                      <label className="block">
                        <span className="field-label">Xếp chuồng trại khi tạo hồ sơ <span className="text-rose-600">*</span></span>
                        <select
                          className="field-control px-3 bg-white"
                          name="stableBoxId"
                          defaultValue=""
                          required
                          disabled={!stables.length}
                          onChange={() => onClearCardError(request.id)}
                        >
                          <option value="">-- Chọn chuồng trại còn trống --</option>
                          {stables.map((stable) => {
                            const free = Math.max(0, stable.capacity - stable.occupied);
                            return (
                              <option key={stable.id} value={stable.id}>
                                {stable.box_code} · {stable.section} ({stable.occupied}/{stable.capacity} · còn {free} chỗ)
                              </option>
                            );
                          })}
                        </select>
                        {!stables.length && (
                          <p className="mt-1 text-xs text-rose-600">Không có chuồng còn chỗ; hãy thêm chuồng trước khi duyệt.</p>
                        )}
                      </label>
                    ) : (
                      <LinkHorsePicker
                        request={request}
                        onSelectHorse={(horse) => {
                          onClearCardError(request.id);
                          setSelectedLinkHorses((current) => ({ ...current, [request.id]: horse }));
                        }}
                      />
                    )}

                    <label className="block">
                      <span className="field-label">Ghi chú duyệt / Lý do từ chối</span>
                      <textarea
                        className="field-control min-h-[42px] max-h-32 px-3 py-2 bg-white"
                        name="reviewNote"
                        maxLength={1000}
                        rows={2}
                        placeholder="Nhập lý do khi yêu cầu bổ sung hoặc từ chối..."
                        onChange={() => onClearCardError(request.id)}
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      className="soft-button !min-h-[36px] !px-4 !text-xs !border-rose-200 !bg-rose-50 !text-rose-700 hover:!bg-rose-100"
                      disabled={busy}
                      onClick={(event) => {
                        const form = event.currentTarget.form;
                        if (form) requestDecision(request, "REJECT", form);
                      }}
                    >
                      <XCircle size={14} /> Từ chối hồ sơ
                    </button>
                    <button
                      type="button"
                      className="soft-button !min-h-[36px] !px-4 !text-xs !border-sky-200 !bg-sky-50 !text-sky-700 hover:!bg-sky-100"
                      disabled={busy}
                      onClick={(event) => {
                        const form = event.currentTarget.form;
                        if (form) void onReview(request.id, "REQUEST_INFORMATION", form);
                      }}
                    >
                      <AlertCircle size={14} /> Yêu cầu bổ sung
                    </button>
                    <button
                      type="button"
                      className="gold-button !min-h-[36px] !px-4 !text-xs"
                      disabled={busy || (request.request_type === "REGISTER" && !stables.length)}
                      onClick={(event) => {
                        const form = event.currentTarget.form;
                        if (form) requestDecision(request, "APPROVE", form);
                      }}
                    >
                      <CheckCircle2 size={14} /> Duyệt và {request.request_type === "LINK" ? "liên kết hồ sơ" : "tạo hồ sơ"}
                    </button>
                  </div>
                </form>
              )}
            </article>
          );
        })}
        {!loadFailed && !requests.length && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-sm text-slate-500">
            <CheckCircle2 size={24} className="mx-auto text-emerald-500 mb-2" />
            <p className="font-semibold text-slate-700">Không có yêu cầu nào ở bộ lọc này</p>
            <p className="mt-1 text-xs text-slate-400">Chọn trạng thái khác phía trên để xem các hồ sơ đã xử lý hoặc đang chờ bổ sung.</p>
          </div>
        )}
      </div>

      {confirmState && (
        <Modal
          title={confirmState.action === "REJECT" ? "Xác nhận từ chối hồ sơ" : "Xác nhận phê duyệt hồ sơ"}
          busy={busy}
          onClose={() => setConfirmState(null)}
        >
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-slate-700">{confirmState.summary}</p>
            <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-3">
              <button type="button" className="soft-button !text-xs" disabled={busy} onClick={() => setConfirmState(null)}>
                Quay lại
              </button>
              <button
                type="button"
                className={confirmState.action === "REJECT" ? "danger-button !text-xs" : "gold-button !text-xs"}
                disabled={busy}
                onClick={async () => {
                  const current = confirmState;
                  setConfirmState(null);
                  await onReview(current.request.id, current.action, current.form);
                }}
              >
                {busy ? "Đang xử lý…" : confirmState.action === "REJECT" ? "Xác nhận từ chối" : "Xác nhận duyệt"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Panel>
  );
}

function registrationHistoryLabel(action: string) {
  switch (action) {
    case "SUBMITTED": return "Chủ ngựa đã gửi hồ sơ";
    case "RESUBMITTED": return "Chủ ngựa đã gửi bổ sung";
    case "NEEDS_INFORMATION": return "Club Manager yêu cầu bổ sung";
    case "REVIEW_APPROVED": return "Club Manager đã xác minh";
    case "REJECTED": return "Đã từ chối hồ sơ";
    case "OWNER_CONSENT": return "Chủ hiện tại đã đồng ý chuyển quyền";
    case "OWNER_DECLINED": return "Chủ hiện tại từ chối chuyển quyền";
    default: return action;
  }
}



function documentTypeLabel(type: string) {
  switch (type) {
    case "OWNERSHIP_PROOF": return "Chứng minh sở hữu";
    case "HORSE_CERTIFICATE": return "Chứng nhận ngựa";
    case "HEALTH_DOCUMENT": return "Hồ sơ sức khỏe";
    default: return "Tài liệu khác";
  }
}

function Select({ name, label, options }: { name: string; label: string; options: [string, string][] }) {
  return <label className="block"><span className="field-label">{label}</span><select className="field-control px-3" name={name} required>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function money(value: number | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value ?? 0);
}

function managerRaceEntryStatusLabel(status: string) {
  return ({
    Registered: "Đã đăng ký",
    Blocked: "Tạm khóa y tế",
    Completed: "Đã hoàn thành",
    Cancelled: "Đã rút / Hủy",
  } as Record<string, string>)[status] ?? status;
}

function managerHealthLabel(status: string) {
  return ({
    Healthy: "Khỏe mạnh",
    Monitoring: "Đang theo dõi",
    Injured: "Chấn thương",
    Quarantine: "Cách ly",
  } as Record<string, string>)[status] ?? status;
}

function managerTaskTypeLabel(type: string) {
  return ({
    Feeding: "Cho ăn",
    Cleaning: "Dọn chuồng",
    Bathing: "Tắm rửa",
    IceBath: "Ngâm đá",
  } as Record<string, string>)[type] ?? type;
}

function managerTaskStatusLabel(status: string) {
  return ({
    Pending: "Đang chờ",
    Completed: "Hoàn thành",
    Cancelled: "Đã hủy",
  } as Record<string, string>)[status] ?? status;
}

function managerIncidentStatusLabel(status: string) {
  return ({
    Pending: "Chờ phân công",
    InProgress: "Đang xử lý",
    AwaitingClosure: "Chờ đóng",
    Resolved: "Đã đóng",
  } as Record<string, string>)[status] ?? status;
}

function managerReadinessLabel(status: string) {
  return ({
    Ready: "Sẵn sàng",
    NotReady: "Chưa sẵn sàng",
    Unknown: "Chưa đánh giá",
  } as Record<string, string>)[status] ?? status;
}

function formatManagerRaceDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

type ManagerRaceFilter = "ALL" | "SCHEDULED" | "COMPLETED" | "CANCELLED";

function ManagerRacesPanel({
  date,
  officialRaces,
  competitionReport,
  busy,
  onAddRace,
  onUpdateRace,
  onCancelRace,
  onCancelEntry,
}: {
  date: string;
  officialRaces: OfficialRace[];
  competitionReport: CompetitionReport | null;
  busy: boolean;
  onAddRace: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUpdateRace: (raceId: string, input: {
    race_name?: string;
    race_date?: string;
    grade?: string | null;
    distance_category?: string | null;
    distance_meters?: number | null;
    location?: string | null;
    description?: string | null;
  }) => Promise<boolean>;
  onCancelRace: (raceId: string, reason: string) => Promise<boolean>;
  onCancelEntry: (entryId: string, reason: string) => Promise<boolean>;
}) {
  const [showCreateForm, setShowCreateForm] = useState(officialRaces.length === 0);
  const [raceStatusFilter, setRaceStatusFilter] = useState<ManagerRaceFilter>("ALL");
  const [raceSearch, setRaceSearch] = useState("");
  const [editingRace, setEditingRace] = useState<OfficialRace | null>(null);
  const [cancellingRace, setCancellingRace] = useState<OfficialRace | null>(null);
  const [cancelRaceReason, setCancelRaceReason] = useState("");
  const [rosterRace, setRosterRace] = useState<OfficialRace | null>(null);
  const [rosterEntries, setRosterEntries] = useState<OfficialRaceEntry[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const [withdrawingEntry, setWithdrawingEntry] = useState<OfficialRaceEntry | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");

  async function openRoster(race: OfficialRace) {
    setRosterRace(race);
    setRosterLoading(true);
    setRosterError("");
    try {
      const response = await listOfficialRaceEntries(race.id);
      setRosterEntries(response.data);
    } catch (reason) {
      setRosterEntries([]);
      setRosterError(requestError(reason));
    } finally {
      setRosterLoading(false);
    }
  }

  const summary = competitionReport?.summary;
  const todayIso = new Date().toLocaleDateString("en-CA");
  const defaultRaceDate = date >= todayIso ? date : todayIso;

  const raceCounts = {
    all: officialRaces.length,
    scheduled: officialRaces.filter((r) => r.status !== "Cancelled" && r.status !== "Completed").length,
    completed: officialRaces.filter((r) => r.status === "Completed").length,
    cancelled: officialRaces.filter((r) => r.status === "Cancelled").length,
  };

  const normalizedQuery = raceSearch.trim().toLowerCase();
  const filteredRaces = officialRaces.filter((race) => {
    if (raceStatusFilter === "SCHEDULED" && (race.status === "Cancelled" || race.status === "Completed")) return false;
    if (raceStatusFilter === "COMPLETED" && race.status !== "Completed") return false;
    if (raceStatusFilter === "CANCELLED" && race.status !== "Cancelled") return false;
    if (normalizedQuery) {
      const hay = `${race.race_name} ${race.location ?? ""} ${race.grade ?? ""} ${race.distance_category ?? ""}`.toLowerCase();
      if (!hay.includes(normalizedQuery)) return false;
    }
    return true;
  });

  const leaderboard = competitionReport?.leaderboard ?? [];
  const recentResults = competitionReport?.recent_results ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          icon={Trophy}
          label="Tổng giải chính thức"
          value={String(summary?.total_races ?? raceCounts.scheduled + raceCounts.completed)}
        />
        <Metric
          icon={Users}
          label="Đang ĐK / Tạm khóa y tế"
          value={`${summary?.registered ?? 0} ĐK · ${summary?.blocked ?? 0} khóa`}
        />
        <Metric
          icon={CheckCircle2}
          label="Hoàn thành / Đã rút"
          value={`${summary?.completed ?? 0} xong · ${summary?.cancelled ?? 0} hủy`}
        />
        <Metric
          icon={Medal}
          label="Thành tích CLB (H1 / Top 3)"
          value={`${summary?.wins ?? 0} Vô địch · ${summary?.podiums ?? 0} Top 3`}
        />
        <Metric
          icon={Wallet}
          label="Tổng tiền thưởng CLB"
          value={money(summary?.total_prize)}
        />
      </div>

      <Panel title="Quản lý & Điều phối giải đấu chính thức" icon={Trophy}>
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-equine-line bg-slate-50/70 p-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {([
              ["ALL", `Tất cả (${raceCounts.all})`],
              ["SCHEDULED", `Đang mở / Sắp diễn ra (${raceCounts.scheduled})`],
              ["COMPLETED", `Đã hoàn thành (${raceCounts.completed})`],
              ["CANCELLED", `Đã hủy (${raceCounts.cancelled})`],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRaceStatusFilter(key)}
                className={raceStatusFilter === key ? "gold-button !min-h-[34px] !px-3 !text-xs" : "soft-button !min-h-[34px] !px-3 !text-xs"}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative flex-1 sm:w-64 sm:flex-none">
              <span className="sr-only">Tìm giải đấu</span>
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                className="field-control !h-9 bg-white pl-8 pr-3 text-xs"
                value={raceSearch}
                onChange={(event) => setRaceSearch(event.target.value)}
                placeholder="Tìm tên giải, địa điểm, hạng..."
              />
            </label>
            <button
              type="button"
              className={showCreateForm ? "soft-button !min-h-[36px] !px-3.5 !text-xs" : "gold-button !min-h-[36px] !px-3.5 !text-xs"}
              onClick={() => setShowCreateForm((prev) => !prev)}
            >
              {showCreateForm ? "Đóng biểu mẫu" : <><Plus size={14} /> Tạo giải đấu mới</>}
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form onSubmit={onAddRace} className="mb-5 grid gap-3 rounded-xl border border-equine-line bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="text-sm font-bold text-equine-navy">Tạo giải đấu chính thức mới</h3>
              <span className="text-xs text-slate-500">Thông báo sẽ tự động gửi tới Head Trainer sau khi tạo</span>
            </div>
            <label className="block sm:col-span-2">
              <span className="field-label">Tên giải đấu <span className="text-rose-600">*</span></span>
              <input className="field-control bg-white px-3" name="race_name" maxLength={150} required placeholder="VD: Giải Vô địch Quốc gia Mùa Thu" />
            </label>
            <label className="block">
              <span className="field-label">Ngày thi đấu <span className="text-rose-600">*</span></span>
              <input className="field-control bg-white px-3" name="race_date" type="date" min={todayIso} defaultValue={defaultRaceDate} required />
            </label>
            <label className="block">
              <span className="field-label">Cự ly (mét)</span>
              <input className="field-control bg-white px-3" name="distance_meters" type="number" min="1" max="100000" step="1" placeholder="1600" />
            </label>
            <label className="block">
              <span className="field-label">Hạng giải</span>
              <input className="field-control bg-white px-3" name="grade" maxLength={10} placeholder="G1, G2, Open..." />
            </label>
            <label className="block">
              <span className="field-label">Nhóm cự ly</span>
              <input className="field-control bg-white px-3" name="distance_category" maxLength={20} placeholder="Sprint, Mile, Long..." />
            </label>
            <label className="block sm:col-span-2">
              <span className="field-label">Địa điểm tổ chức</span>
              <input className="field-control bg-white px-3" name="location" maxLength={150} placeholder="VD: Trường đua Đại Nam / Quốc gia" />
            </label>
            <label className="block sm:col-span-2 lg:col-span-4">
              <span className="field-label">Mô tả điều lệ & ghi chú</span>
              <textarea className="field-control min-h-20 bg-white px-3 py-2" name="description" placeholder="Điều kiện đường chạy, lưu ý ban tổ chức..." />
            </label>
            <div className="sm:col-span-2 lg:col-span-4 flex justify-end gap-2">
              <button type="button" className="soft-button !text-xs" disabled={busy} onClick={() => setShowCreateForm(false)}>Đóng</button>
              <button className="gold-button" disabled={busy}><Plus size={15} /> Thêm giải đấu chính thức</button>
            </div>
          </form>
        )}

        {filteredRaces.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredRaces.map((race) => {
              const isPastScheduled = race.status === "Scheduled" && race.race_date < todayIso;
              const statusBadge = race.status === "Cancelled"
                ? { label: "Đã hủy giải", cls: "bg-rose-50 text-rose-700 border-rose-200" }
                : race.status === "Completed"
                  ? { label: "Đã hoàn thành", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                  : isPastScheduled
                    ? { label: "Đã qua ngày thi đấu", cls: "bg-amber-50 text-amber-800 border-amber-200" }
                    : { label: "Đang mở đăng ký", cls: "bg-sky-50 text-sky-700 border-sky-200" };
              const canEdit = race.status !== "Cancelled";
              const canCancel = race.status !== "Cancelled" && race.completed_count === 0;
              const activeHorseCount = race.registered_count + race.blocked_count + race.completed_count;

              return (
                <article
                  key={race.id}
                  className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                    race.status === "Cancelled" ? "border-slate-200 bg-slate-50/70" : "border-equine-line bg-white shadow-sm hover:shadow-md"
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-base text-equine-navy">{race.race_name}</h3>
                          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusBadge.cls}`}>{statusBadge.label}</span>
                          {race.grade && <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">Hạng {race.grade}</span>}
                        </div>
                      </div>
                      <CompactId id={race.id} />
                    </div>

                    <div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-xs sm:grid-cols-3">
                      <div>
                        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
                          <CalendarDays size={12} /> Ngày thi đấu
                        </span>
                        <strong className="mt-0.5 block text-slate-800">{formatManagerRaceDate(race.race_date)}</strong>
                      </div>
                      <div>
                        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-slate-400">
                          <MapPin size={12} /> Địa điểm
                        </span>
                        <strong className="mt-0.5 block text-slate-800">{race.location || "Chưa cập nhật"}</strong>
                      </div>
                      <div>
                        <span className="block text-[11px] uppercase tracking-wide text-slate-400">Cự ly & Nhóm</span>
                        <strong className="mt-0.5 block text-slate-800">
                          {race.distance_meters ? `${race.distance_meters.toLocaleString("vi-VN")} m` : "—"}
                          {race.distance_category ? ` · ${race.distance_category}` : ""}
                        </strong>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1">Đã ĐK: <strong className="text-sky-700">{race.registered_count}</strong></span>
                      {race.blocked_count > 0 && (
                        <span className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-700">Khóa y tế: <strong>{race.blocked_count}</strong></span>
                      )}
                      <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1">Hoàn thành: <strong className="text-emerald-700">{race.completed_count}</strong></span>
                      {race.cancelled_count > 0 && (
                        <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1">Đã rút/hủy: <strong>{race.cancelled_count}</strong></span>
                      )}
                      {(race.total_prize_amount > 0 || race.completed_count > 0) && (
                        <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-900">
                          Tổng thưởng: <strong>{money(race.total_prize_amount)}</strong>
                        </span>
                      )}
                    </div>

                    {race.cancel_reason && (
                      <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800">
                        <strong>Lý do hủy giải:</strong> {race.cancel_reason}
                      </p>
                    )}
                    {race.description && (
                      <p className="mt-2.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{race.description}</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    <button type="button" className="soft-button !min-h-[34px] !px-3 !text-xs" disabled={busy} onClick={() => void openRoster(race)}>
                      <Users size={13} /> Danh sách ngựa ({activeHorseCount})
                    </button>
                    {canEdit && (
                      <button type="button" className="soft-button !min-h-[34px] !px-3 !text-xs" disabled={busy} onClick={() => setEditingRace(race)}>
                        <Pencil size={13} /> Sửa / Dời ngày
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        className="soft-button !min-h-[34px] !px-3 !text-xs border-rose-200 bg-rose-50 text-rose-700"
                        disabled={busy}
                        onClick={() => { setCancellingRace(race); setCancelRaceReason(""); }}
                      >
                        <Ban size={13} /> Hủy giải
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-sm text-slate-500">
            {officialRaces.length === 0
              ? "Chưa có giải đấu chính thức nào. Nhấn “Tạo giải đấu mới” để khởi tạo."
              : "Không có giải đấu nào khớp bộ lọc hoặc từ khóa tìm kiếm."}
          </div>
        )}
      </Panel>

      {(leaderboard.length > 0 || recentResults.length > 0) && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Bảng xếp hạng ngựa thi đấu xuất sắc" icon={Trophy}>
            {leaderboard.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-equine-line">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">Ngựa thi đấu</th>
                      <th className="px-3 py-2.5">Số giải</th>
                      <th className="px-3 py-2.5">Hạng 1</th>
                      <th className="px-3 py-2.5">Top 3</th>
                      <th className="px-3 py-2.5">Tốt nhất</th>
                      <th className="px-3 py-2.5 text-right">Tiền thưởng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-equine-line">
                    {leaderboard.map((row, idx) => (
                      <tr key={row.horse_id} className="bg-white">
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            idx === 0
                              ? "bg-amber-100 text-amber-900"
                              : idx <= 2
                                ? "bg-slate-200 text-slate-800"
                                : "bg-slate-100 text-slate-600"
                          }`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-equine-navy">{row.horse_name}</td>
                        <td className="px-3 py-2.5">{row.completed_races}</td>
                        <td className="px-3 py-2.5 font-semibold text-amber-800">{row.wins}</td>
                        <td className="px-3 py-2.5">{row.podiums}</td>
                        <td className="px-3 py-2.5">{row.best_position == null ? "—" : `Hạng ${row.best_position}`}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-equine-navy">{money(row.total_prize)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chưa có dữ liệu xếp hạng từ các giải đã hoàn thành.</p>
            )}
          </Panel>

          <Panel title="Kết quả thi đấu chính thức gần đây" icon={Medal}>
            {recentResults.length > 0 ? (
              <div className="max-h-[420px] space-y-2.5 overflow-y-auto pr-1">
                {recentResults.map((item) => (
                  <article key={item.entry_id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-equine-line bg-slate-50/70 p-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-equine-navy">{item.horse_name}</strong>
                        <span className="text-slate-400">·</span>
                        <span className="font-medium text-slate-700">{item.race_name}</span>
                        {item.grade && <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">{item.grade}</span>}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatManagerRaceDate(item.race_date)}{item.location ? ` · ${item.location}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        item.result_position === 1
                          ? "bg-amber-100 text-amber-900"
                          : item.result_position <= 3
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-white text-slate-700 border border-slate-200"
                      }`}>
                        Hạng {item.result_position}
                      </span>
                      <strong className="text-xs text-equine-navy">{money(item.prize_amount ?? 0)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chưa có kết quả thi đấu gần đây trong kỳ báo cáo.</p>
            )}
          </Panel>
        </div>
      )}

      {editingRace && (
        <Modal title="Chỉnh sửa giải đấu chính thức" busy={busy} onClose={() => setEditingRace(null)}>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              const distanceRaw = String(values.get("distance_meters") ?? "").trim();
              const ok = await onUpdateRace(editingRace.id, {
                race_name: editingRace.completed_count > 0 ? editingRace.race_name : String(values.get("race_name") ?? "").trim(),
                race_date: editingRace.completed_count > 0 ? editingRace.race_date : String(values.get("race_date") ?? ""),
                distance_meters: editingRace.completed_count > 0 ? editingRace.distance_meters : (distanceRaw ? Number(distanceRaw) : null),
                grade: String(values.get("grade") ?? "").trim() || null,
                distance_category: String(values.get("distance_category") ?? "").trim() || null,
                location: String(values.get("location") ?? "").trim() || null,
                description: String(values.get("description") ?? "").trim() || null,
              });
              if (ok) setEditingRace(null);
            }}
          >
            {editingRace.completed_count > 0 && (
              <div className="sm:col-span-2">
                <Notice variant="warning">Giải đấu đã có kết quả hoàn thành nên khóa tên giải, ngày thi đấu và cự ly; chỉ được cập nhật địa điểm/mô tả.</Notice>
              </div>
            )}
            <label className="block sm:col-span-2">
              <span className="field-label">Tên giải</span>
              <input className="field-control px-3" name="race_name" maxLength={150} defaultValue={editingRace.race_name} disabled={editingRace.completed_count > 0} required />
            </label>
            <label className="block">
              <span className="field-label">Ngày thi đấu</span>
              <input className="field-control px-3" name="race_date" type="date" min={todayIso} defaultValue={editingRace.race_date} disabled={editingRace.completed_count > 0} required />
            </label>
            <label className="block">
              <span className="field-label">Cự ly (mét)</span>
              <input className="field-control px-3" name="distance_meters" type="number" min="1" max="100000" step="1" defaultValue={editingRace.distance_meters ?? ""} disabled={editingRace.completed_count > 0} />
            </label>
            <label className="block">
              <span className="field-label">Hạng giải</span>
              <input className="field-control px-3" name="grade" maxLength={10} defaultValue={editingRace.grade ?? ""} />
            </label>
            <label className="block">
              <span className="field-label">Nhóm cự ly</span>
              <input className="field-control px-3" name="distance_category" maxLength={20} defaultValue={editingRace.distance_category ?? ""} />
            </label>
            <label className="block sm:col-span-2">
              <span className="field-label">Địa điểm</span>
              <input className="field-control px-3" name="location" maxLength={150} defaultValue={editingRace.location ?? ""} />
            </label>
            <label className="block sm:col-span-2">
              <span className="field-label">Mô tả</span>
              <textarea className="field-control min-h-20 px-3 py-2" name="description" defaultValue={editingRace.description ?? ""} />
            </label>
            <p className="text-xs text-slate-500 sm:col-span-2">Khi dời ngày thi đấu, hệ thống sẽ tự động kiểm tra trùng lịch của tất cả ngựa đã đăng ký.</p>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <button type="button" className="soft-button" disabled={busy} onClick={() => setEditingRace(null)}>Hủy</button>
              <button type="submit" className="gold-button" disabled={busy}>Lưu thay đổi</button>
            </div>
          </form>
        </Modal>
      )}

      {cancellingRace && (
        <Modal title="Xác nhận hủy giải đấu" busy={busy} onClose={() => setCancellingRace(null)}>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!cancelRaceReason.trim()) return;
              const ok = await onCancelRace(cancellingRace.id, cancelRaceReason.trim());
              if (ok) setCancellingRace(null);
            }}
          >
            <p className="text-sm text-slate-700">
              Hủy giải <strong>{cancellingRace.race_name}</strong> ngày <strong>{cancellingRace.race_date}</strong> sẽ đồng thời hủy toàn bộ lượt đăng ký hiện có ({cancellingRace.registered_count + cancellingRace.blocked_count} ngựa) và giải phóng lịch ngày đua.
            </p>
            <label className="block">
              <span className="field-label">Lý do hủy giải <span className="text-rose-600">*</span></span>
              <input
                className="field-control px-3"
                maxLength={255}
                required
                value={cancelRaceReason}
                onChange={(event) => setCancelRaceReason(event.target.value)}
                placeholder="Ví dụ: Ban tổ chức hoãn vô thời hạn..."
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="soft-button" disabled={busy} onClick={() => setCancellingRace(null)}>Đóng</button>
              <button type="submit" className="danger-button" disabled={busy || !cancelRaceReason.trim()}>Xác nhận hủy giải</button>
            </div>
          </form>
        </Modal>
      )}

      {rosterRace && (
        <Modal title={`Danh sách ngựa · ${rosterRace.race_name}`} busy={busy} onClose={() => { setRosterRace(null); setWithdrawingEntry(null); }}>
          <div className="space-y-4">
            <div className="grid gap-2 rounded-lg border border-equine-line bg-slate-50 p-3 text-xs sm:grid-cols-4">
              <div><span className="text-slate-400 block">Ngày thi đấu</span><strong className="text-equine-navy">{formatManagerRaceDate(rosterRace.race_date)}</strong></div>
              <div><span className="text-slate-400 block">Địa điểm</span><strong className="text-equine-navy">{rosterRace.location || "Chưa cập nhật"}</strong></div>
              <div><span className="text-slate-400 block">Cự ly / Hạng</span><strong className="text-equine-navy">{rosterRace.distance_meters ? `${rosterRace.distance_meters.toLocaleString("vi-VN")} m` : "—"}{rosterRace.grade ? ` · ${rosterRace.grade}` : ""}</strong></div>
              <div><span className="text-slate-400 block">Trạng thái giải</span><strong className="text-equine-navy">{rosterRace.status === "Cancelled" ? "Đã hủy" : rosterRace.status === "Completed" ? "Hoàn thành" : "Đang mở"}</strong></div>
            </div>

            {rosterError && <Notice error>{rosterError}</Notice>}
            {rosterLoading ? (
              <p className="text-sm text-slate-500">Đang tải danh sách ngựa tham dự…</p>
            ) : !rosterEntries.length ? (
              <p className="text-sm text-slate-500">Chưa có ngựa nào được đăng ký vào giải này.</p>
            ) : (
              <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                {rosterEntries.map((entry) => {
                  const canWithdraw = entry.status === "Registered" || entry.status === "Blocked";
                  const entryBadgeCls = entry.status === "Blocked"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : entry.status === "Completed"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : entry.status === "Cancelled"
                        ? "border-slate-200 bg-slate-100 text-slate-600"
                        : "border-sky-200 bg-sky-50 text-sky-700";
                  return (
                    <article key={entry.entry_id} className="rounded-lg border border-equine-line bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-equine-navy">{entry.horse_name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Chủ sở hữu: <strong>{entry.owner_name ?? "Chưa gắn chủ"}</strong> · Đăng ký bởi: {entry.registered_by_name ?? "Head Trainer"}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Sức khỏe: <strong>{managerHealthLabel(entry.current_status)}</strong> · Thể lực Vet: <strong>{managerReadinessLabel(entry.readiness_status)}</strong>
                            {entry.is_training_locked ? " · Đang khóa huấn luyện" : ""}
                          </p>
                        </div>
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${entryBadgeCls}`}>
                          {entry.result_position != null ? `Hạng ${entry.result_position} · Hoàn thành` : managerRaceEntryStatusLabel(entry.status)}
                        </span>
                      </div>
                      {entry.status === "Completed" && (
                        <p className="mt-1.5 text-xs text-slate-600">Tiền thưởng: <strong className="text-equine-navy">{money(entry.prize_amount ?? 0)}</strong></p>
                      )}
                      {entry.cancel_reason && (
                        <p className="mt-1.5 text-xs text-rose-700">Lý do rút: {entry.cancel_reason}</p>
                      )}
                      {canWithdraw && (
                        <div className="mt-2">
                          <button
                            type="button"
                            className="soft-button !min-h-[30px] !px-2.5 !text-xs border-rose-200 bg-rose-50 text-rose-700"
                            disabled={busy}
                            onClick={() => { setWithdrawingEntry(entry); setWithdrawReason(""); }}
                          >
                            <Ban size={12} /> Rút ngựa khỏi giải
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {withdrawingEntry && (
              <form
                className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 space-y-2.5"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!withdrawReason.trim()) return;
                  const ok = await onCancelEntry(withdrawingEntry.entry_id, withdrawReason.trim());
                  if (ok) {
                    setWithdrawingEntry(null);
                    await openRoster(rosterRace);
                  }
                }}
              >
                <p className="text-xs font-semibold text-rose-900">Rút ngựa {withdrawingEntry.horse_name} khỏi giải:</p>
                <input
                  className="field-control bg-white px-3 text-sm"
                  maxLength={255}
                  required
                  value={withdrawReason}
                  onChange={(event) => setWithdrawReason(event.target.value)}
                  placeholder="Nhập lý do rút ngựa..."
                />
                <div className="flex justify-end gap-2">
                  <button type="button" className="soft-button !min-h-[32px] !px-3 !text-xs" onClick={() => setWithdrawingEntry(null)}>Hủy</button>
                  <button type="submit" className="danger-button !min-h-[32px] !px-3 !text-xs" disabled={busy || !withdrawReason.trim()}>Xác nhận rút</button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
