"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Filter, Lock, Pencil, RefreshCw, ShieldX, UserRound, X } from "lucide-react";
import HorseShell, { useHorseUser } from "@/components/HorseShell";
import { Modal, Notice } from "@/components/HorseUI";
import {
  approveUser,
  clubManagerError,
  handleRoleChange,
  listPendingUsers,
  listRoleChangeRequests,
  listUsers,
  lockUser,
  rejectUser,
  updateUserRole,
  type AssignableRoleName,
  type PendingUser,
  type RoleChangeRequest,
} from "@/lib/club-manager";
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
  const [tab, setTab] = useState<"pending" | "active" | "roles">("pending");
  const [role, setRole] = useState("ALL");
  const [pending, setPending] = useState<PendingUser[]>([]);
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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (tab === "pending") {
        const response = await listPendingUsers(role);
        setPending(response.data);
      } else if (tab === "active") {
        setPending(await listUsers("APPROVED", role));
      } else {
        setRoleRequests(await listRoleChangeRequests());
      }
    } catch (reason) {
      setError(clubManagerError(reason));
    } finally {
      setLoading(false);
    }
  }, [role, tab]);

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

  if (user.roleName !== "CLUB_MANAGER") {
    return <Notice error>Chỉ Club Manager mới được quản lý tài khoản.</Notice>;
  }

  return (
    <section className="dashboard-workspace">
      <div className="flex flex-col gap-4 border-b border-equine-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">RBAC · Club Manager</p>
          <h1 className="mt-2 font-sans text-3xl font-semibold text-equine-navy">Quản lý tài khoản</h1>
          <p className="mt-2 text-sm text-slate-600">Duyệt nhân sự, đổi vai trò và xử lý yêu cầu trong câu lạc bộ.</p>
        </div>
        <button type="button" className="soft-button h-10 px-4 text-equine-navy" onClick={() => void load()}><RefreshCw size={15} /> Làm mới</button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-equine-line pb-3">
        <button type="button" className={`soft-button h-10 px-4 ${tab === "pending" ? "bg-equine-navy text-white" : "bg-white text-slate-700"}`} onClick={() => { setRole("ALL"); setTab("pending"); }}><UserRound size={15} /> Chờ duyệt</button>
        <button type="button" className={`soft-button h-10 px-4 ${tab === "active" ? "bg-equine-navy text-white" : "bg-white text-slate-700"}`} onClick={() => { setRole("ALL"); setTab("active"); }}><UserRound size={15} /> Đang hoạt động</button>
        <button type="button" className={`soft-button h-10 px-4 ${tab === "roles" ? "bg-equine-navy text-white" : "bg-white text-slate-700"}`} onClick={() => setTab("roles")}><Lock size={15} /> Đổi vai trò</button>
      </div>

      {error && <div className="mt-5"><Notice error>{error}</Notice></div>}
      {notice && <div className="mt-5"><Notice>{notice}</Notice></div>}

      {(tab === "pending" || tab === "active") && <div className="mt-5 rounded-2xl border border-equine-line bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-sans text-xl font-semibold text-equine-navy">{tab === "pending" ? "Tài khoản chờ duyệt" : "Tài khoản đang hoạt động"}</h2><p className="mt-1 text-sm text-slate-500">{tab === "pending" ? "Horse Owner không xuất hiện vì được kích hoạt tự động." : "Có thể đổi vai trò hoặc khóa thành viên; không áp dụng với bạn và Club Manager."}</p></div><label className="flex items-center gap-2 rounded-xl border border-equine-line bg-[#f7f9ff] px-3 py-2 text-sm"><Filter size={15} /><select value={role} onChange={(event) => setRole(event.target.value)} className="border-0 bg-transparent outline-none"><option value="ALL">Tất cả vai trò</option>{(tab === "active" ? ACTIVE_ROLE_FILTERS : STAFF_ROLE_FILTERS).map((roleName) => <option key={roleName} value={roleName}>{roleLabels[roleName]}</option>)}</select></label></div>
        {loading ? <Notice>Đang tải danh sách tài khoản...</Notice> : pending.length === 0 ? <Notice>Không có tài khoản phù hợp.</Notice> : <div className="space-y-3">{pending.map((account) => {
          const protectedAccount = account.id === user.id || account.role_name === "CLUB_MANAGER";
          return <article key={account.id} className="flex flex-col gap-4 rounded-xl border border-equine-line p-4 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold text-equine-navy">{account.full_name}</h3><p className="text-sm text-slate-600">{account.email}{account.phone ? ` · ${account.phone}` : ""}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-equine-gold">{roleLabels[account.role_name]}</p></div><div className="flex flex-wrap gap-2">{tab === "pending" ? <><button type="button" className="gold-button h-10 px-4" onClick={() => void approve(account.id)}><Check size={15} /> Duyệt</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => setRejectTarget(account)}><X size={15} /> Từ chối</button></> : !protectedAccount && <><button type="button" className="soft-button h-10 px-4 text-equine-navy" onClick={() => editRole(account)}><Pencil size={15} /> Sửa vai trò</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => setLockTarget(account)}><Lock size={15} /> Khóa</button></>}</div></article>;
        })}</div>}
      </div>}

      {tab === "roles" && <div className="mt-5 rounded-2xl border border-equine-line bg-white p-4 shadow-sm"><div className="mb-4"><h2 className="font-sans text-xl font-semibold text-equine-navy">Yêu cầu đổi vai trò</h2><p className="mt-1 text-sm text-slate-500">Duyệt sẽ cập nhật role hiện tại; từ chối không thay đổi role.</p></div>{loading ? <Notice>Đang tải yêu cầu...</Notice> : roleRequests.length === 0 ? <Notice>Không có yêu cầu đổi vai trò đang chờ.</Notice> : <div className="space-y-3">{roleRequests.map((request) => <article key={request.id} className="flex flex-col gap-4 rounded-xl border border-equine-line p-4 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold text-equine-navy">{request.full_name}</h3><p className="text-sm text-slate-600">{request.email}</p><p className="mt-1 text-sm text-slate-700">{request.current_role ?? "Chưa có role"} → <strong>{request.requested_role}</strong></p>{request.reason && <p className="mt-1 text-xs text-slate-500">Lý do: {request.reason}</p>}</div><div className="flex flex-wrap gap-2"><button type="button" className="gold-button h-10 px-4" onClick={() => void reviewRoleChange(request, "approve")}><Check size={15} /> Duyệt</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => void reviewRoleChange(request, "reject")}><ShieldX size={15} /> Từ chối</button></div></article>)}</div>}</div>}

      {rejectTarget && <Modal title={`Từ chối ${rejectTarget.full_name}`} onClose={() => setRejectTarget(null)}><div className="space-y-4"><p className="text-sm text-slate-600">Bạn có thể nhập lý do để người dùng biết vì sao tài khoản bị từ chối.</p><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="field-control h-28 resize-none px-4 py-3" placeholder="Lý do từ chối (không bắt buộc)" /><div className="flex justify-end gap-2"><button type="button" className="soft-button h-10 px-4" onClick={() => setRejectTarget(null)}>Hủy</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => void reject()}><X size={15} /> Xác nhận từ chối</button></div></div></Modal>}
      {lockTarget && <Modal title={`Khóa ${lockTarget.full_name}`} onClose={() => setLockTarget(null)}><div className="space-y-4"><p className="text-sm text-slate-600">Tài khoản sẽ không thể đăng nhập sau khi bị khóa.</p><textarea value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} className="field-control h-28 resize-none px-4 py-3" placeholder="Lý do khóa (không bắt buộc)" /><div className="flex justify-end gap-2"><button type="button" className="soft-button h-10 px-4" onClick={() => setLockTarget(null)}>Hủy</button><button type="button" className="soft-button h-10 border-red-200 bg-red-50 px-4 text-red-700" onClick={() => void lock()}><Lock size={15} /> Xác nhận khóa</button></div></div></Modal>}
      {roleTarget && <Modal title={`Đổi vai trò · ${roleTarget.full_name}`} busy={savingRole} onClose={() => setRoleTarget(null)}><div className="space-y-4"><p className="text-sm text-slate-600">Vai trò hiện tại: <strong>{roleLabels[roleTarget.role_name]}</strong>. Người dùng sẽ được thông báo và cần đăng nhập lại để áp dụng quyền mới.</p><label className="block"><span className="field-label">Vai trò mới</span><select value={nextRole} onChange={(event) => setNextRole(event.target.value as AssignableRoleName)} className="field-control h-12 px-4">{EDITABLE_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><div className="flex justify-end gap-2 pt-2"><button type="button" className="soft-button h-10 px-4" disabled={savingRole} onClick={() => setRoleTarget(null)}>Hủy</button><button type="button" className="gold-button h-10 px-4" disabled={savingRole || nextRole === roleTarget.role_name} onClick={() => void saveRole()}>{savingRole ? "Đang lưu..." : "Lưu vai trò"}</button></div></div></Modal>}
    </section>
  );
}
