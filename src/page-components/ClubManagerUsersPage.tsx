"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Copy, Filter, Lock, Pencil, RefreshCw, ShieldX, UserPlus, UserRound, X } from "lucide-react";
import HorseShell, { useHorseUser } from "@/components/horses/HorseShell";
import { Modal, Notice } from "@/components/horses/HorseUI";
import { ApiRequestError } from "@/api/client";
import {
  approveUser,
  clubManagerError,
  createStaffAccount,
  handleRoleChange,
  listPendingUsers,
  listRoleChangeRequests,
  listUsers,
  lockUser,
  rejectUser,
  unlockUser,
  updateUserRole,
  type AssignableRoleName,
  type CreatableRoleName,
  type PendingUser,
  type RoleChangeRequest,
} from "@/api/club-manager/api";
import { roleLabels } from "@/lib/roles";

const STAFF_ROLE_FILTERS = ["HEAD_TRAINER", "VETERINARIAN", "GROOM"] as const;
const ACTIVE_ROLE_FILTERS = [...STAFF_ROLE_FILTERS, "HORSE_OWNER", "CLUB_MANAGER"] as const;
const EDITABLE_ROLES: Array<{ value: AssignableRoleName; label: string }> = [
  { value: "HEAD_TRAINER", label: roleLabels.HEAD_TRAINER },
  { value: "VETERINARIAN", label: roleLabels.VETERINARIAN },
  { value: "GROOM", label: roleLabels.GROOM },
  { value: "HORSE_OWNER", label: roleLabels.HORSE_OWNER },
];

export default function ClubManagerUsersPage() {
  return <HorseShell><AccountManagement /></HorseShell>;
}

