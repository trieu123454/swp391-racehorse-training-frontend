"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ClipboardList,
  FileText,
  History,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Wallet,
} from "lucide-react";
import { HorseImage, Notice } from "@/components/horses/HorseUI";
import IncidentPhoto from "@/components/groom/IncidentPhoto";
import InventoryManagerPanel from "@/components/club-manager/InventoryManagerPanel";
import NotificationCenter from "@/components/shared/NotificationCenter";
import { authenticatedRequest, ApiRequestError } from "@/api/client";
import { getHorseStables, type Horse, type Stable } from "@/api/horses/api";
import {
  listPendingHorseRegistrationRequests,
  reviewHorseRegistrationRequest,
  type ManagerHorseRegistrationRequest,
} from "@/api/club-manager/api";
import { useDashboardTab } from "@/shared/hooks/use-dashboard-tab";

type Option = { id: string | number; full_name?: string; horse_name?: string; breed?: string | null; birth_year?: number | null; owner_id?: number | null; owner_name?: string | null };
type ManagerTask = { id: string; horse_name: string; groom_name: string | null; task_type: string; task_date: string; status: string };
type IncidentAssignee = { id: number; full_name: string; email: string; role_name: "HEAD_TRAINER" | "VETERINARIAN" | "GROOM" };
type AssignmentRole = IncidentAssignee["role_name"] | "CLUB_MANAGER";
type Incident = {
  id: string; horse_name: string; groom_name: string | null; issue_description: string; image_url: string | null;
  is_emergency: boolean; status: string; assigned_to: number | null; assigned_role: string | null;
  assignee_name: string | null; assignment_note: string | null; result_note: string | null; created_at: string;
};
type AuditRow = { id: string; user_name: string | null; email: string | null; action_performed: string; created_at: string };
type OfficialRace = { id: string; race_name: string; grade: string | null; distance_category: string | null; distance_meters: number | null; race_date: string; location: string | null; description: string | null };
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
  official_competition: { registered: number; completed: number };
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
  { value: "VETERINARIAN", label: "Bác sĩ thú y" },
  { value: "GROOM", label: "Groom" },
  { value: "CLUB_MANAGER", label: "Tôi tự xử lý · Club Manager" },
];

