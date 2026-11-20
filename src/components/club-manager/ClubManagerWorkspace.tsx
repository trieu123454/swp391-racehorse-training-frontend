"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  History,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Wallet,
  XCircle,
} from "lucide-react";
import { HorseImage, Modal, Notice } from "@/components/horses/HorseUI";
import IncidentPhoto from "@/components/groom/IncidentPhoto";
import InventoryManagerPanel from "@/components/club-manager/InventoryManagerPanel";
import NotificationCenter from "@/components/shared/NotificationCenter";
import { CompactId } from "@/components/shared/CompactId";
import { authenticatedRequest, ApiRequestError } from "@/api/client";
import { getHorseStables, listHorses, openFreshDocument, type Horse, type Stable } from "@/api/horses/api";
import {
  getManagerRegistrationDocumentUrl,
  listHorseRegistrationRequests,
  reviewHorseRegistrationRequest,
  type HorseRegistrationStatusFilter,
  type ManagerHorseRegistrationRequest,
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
      listHorseRegistrationRequests(requestStatusFilter),
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
    read(4, "Danh sách ngựa", ["care", "finance", "horse-requests"], (value) => setHorses((value as { items: Option[] }).items.map((horse) => ({ ...horse, id: String(horse.id) }))));
    read(5, "Danh sách Groom", ["care"], (value) => setGrooms((value as Option[]).map((groom) => ({ ...groom, id: Number(groom.id) }))));
    read(6, "Danh sách giải đấu", ["races"], (value) => setOfficialRaces((value as { data: OfficialRace[] }).data));
    read(7, "Người phụ trách sự cố", ["incidents"], (value) => setIncidentAssignees((value as { data: IncidentAssignee[] }).data));
    read(8, "Yêu cầu hồ sơ ngựa", ["horse-requests"], (value) => setHorseRequests(value as ManagerHorseRegistrationRequest[]));
    read(9, "Danh sách chuồng", ["horse-requests"], (value) => setStables(value as Stable[]));
    setLoadErrors(nextErrors);
  }, [date, incidentFilter, requestStatusFilter]);

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

  return <section className="mt-5 space-y-5" aria-label="Điều hành câu lạc bộ">
    <div className="flex justify-end gap-3 border-b border-equine-line pb-4">
      <div className="flex gap-2">
        <input aria-label="Ngày báo cáo" type="date" className="field-control px-3" value={date} onChange={(event) => setDate(event.target.value)} />
        <button type="button" className="soft-button" onClick={() => void load()} disabled={busy}><RefreshCw size={15} /> Làm mới</button>
      </div>
    </div>

    {error && <Notice error>{error}</Notice>}
    {notice && <Notice>{notice}</Notice>}
    <NotificationCenter />

    <div role="tabpanel" id={`manager-panel-${tab}`} className="space-y-5">
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
              <Metric flat icon={Activity} label="Buổi đã lên lịch" value={String(report?.training_performance.scheduled ?? 0)} />
              <Metric flat icon={Activity} label="Đang diễn ra" value={String(report?.training_performance.in_progress ?? 0)} />
              <Metric flat icon={ShieldCheck} label="Hoàn tất / bị khóa" value={`${report?.training_performance.completed ?? 0} / ${report?.training_performance.blocked ?? 0}`} />
              <Metric flat icon={ClipboardList} label="Đã hủy" value={String(report?.training_performance.cancelled ?? 0)} />
              <Metric flat className="sm:col-span-2" icon={Package} label="Giải đấu đã đăng ký" value={String(report?.official_competition.registered ?? 0)} />
            </div>
          </Panel>
          <Panel title="Nhân sự đang hoạt động" icon={ShieldCheck}>
            <div className="space-y-2">
              {report?.approved_staff_by_role.map((item) => <div key={item.role_name} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{item.role_name}</span><span className="font-normal text-equine-navy tabular-nums">{item.total}</span></div>)}
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
          {tasks.map((task) => <div key={task.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 p-3 text-sm">
            <span>{task.task_type} · {task.horse_name}{task.groom_name ? ` · ${task.groom_name}` : ""}</span>
            <div className="flex items-center gap-2"><span className="text-slate-500">{task.status}</span>{task.status === "Pending" && <button type="button" className="soft-button h-8 px-2 text-xs text-rose-700" disabled={busy} onClick={() => void send(`/api/club-manager/groom-tasks/${task.id}`, "PATCH", { action: "Cancel" }, "Đã hủy công việc để có thể giao lại.")}>Hủy việc</button>}</div>
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
          <div className="space-y-2">{officialRaces.map((race) => <article key={race.id} className="rounded-lg bg-slate-50 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-normal text-equine-navy">{race.race_name}</p>
              <CompactId id={race.id} />
            </div>
            <p className="mt-1 text-sm font-normal text-slate-600">{race.race_date}{race.location ? ` · ${race.location}` : ""}</p>
            <p className="mt-1 text-xs font-normal text-slate-500">{race.distance_meters ? `${race.distance_meters} m` : "Chưa nhập cự ly"}{race.grade ? ` · Hạng ${race.grade}` : ""}{race.distance_category ? ` · ${race.distance_category}` : ""}</p>
            {race.description && <p className="mt-2 whitespace-pre-wrap text-sm font-normal text-slate-600">{race.description}</p>}
          </article>)}{!officialRaces.length && <p className="text-sm text-slate-500">Chưa có giải đấu.</p>}</div>
        </Panel>
      </div>}

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
              <p className="mt-1 text-xs text-slate-500">{entry.user_name ?? entry.email ?? "Tài khoản đã xóa"} · {new Date(entry.created_at).toLocaleString("vi-VN")}</p>
            </div>
            <CompactId id={entry.id} />
          </article>)}
          {!audit.length && <p className="text-sm text-slate-500">Không có thao tác trong ngày này.</p>}
        </div>
      </Panel>}
    </div>
  </section>;
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
          <p className="text-xs font-normal uppercase tracking-wide text-slate-500">{label}</p>
        </div>
        <p className="mt-2 text-base font-normal text-equine-navy">{value}</p>
      </div>
    );
  }
  return (
    <div className={`rounded-lg border border-equine-line bg-white p-4 shadow-sm ${className}`}>
      <Icon size={18} className="text-equine-teal" />
      <p className="mt-3 text-xs font-normal uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-base font-normal text-equine-navy">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Activity; children: ReactNode }) {
  return <section className="rounded-lg border border-equine-line bg-white p-4 shadow-sm sm:p-5"><h2 className="mb-4 flex items-center gap-2 font-sans text-lg font-normal text-equine-navy"><Icon size={18} />{title}</h2>{children}</section>;
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
            <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
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
                    Thời gian gửi: {new Date(request.created_at).toLocaleString("vi-VN")}
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
                            <p className="text-[11px] text-slate-400">{new Date(entry.created_at).toLocaleString("vi-VN")}</p>
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