function AccountManagement() {
  const user = useHorseUser();
  const [tab, setTab] = useState<"pending" | "active" | "locked" | "roles" | "create">("pending");
  const [role, setRole] = useState("ALL");
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const PENDING_LIMIT = 20;
  const [roleRequests, setRoleRequests] = useState<RoleChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejectTarget, setRejectTarget] = useState<PendingUser | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [lockTarget, setLockTarget] = useState<PendingUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<PendingUser | null>(null);
  const [nextRole, setNextRole] = useState<AssignableRoleName>("GROOM");
  const [savingRole, setSavingRole] = useState(false);
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [newStaff, setNewStaff] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    roleName: "GROOM" as CreatableRoleName,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "pending") {
        const response = await listPendingUsers(role, pendingPage, PENDING_LIMIT);
        const lastPage = Math.max(1, Math.ceil(response.total / PENDING_LIMIT));
        setPendingTotal(response.total);
        if (pendingPage > lastPage) {
          setPendingPage(lastPage);
          return;
        }
        setPending(response.data);
      } else if (tab === "active") {
        setPending(await listUsers("APPROVED", role));
      } else if (tab === "locked") {
        setPending(await listUsers("LOCKED", role));
      } else if (tab === "roles") {
        setRoleRequests(await listRoleChangeRequests());
      }
    } catch (reason) {
      if (tab === "pending" || tab === "active" || tab === "locked") {
        setPending([]);
      } else if (tab === "roles") {
        setRoleRequests([]);
      }
      setError(clubManagerError(reason));
    } finally {
      setLoading(false);
    }
  }, [pendingPage, role, tab]);

  useEffect(() => { void load(); }, [load]);

  async function approve(id: number) {
    try {
      await approveUser(id);
      setNotice("Đã duyệt tài khoản và gửi thông báo cho người dùng.");
      await load();
    } catch (reason) { setError(clubManagerError(reason)); }
  }

  async function reject() {
    if (!rejectTarget) return;
    try {
      await rejectUser(rejectTarget.id, rejectReason);
      setRejectTarget(null);
      setRejectReason("");
      setNotice("Đã từ chối tài khoản.");
      await load();
    } catch (reason) { setError(clubManagerError(reason)); }
  }

  async function lock() {
    if (!lockTarget) return;
    try {
      await lockUser(lockTarget.id, rejectReason);
      setLockTarget(null);
      setRejectReason("");
      setNotice("Đã khóa tài khoản.");
      await load();
    } catch (reason) { setError(clubManagerError(reason)); }
  }

  async function unlock(id: number) {
    try {
      await unlockUser(id);
      setNotice("Đã mở khóa tài khoản. Người dùng có thể đăng nhập lại.");
      await load();
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 401) setPending([]);
      setError(clubManagerError(reason));
    }
  }

  function editRole(account: PendingUser) {
    if (account.id === user.id || account.role_name === "CLUB_MANAGER") return;
    setRoleTarget(account);
    setNextRole(account.role_name as AssignableRoleName);
  }

  async function saveRole() {
    if (!roleTarget) return;
    setSavingRole(true);
    try {
      await updateUserRole(roleTarget.id, nextRole);
      setRoleTarget(null);
      setNotice(`Đã đổi vai trò của ${roleTarget.full_name}. Người dùng cần đăng nhập lại để áp dụng quyền mới.`);
      await load();
    } catch (reason) {
      setError(clubManagerError(reason));
    } finally {
      setSavingRole(false);
    }
  }

  async function reviewRoleChange(request: RoleChangeRequest, action: "approve" | "reject") {
    try {
      await handleRoleChange(request.id, action);
      setNotice(action === "approve" ? "Đã duyệt yêu cầu đổi vai trò." : "Đã từ chối yêu cầu đổi vai trò.");
      await load();
    } catch (reason) { setError(clubManagerError(reason)); }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreatedCredentials(null);
    setCopiedCredentials(false);
    setCreatingStaff(true);
    try {
      const created = await createStaffAccount({
        ...newStaff,
        phone: newStaff.phone || undefined,
      });
      setNotice(`Đã tạo tài khoản ${created.email}. Hãy cung cấp mật khẩu tạm thời cho người dùng; họ sẽ phải đổi mật khẩu ở lần đăng nhập đầu tiên.`);
      setCreatedCredentials({ email: created.email, password: newStaff.password });
      setNewStaff({ fullName: "", email: "", phone: "", password: "", roleName: "GROOM" });
    } catch (reason) {
      setError(clubManagerError(reason));
    } finally {
      setCreatingStaff(false);
    }
  }

  if (user.roleName !== "CLUB_MANAGER") {
    return <Notice error>Chỉ Club Manager mới được quản lý tài khoản.</Notice>;
  }

  return (
    <section className="dashboard-workspace">
      <div className="flex flex-col gap-4 border-b border-equine-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-3xl font-normal text-equine-navy">Quản lý tài khoản</h1>
        </div>
        <button type="button" className="soft-button h-10 px-4 text-equine-navy" onClick={() => void load()}><RefreshCw size={15} /> Làm mới</button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-equine-line pb-3">
        <button type="button" className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-normal transition-colors ${tab === "pending" ? "bg-primary text-white border-primary shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} onClick={() => { setRole("ALL"); setPendingPage(1); setTab("pending"); }}><UserRound size={15} /> Chờ duyệt</button>
        <button type="button" className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-normal transition-colors ${tab === "active" ? "bg-primary text-white border-primary shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} onClick={() => { setRole("ALL"); setTab("active"); }}><UserRound size={15} /> Đang hoạt động</button>
        <button type="button" className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-normal transition-colors ${tab === "locked" ? "bg-primary text-white border-primary shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} onClick={() => { setRole("ALL"); setTab("locked"); }}><Lock size={15} /> Đã khóa</button>
        <button type="button" className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-normal transition-colors ${tab === "roles" ? "bg-primary text-white border-primary shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} onClick={() => setTab("roles")}><Lock size={15} /> Đổi vai trò</button>
        <button type="button" className={`inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-normal transition-colors ${tab === "create" ? "bg-primary text-white border-primary shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`} onClick={() => setTab("create")}><UserPlus size={15} /> Tạo tài khoản nhân sự</button>
      </div>

      {error && <div className="mt-5"><Notice error>{error}</Notice></div>}
      {notice && <div className="mt-5"><Notice>{notice}</Notice></div>}
      {tab === "create" && createdCredentials && <div className="mt-4 max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <h3 className="font-normal">Tài khoản mới</h3>
        <p className="mt-2">Email: <strong>{createdCredentials.email}</strong></p>
        <p className="mt-1">Mật khẩu tạm: <code className="rounded bg-white px-2 py-1">{createdCredentials.password}</code></p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="soft-button h-9 bg-white px-3" onClick={() => void navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nMật khẩu tạm: ${createdCredentials.password}`).then(() => setCopiedCredentials(true)).catch(() => setError("Không thể sao chép. Hãy sao chép thông tin hiển thị thủ công."))}><Copy size={14} /> {copiedCredentials ? "Đã sao chép" : "Sao chép thông tin"}</button>
          <button type="button" className="soft-button h-9 bg-white px-3" onClick={() => setCreatedCredentials(null)}>Ẩn mật khẩu</button>
        </div>
      </div>}

      {tab === "create" && <div className="mt-5 max-w-3xl rounded-lg border border-equine-line bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-sans text-xl font-normal text-equine-navy">Cấp tài khoản nhân sự</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Mật khẩu tạm phải đổi sau lần đăng nhập đầu.</p>
        <form className="mt-5 space-y-4" onSubmit={createAccount}>
          <label className="block"><span className="field-label">Họ và tên</span><input className="field-control px-4" maxLength={100} required value={newStaff.fullName} onChange={(event) => setNewStaff((current) => ({ ...current, fullName: event.target.value }))} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="field-label">Gmail / Email</span><input autoComplete="email" className="field-control px-4" maxLength={100} required type="email" value={newStaff.email} onChange={(event) => setNewStaff((current) => ({ ...current, email: event.target.value }))} /></label>
            <label className="block"><span className="field-label">Số điện thoại (không bắt buộc)</span><input className="field-control px-4" maxLength={20} type="tel" value={newStaff.phone} onChange={(event) => setNewStaff((current) => ({ ...current, phone: event.target.value }))} /></label>
          </div>
          <label className="block"><span className="field-label">Vai trò</span><select className="field-control px-4" value={newStaff.roleName} onChange={(event) => setNewStaff((current) => ({ ...current, roleName: event.target.value as CreatableRoleName }))}><option value="HEAD_TRAINER">{roleLabels.HEAD_TRAINER}</option><option value="VETERINARIAN">{roleLabels.VETERINARIAN}</option><option value="GROOM">{roleLabels.GROOM}</option><option value="CLUB_MANAGER">{roleLabels.CLUB_MANAGER}</option></select></label>
          <label className="block"><span className="field-label">Mật khẩu tạm thời</span><input autoComplete="new-password" className="field-control px-4" minLength={8} required type="password" value={newStaff.password} onChange={(event) => setNewStaff((current) => ({ ...current, password: event.target.value }))} /><span className="mt-1 block text-xs text-slate-500">Tối thiểu 8 ký tự. Hãy chuyển mật khẩu này cho nhân sự qua kênh riêng.</span></label>
          <button className="gold-button w-full sm:w-auto" disabled={creatingStaff} type="submit">{creatingStaff ? "Đang tạo tài khoản..." : "Tạo và cấp tài khoản"}</button>
        </form>
      </div>}

      {(tab === "pending" || tab === "active" || tab === "locked") && <div className="mt-5 rounded-lg border border-equine-line bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-sans text-xl font-normal text-equine-navy">{tab === "pending" ? "Tài khoản chờ duyệt" : tab === "locked" ? "Tài khoản đã khóa" : "Tài khoản đang hoạt động"}</h2><p className="mt-1 text-sm text-slate-500">{tab === "pending" ? "Horse Owner không xuất hiện vì được kích hoạt tự động." : tab === "locked" ? "Tài khoản vẫn được lưu tại đây; mở khóa sẽ cho phép người dùng đăng nhập lại." : "Có thể đổi vai trò hoặc khóa thành viên; không áp dụng với bạn và Club Manager."}</p></div><label className="flex items-center gap-2 rounded-md border border-equine-line bg-slate-50 px-3 py-2 text-sm"><Filter size={15} /><select value={role} onChange={(event) => { setRole(event.target.value); setPendingPage(1); }} className="border-0 bg-transparent outline-none"><option value="ALL">Tất cả vai trò</option>{(tab === "pending" ? STAFF_ROLE_FILTERS : ACTIVE_ROLE_FILTERS).map((roleName) => <option key={roleName} value={roleName}>{roleLabels[roleName]}</option>)}</select></label></div>
        {loading ? <Notice>Đang tải danh sách tài khoản...</Notice> : pending.length === 0 ? <Notice>Không có tài khoản phù hợp.</Notice> : <div className="space-y-3">{pending.map((account) => {
          const protectedAccount = account.id === user.id || account.role_name === "CLUB_MANAGER";
          const statusLabel = account.status === "LOCKED" ? "Đã khóa" : account.status === "PENDING" ? "Chờ duyệt" : "Đang hoạt động";
          return <article key={account.id} className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4 transition-colors md:flex-row md:items-center md:justify-between"><div><h3 className="font-normal text-equine-navy">{account.full_name}</h3><p className="text-sm text-slate-600">{account.email}{account.phone ? ` · ${account.phone}` : ""}</p><p className="mt-1 text-xs font-normal uppercase tracking-wide text-teal-800">{roleLabels[account.role_name]}</p><p className="mt-1 text-xs text-slate-500">Trạng thái: {statusLabel}</p></div><div className="flex flex-wrap gap-2">{tab === "pending" ? <><button type="button" className="gold-button h-10 px-4" onClick={() => void approve(account.id)}><Check size={15} /> Duyệt</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => setRejectTarget(account)}><X size={15} /> Từ chối</button></> : tab === "locked" ? !protectedAccount && <button type="button" className="gold-button h-10 px-4" onClick={() => void unlock(account.id)}><Check size={15} /> Mở khóa</button> : !protectedAccount && <><button type="button" className="soft-button h-10 px-4 text-equine-navy" onClick={() => editRole(account)}><Pencil size={15} /> Sửa vai trò</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => setLockTarget(account)}><Lock size={15} /> Khóa</button></>}</div></article>;
        })}</div>}
        {tab === "pending" && !loading && pendingTotal > PENDING_LIMIT && (
          <nav className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-equine-line pt-4 text-xs text-slate-600" aria-label="Phân trang tài khoản chờ duyệt">
            <span>
              Trang <strong className="text-equine-navy">{pendingPage}</strong> / {Math.max(1, Math.ceil(pendingTotal / PENDING_LIMIT))} ({pendingTotal} tài khoản chờ duyệt)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="soft-button h-9 px-3 text-xs"
                disabled={pendingPage <= 1}
                onClick={() => setPendingPage((current) => Math.max(1, current - 1))}
              >
                Trang trước
              </button>
              <button
                type="button"
                className="soft-button h-9 px-3 text-xs"
                disabled={pendingPage >= Math.ceil(pendingTotal / PENDING_LIMIT)}
                onClick={() => setPendingPage((current) => current + 1)}
              >
                Trang sau
              </button>
            </div>
          </nav>
        )}
      </div>}

      {tab === "roles" && <div className="mt-5 rounded-lg border border-equine-line bg-white p-4 shadow-sm"><div className="mb-4"><h2 className="font-sans text-xl font-normal text-equine-navy">Yêu cầu đổi vai trò</h2><p className="mt-1 text-sm text-slate-500">Duyệt sẽ đổi vai trò hiện tại.</p></div>{loading ? <Notice>Đang tải yêu cầu...</Notice> : roleRequests.length === 0 ? <Notice>Không có yêu cầu đổi vai trò đang chờ.</Notice> : <div className="space-y-3">{roleRequests.map((request) => <article key={request.id} className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4 transition-colors md:flex-row md:items-center md:justify-between"><div><h3 className="font-normal text-equine-navy">{request.full_name}</h3><p className="text-sm text-slate-600">{request.email}</p><p className="mt-1 text-sm text-slate-700">{request.current_role ?? "Chưa có role"} → <strong>{request.requested_role}</strong></p>{request.reason && <p className="mt-1 text-xs text-slate-500">Lý do: {request.reason}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" className="gold-button h-10 px-4" onClick={() => void reviewRoleChange(request, "approve")}><Check size={15} /> Duyệt</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => void reviewRoleChange(request, "reject")}><ShieldX size={15} /> Từ chối</button></div></article>)}</div>}</div>}

      {rejectTarget && <Modal title={`Từ chối ${rejectTarget.full_name}`} onClose={() => setRejectTarget(null)}><div className="space-y-4"><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="field-control h-28 resize-none px-4 py-3" placeholder="Lý do từ chối (không bắt buộc)" /><div className="flex justify-end gap-2"><button type="button" className="soft-button h-10 px-4" onClick={() => setRejectTarget(null)}>Hủy</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => void reject()}><X size={15} /> Xác nhận từ chối</button></div></div></Modal>}
      {lockTarget && <Modal title={`Khóa ${lockTarget.full_name}`} onClose={() => setLockTarget(null)}><div className="space-y-4"><p className="text-sm text-slate-600">Tài khoản sẽ không thể đăng nhập sau khi bị khóa.</p><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="field-control h-28 resize-none px-4 py-3" placeholder="Lý do khóa (không bắt buộc)" /><div className="flex justify-end gap-2"><button type="button" className="soft-button h-10 px-4" onClick={() => setLockTarget(null)}>Hủy</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => void lock()}><Lock size={15} /> Xác nhận khóa</button></div></div></Modal>}
      {roleTarget && <Modal title={`Đổi vai trò · ${roleTarget.full_name}`} busy={savingRole} onClose={() => setRoleTarget(null)}><div className="space-y-4"><p className="text-sm text-slate-600">Vai trò hiện tại: <strong>{roleLabels[roleTarget.role_name]}</strong>. Người dùng sẽ được thông báo và cần đăng nhập lại để áp dụng quyền mới.</p><label className="block"><span className="field-label">Vai trò mới</span><select value={nextRole} onChange={(event) => setNextRole(event.target.value as AssignableRoleName)} className="field-control h-12 px-4">{EDITABLE_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="flex justify-end gap-2 pt-2"><button type="button" className="soft-button h-10 px-4" disabled={savingRole} onClick={() => setRoleTarget(null)}>Hủy</button><button type="button" className="gold-button h-10 px-4" disabled={savingRole || nextRole === roleTarget.role_name} onClick={() => void saveRole()}>{savingRole ? "Đang lưu..." : "Lưu vai trò"}</button></div></div></Modal>}
    </section>
  );
}