const incidentRoleLabels: Record<string, string> = {
  HEAD_TRAINER: "Huấn luyện viên trưởng",
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
      {normalizedSearch.length < 2
        ? <p className="mt-2 text-xs text-slate-500">Chọn vai trò rồi nhập tên hoặc email để tìm đúng người.</p>
        : <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-equine-line" role="listbox" aria-label="Kết quả tìm người phụ trách">
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

function requestError(reason: unknown) {
  if (reason instanceof ApiRequestError && reason.status === 401) {
    return "Máy chủ yêu cầu xác thực. Hãy đăng xuất, đăng nhập lại rồi tải lại mục này.";
  }
  return reason instanceof Error ? reason.message : "Không thể tải dữ liệu.";
}

export default function ClubManagerWorkspace() {
  const [date, setDate] = useState(today());
  const [tab, selectTab] = useDashboardTab(workspaceTabIds, "overview");
  const [horses, setHorses] = useState<Option[]>([]);
  const [stables, setStables] = useState<Stable[]>([]);
  const [horseRequests, setHorseRequests] = useState<ManagerHorseRegistrationRequest[]>([]);
  const [grooms, setGrooms] = useState<Option[]>([]);
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [incidentAssignees, setIncidentAssignees] = useState<IncidentAssignee[]>([]);
  const [incidentFilter, setIncidentFilter] = useState("Open");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [officialRaces, setOfficialRaces] = useState<OfficialRace[]>([]);
  const [loadErrors, setLoadErrors] = useState<LoadErrors>(EMPTY_ERRORS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      authenticatedRequest<{ data: ManagerTask[] }>(`/api/club-manager/groom-tasks?date=${date}`),
      authenticatedRequest<{ data: Incident[] }>(`/api/club-manager/groom-incidents?status=${incidentFilter}`),
      authenticatedRequest<{ data: AuditRow[] }>(`/api/club-manager/audit-logs?from=${date}&to=${date}&page=1&limit=20`),
      authenticatedRequest<Report>(`/api/club-manager/operations-report?from=${date}&to=${date}`),
      authenticatedRequest<{ items: Option[] }>("/api/horses?page=1&size=100&limit=100"),
      authenticatedRequest<Option[]>("/api/club-manager/grooms"),


      authenticatedRequest<{ data: OfficialRace[] }>("/api/club-manager/races"),
      authenticatedRequest<{ data: IncidentAssignee[] }>("/api/club-manager/groom-incidents/assignees"),
      listPendingHorseRegistrationRequests(),
      getHorseStables(),
    ]);

    const nextErrors: LoadErrors = {
      overview: [], care: [], inventory: [], incidents: [], finance: [], races: [], audit: [], "horse-requests": [],
    };
    const read = <T,>(index: number, section: string, tabs: WorkspaceTab[], setValue: (value: T) => void) => {
      const result = results[index] as PromiseSettledResult<T>;
      if (result.status === "fulfilled") {
        setValue(result.value);
      } else {
        for (const target of tabs) nextErrors[target].push({ section, message: requestError(result.reason) });
      }
    };

    read(0, "Việc chăm sóc", ["care"], (value) => setTasks((value as { data: ManagerTask[] }).data));
    read(1, "Sự cố Groom", ["incidents"], (value) => setIncidents((value as { data: Incident[] }).data));
    read(2, "Nhật ký thao tác", ["audit"], (value) => setAudit((value as { data: AuditRow[] }).data));
    read(3, "Báo cáo vận hành", ["overview", "finance"], (value) => setReport(value as Report));
    read(4, "Danh sách ngựa", ["care", "finance"], (value) => setHorses((value as { items: Option[] }).items.map((horse) => ({ ...horse, id: String(horse.id) }))));
    read(5, "Danh sách Groom", ["care"], (value) => setGrooms((value as Option[]).map((groom) => ({ ...groom, id: Number(groom.id) }))));
    read(6, "Danh sách giải đấu", ["races"], (value) => setOfficialRaces((value as { data: OfficialRace[] }).data));
    read(7, "Người phụ trách sự cố", ["incidents"], (value) => setIncidentAssignees((value as { data: IncidentAssignee[] }).data));
    read(8, "Yêu cầu hồ sơ ngựa", ["horse-requests"], (value) => setHorseRequests(value as ManagerHorseRegistrationRequest[]));
    read(9, "Danh sách chuồng", ["horse-requests"], (value) => setStables(value as Stable[]));
    setLoadErrors(nextErrors);
  }, [date, incidentFilter]);

  useEffect(() => { void load(); }, [load]);

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

  async function reviewHorseRequest(id: string, action: "APPROVE" | "REJECT", form: HTMLFormElement) {
    if (action === "APPROVE" && !form.reportValidity()) return;
    const values = new FormData(form);
    const reviewNote = String(values.get("reviewNote") ?? "").trim();
    if (action === "REJECT" && !reviewNote) {
      setError("Vui lòng nhập lý do từ chối để Horse Owner biết cần bổ sung gì.");
      const reviewNoteField = form.elements.namedItem("reviewNote");
      if (reviewNoteField instanceof HTMLElement) reviewNoteField.focus();
      return;
    }
    const body: { action: "APPROVE" | "REJECT"; stableBoxId?: string; horseId?: string; reviewNote?: string } = {
      action,
      reviewNote: reviewNote || undefined,
    };
    if (action === "APPROVE") {
      const request = horseRequests.find((item) => item.id === id);
      if (request?.request_type === "REGISTER") body.stableBoxId = String(values.get("stableBoxId") ?? "");
      if (request?.request_type === "LINK") body.horseId = String(values.get("horseId") ?? "");
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await reviewHorseRegistrationRequest(id, body);
      setNotice(action === "APPROVE" ? "Đã duyệt hồ sơ ngựa; dữ liệu đã gửi được đưa vào hồ sơ." : "Đã từ chối yêu cầu và gửi kết quả cho Horse Owner.");
      await load();
    } catch (reason) {
      setError(requestError(reason));
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

  const tabs: { key: WorkspaceTab; label: string; icon: ReactNode; count?: number }[] = [
    { key: "overview", label: "Tổng quan", icon: <Activity size={16} /> },
    { key: "care", label: "Giao việc chăm sóc", icon: <ClipboardList size={16} /> },
    { key: "inventory", label: "Vật tư & thức ăn", icon: <Boxes size={16} /> },
    { key: "incidents", label: "Sự cố", icon: <AlertTriangle size={16} />, count: incidents.length },
    { key: "finance", label: "Thu chi", icon: <Wallet size={16} /> },
    { key: "races", label: "Giải đấu", icon: <Trophy size={16} /> },
    { key: "horse-requests", label: "Hồ sơ ngựa", icon: <FileText size={16} />, count: horseRequests.length },
    { key: "audit", label: "Nhật ký thao tác", icon: <History size={16} /> },
  ];

  return <section className="mt-5 space-y-5" aria-labelledby="club-manager-workspace-title">
    <div className="flex flex-col gap-3 border-b border-equine-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id="club-manager-workspace-title" className="font-sans text-3xl font-semibold text-equine-navy">Điều hành câu lạc bộ</h2>
      </div>
      <div className="flex gap-2">
        <input aria-label="Ngày báo cáo" type="date" className="field-control px-3" value={date} onChange={(event) => setDate(event.target.value)} />
        <button type="button" className="soft-button" onClick={() => void load()} disabled={busy}><RefreshCw size={15} /> Làm mới</button>
      </div>
    </div>

    {error && <Notice error>{error}</Notice>}
    {notice && <Notice>{notice}</Notice>}
    <NotificationCenter />

    <div role="tablist" aria-label="Các mục quản lý câu lạc bộ" className="workspace-secondary-nav flex gap-2 overflow-x-auto rounded-2xl border border-equine-line bg-white p-2 shadow-sm">
      {tabs.map((item) => <button
        key={item.key}
        id={`manager-tab-${item.key}`}
        type="button"
        role="tab"
        aria-selected={tab === item.key}
        aria-controls={`manager-panel-${item.key}`}
        tabIndex={tab === item.key ? 0 : -1}
        onClick={() => selectTab(item.key)}
        onKeyDown={(event) => {
          const currentIndex = tabs.findIndex((candidate) => candidate.key === item.key);
          let nextIndex = currentIndex;
          if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
          else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          else if (event.key === "Home") nextIndex = 0;
          else if (event.key === "End") nextIndex = tabs.length - 1;
          else return;
          event.preventDefault();
          const nextTab = tabs[nextIndex].key;
          selectTab(nextTab);
          document.getElementById(`manager-tab-${nextTab}`)?.focus();
        }}
        className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${tab === item.key ? "bg-equine-navy text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-equine-navy"}`}
      >
        {item.icon}<span>{item.label}</span>
        {item.count ? <span className={`rounded-full px-2 py-0.5 text-xs ${tab === item.key ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"}`}>{item.count}</span> : null}
      </button>)}
    </div>

    <div role="tabpanel" id={`manager-panel-${tab}`} aria-labelledby={`manager-tab-${tab}`} className="space-y-5">
      {loadErrors[tab].map((item) => <Notice key={`${item.section}-${item.message}`} error>{item.section}: {item.message}</Notice>)}

      {tab === "overview" && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Activity} label="Buổi tập trong ngày" value={String(report?.scheduled_training_sessions ?? 0)} />
          <Metric icon={ClipboardList} label="Việc Groom hoàn thành" value={`${report?.groom_tasks.completed ?? 0}/${report?.groom_tasks.total ?? 0}`} />
          <Metric icon={ShieldCheck} label="Sự cố cần xử lý" value={String(report?.pending_incidents ?? incidents.length)} />
          <Metric icon={FileText} label="Trạng thái sức khỏe" value={(report?.horses_by_health_status ?? []).map((item) => `${item.current_status}: ${item.total}`).join(" · ") || "Chưa có dữ liệu"} />
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="Hiệu suất huấn luyện" icon={Activity}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Metric icon={Activity} label="Buổi đã lên lịch" value={String(report?.training_performance.scheduled ?? 0)} />
              <Metric icon={Activity} label="Đang diễn ra" value={String(report?.training_performance.in_progress ?? 0)} />
              <Metric icon={ShieldCheck} label="Hoàn tất / bị khóa" value={`${report?.training_performance.completed ?? 0} / ${report?.training_performance.blocked ?? 0}`} />
              <Metric icon={ClipboardList} label="Đã hủy" value={String(report?.training_performance.cancelled ?? 0)} />
              <Metric icon={Package} label="Giải đấu đã đăng ký" value={String(report?.official_competition.registered ?? 0)} />
            </div>
          </Panel>
          <Panel title="Nhân sự đang hoạt động" icon={ShieldCheck}>
            <div className="space-y-2">
              {report?.approved_staff_by_role.map((item) => <div key={item.role_name} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{item.role_name}</span><strong>{item.total}</strong></div>)}
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
          <label className="block"><span className="field-label">Ngày</span><input className="field-control px-3" name="task_date" type="date" required defaultValue={date} /></label>
          <div className="sm:col-span-2"><button className="gold-button" disabled={busy}><Plus size={15} /> Giao việc</button></div>
        </form>}
        <div className="mt-5 space-y-2">
          {tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-equine-line p-3 text-sm">
            <span>{task.task_type} · {task.horse_name}{task.groom_name ? ` · ${task.groom_name}` : ""}</span>
            <div className="flex items-center gap-2"><span className="text-slate-500">{task.status}</span>{task.status === "Pending" && <button type="button" className="soft-button h-8 px-2 text-xs text-rose-700" disabled={busy} onClick={() => void send(`/api/club-manager/groom-tasks/${task.id}`, "PATCH", { action: "Cancel" }, "Đã hủy công việc để có thể giao lại.")}>Hủy việc</button>}</div>
          </div>)}
          {!tasks.length && <p className="text-sm text-slate-500">Chưa giao việc trong ngày này.</p>}
        </div>
      </Panel>}

      {tab === "horse-requests" && <HorseRegistrationReviewPanel
        requests={horseRequests}
        horses={horses}
        stables={stables}
        busy={busy}
        onReview={reviewHorseRequest}
      />}

      {tab === "inventory" && <InventoryManagerPanel />}
      {tab === "incidents" && <Panel title="Sự cố Groom" icon={AlertTriangle}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-3">
          <p className="text-sm text-slate-600">Xem xét báo cáo, giao người phụ trách, theo dõi kết quả và đóng sự cố.</p>
          <select aria-label="Lọc sự cố" className="field-control h-10 px-3" value={incidentFilter} onChange={(event) => setIncidentFilter(event.target.value)}>
            <option value="Open">Đang xử lý</option><option value="Resolved">Đã đóng</option><option value="All">Tất cả</option>
          </select>
        </div>
        <div className="space-y-3">
          {incidents.map((incident) => <article key={incident.id} className={`rounded-xl border p-4 ${incident.is_emergency ? "border-rose-300 bg-rose-50/50" : "border-equine-line bg-white"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-equine-navy">{incident.horse_name}{incident.groom_name ? ` · ${incident.groom_name}` : ""}</p>
                <p className="mt-1 text-xs text-slate-500">{new Date(incident.created_at).toLocaleString("vi-VN")}</p>
              </div>
              <div className="flex items-center gap-2"><span className="rounded-full bg-white px-2 py-1 text-xs font-semibold">{incident.status}</span>
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
      {tab === "races" && <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Thêm giải đấu chính thức" icon={Trophy}>
          <form onSubmit={addOfficialRace} className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className="field-label">Tên giải</span><input className="field-control px-3" name="race_name" maxLength={150} required /></label>
            <label className="block"><span className="field-label">Ngày thi đấu</span><input className="field-control px-3" name="race_date" type="date" min={date} defaultValue={date} required /></label>
            <label className="block"><span className="field-label">Cự ly (mét)</span><input className="field-control px-3" name="distance_meters" type="number" min="1" max="100000" step="1" /></label>
            <label className="block"><span className="field-label">Hạng giải</span><input className="field-control px-3" name="grade" maxLength={10} /></label>
            <label className="block"><span className="field-label">Nhóm cự ly</span><input className="field-control px-3" name="distance_category" maxLength={20} /></label>
            <label className="block sm:col-span-2"><span className="field-label">Địa điểm</span><input className="field-control px-3" name="location" maxLength={150} /></label>
            <label className="block sm:col-span-2"><span className="field-label">Mô tả</span><textarea className="field-control min-h-20 px-3 py-2" name="description" /></label>
            <button className="gold-button sm:col-span-2" disabled={busy}><Plus size={15} /> Thêm giải đấu</button>
          </form>
        </Panel>
        <Panel title="Danh sách giải đấu chính thức" icon={Trophy}>
          <div className="space-y-2">{officialRaces.map((race) => <article key={race.id} className="rounded-xl border border-equine-line p-3">
            <p className="font-semibold text-equine-navy">{race.race_name}</p>
            <p className="mt-1 text-sm text-slate-600">{race.race_date}{race.location ? ` · ${race.location}` : ""}</p>
            <p className="mt-1 text-xs text-slate-500">{race.distance_meters ? `${race.distance_meters} m` : "Chưa nhập cự ly"}{race.grade ? ` · Hạng ${race.grade}` : ""}{race.distance_category ? ` · ${race.distance_category}` : ""}</p>
            {race.description && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{race.description}</p>}
          </article>)}{!officialRaces.length && <p className="text-sm text-slate-500">Chưa có giải đấu chính thức. Thêm giải để Head Trainer có thể đăng ký ngựa.</p>}</div>
        </Panel>
      </div>}

      {tab === "finance" && <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Tổng hợp thu chi" icon={Wallet}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric icon={Wallet} label="Chi phí chăm sóc" value={money(report?.operating_costs_and_prize_income.care_cost)} />
            <Metric icon={Wallet} label="Chi phí y tế" value={money(report?.operating_costs_and_prize_income.medical_cost)} />
            <Metric icon={ShieldCheck} label="Tiền thưởng giải đấu" value={money(report?.operating_costs_and_prize_income.prize_income)} />
            <Metric icon={Activity} label="Khoản khác" value={money(report?.operating_costs_and_prize_income.other_amount)} />
            <Metric icon={Activity} label="Kết quả thi đấu" value={`${report?.official_competition.completed ?? 0} hoàn thành`} />
          </div>
        </Panel>
        <Panel title="Ghi nhận khoản thu chi" icon={FileText}>
          {horses.length > 0 ? <form onSubmit={addFinancial} className="grid gap-3 sm:grid-cols-2">
            <Select name="horse_id" label="Ngựa" options={horses.map((horse) => [String(horse.id), horse.horse_name ?? ""] as [string, string])} />
            <Select name="transaction_type" label="Loại" options={[["Care", "Chăm sóc"], ["Medical", "Y tế"], ["Prize", "Tiền thưởng"], ["Other", "Khác"]]} />
            <label className="block"><span className="field-label">Số tiền</span><input className="field-control px-3" name="amount" type="number" min="0.01" step="0.01" required /></label>
            <label className="block"><span className="field-label">Kỳ thanh toán</span><input className="field-control px-3" name="billing_period" type="month" required defaultValue={date.slice(0, 7)} /></label>
            <div className="sm:col-span-2"><button className="gold-button" disabled={busy}><Wallet size={15} /> Ghi nhận</button></div>
          </form> : <p className="text-sm text-slate-500">Cần có hồ sơ ngựa để ghi nhận khoản thu chi.</p>}
        </Panel>
      </div>}

      {tab === "audit" && <Panel title="Nhật ký thao tác" icon={History}>
        <div className="max-h-[620px] space-y-2 overflow-y-auto">
          {audit.map((entry) => <article key={entry.id} className="rounded-lg border border-equine-line p-3"><p className="text-sm font-semibold text-equine-navy">{entry.action_performed}</p><p className="mt-1 text-xs text-slate-500">{entry.user_name ?? entry.email ?? "Tài khoản đã xóa"} · {new Date(entry.created_at).toLocaleString("vi-VN")}</p></article>)}
          {!audit.length && <p className="text-sm text-slate-500">Không có thao tác trong ngày này.</p>}
        </div>
      </Panel>}
    </div>
  </section>;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return <div className="rounded-xl border border-equine-line bg-white p-4"><Icon size={18} className="text-equine-gold" /><p className="mt-3 text-[10px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-equine-navy">{value}</p></div>;
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: ReactNode }) {
  return <section className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5"><h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><Icon size={18} />{title}</h3>{children}</section>;
}

function HorseRegistrationReviewPanel({ requests, horses, stables, busy, onReview }: {
  requests: ManagerHorseRegistrationRequest[];
  horses: Option[];
  stables: Stable[];
  busy: boolean;
  onReview: (id: string, action: "APPROVE" | "REJECT", form: HTMLFormElement) => void;
}) {
  return <Panel title={`Yêu cầu hồ sơ ngựa · ${requests.length} chờ duyệt`} icon={FileText}>
    <div className="space-y-3">
      {requests.map((request) => {
        const candidateHorses = horses;
        return <article key={request.id} className="rounded-xl border border-equine-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold text-equine-navy">{request.horse_name}</h4>
              <p className="mt-1 text-xs text-slate-500">{request.request_type === "LINK" ? "Liên kết hồ sơ có sẵn" : "Đăng ký hồ sơ mới"} · {new Date(request.created_at).toLocaleString("vi-VN")}</p>
            </div>
            <p className="text-sm font-medium text-equine-navy">{request.owner_name} <span className="font-normal text-slate-500">· {request.owner_email}</span></p>
          </div>
          <dl className="mt-3 grid gap-x-4 gap-y-1 rounded-lg bg-equine-paper p-3 text-sm sm:grid-cols-2">
            <Fact label="Giống" value={request.breed} />
            <Fact label="Năm sinh" value={request.birth_year == null ? null : String(request.birth_year)} />
            <Fact label="Microchip" value={request.microchip_number} />
            <Fact label="Hộ chiếu" value={request.passport_number} />
            <Fact label="Chiều cao" value={request.height_cm == null ? null : `${request.height_cm} cm`} />
            <Fact label="Cân nặng" value={request.current_weight_kg == null ? null : `${request.current_weight_kg} kg`} />
            <Fact label="Cha / mẹ" value={[request.pedigree_father, request.pedigree_mother].filter(Boolean).join(" / ")} />
          </dl>
          {request.horse_image_url && <div className="mt-3 h-40 w-60 overflow-hidden rounded-xl border border-equine-line bg-equine-paper"><HorseImage horse={{ id: request.id, horse_name: request.horse_name, image_url: request.horse_image_url } as Horse} preview={request.horse_image_url} /></div>}
          {request.owner_note && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{request.owner_note}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {request.documents.map((document) => <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="rounded-lg border border-equine-line bg-white px-3 py-2 text-xs font-medium text-equine-navy underline">Xem {document.name}</a>)}
          </div>
          <form className="mt-4 grid gap-3 border-t border-equine-line pt-4 sm:grid-cols-2">
            {request.request_type === "REGISTER" ? <label className="block"><span className="field-label">Chuồng khi tạo hồ sơ</span>
              <select className="field-control px-3" name="stableBoxId" defaultValue={stables[0]?.id ?? ""} required disabled={!stables.length}>
                {stables.map((stable) => <option key={stable.id} value={stable.id}>{stable.box_code} · {stable.section}</option>)}
              </select>
            </label> : <label className="block"><span className="field-label">Hồ sơ ngựa cần liên kết</span>
              <select className="field-control px-3" name="horseId" defaultValue="" required disabled={!candidateHorses.length}>
                <option value="">Chọn hồ sơ ngựa</option>
                {candidateHorses.map((horse) => <option key={horse.id} value={horse.id}>{horse.horse_name}{horse.breed ? ` · ${horse.breed}` : ""}{horse.birth_year ? ` · ${horse.birth_year}` : ""} · {horse.owner_name ?? "Chưa có chủ"}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">Duyệt sẽ gán hồ sơ cho Horse Owner gửi yêu cầu; chủ cũ và mới được lưu vào lịch sử.</p>
            </label>}
            <label className="block"><span className="field-label">Ghi chú duyệt / lý do từ chối</span><textarea className="field-control min-h-24 px-3 py-2" name="reviewNote" maxLength={1000} placeholder="Bắt buộc khi từ chối; nêu rõ giấy tờ cần bổ sung hoặc thông tin chưa hợp lệ." /></label>
            {request.request_type === "REGISTER" && !stables.length && <p className="text-sm text-rose-700 sm:col-span-2">Không có chuồng còn chỗ; thêm chuồng trước khi duyệt.</p>}
            {request.request_type === "LINK" && !candidateHorses.length && <p className="text-sm text-rose-700 sm:col-span-2">Chưa có hồ sơ ngựa để liên kết.</p>}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <button type="button" className="gold-button" disabled={busy || (request.request_type === "REGISTER" ? !stables.length : !candidateHorses.length)} onClick={(event) => { const form = event.currentTarget.form; if (form) onReview(request.id, "APPROVE", form); }}>Duyệt và {request.request_type === "LINK" ? "liên kết hồ sơ" : "tạo hồ sơ"}</button>
              <button type="button" className="soft-button border-rose-200 bg-rose-50 text-rose-800" disabled={busy} onClick={(event) => { const form = event.currentTarget.form; if (form) onReview(request.id, "REJECT", form); }}>Từ chối</button>
            </div>
          </form>
        </article>;
      })}
      {!requests.length && <p className="text-sm text-slate-500">Không có yêu cầu đăng ký ngựa đang chờ.</p>}
    </div>
  </Panel>;
}

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="flex gap-1"><dt className="text-slate-500">{label}:</dt><dd className="font-medium text-equine-navy">{value || "—"}</dd></div>;
}

function Select({ name, label, options }: { name: string; label: string; options: [string, string][] }) {
  return <label className="block"><span className="field-label">{label}</span><select className="field-control px-3" name={name} required>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function money(value: number | undefined) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value ?? 0);
}
