"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  Filter,
  Lock,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Shield,
  Unlock,
  UserCheck,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import HorseShell, { useHorseUser } from "@/components/horses/HorseShell";
import { Modal, Notice } from "@/components/horses/HorseUI";
import { ApiRequestError } from "@/api/client";
import {
  clubManagerError,
  createStaffAccount,
  listUsers,
  lockUser,
  unlockUser,
  updateUserRole,
  type AssignableRoleName,
  type CreatableRoleName,
  type PendingUser,
} from "@/api/club-manager/api";
import { roleLabels } from "@/lib/roles";

const ROLE_FILTERS = ["HEAD_TRAINER", "HEAD_VETERINARIAN", "VETERINARIAN", "GROOM", "HORSE_OWNER", "CLUB_MANAGER"] as const;

const EDITABLE_ROLES: Array<{ value: AssignableRoleName; label: string }> = [
  { value: "HEAD_TRAINER", label: roleLabels.HEAD_TRAINER },
  { value: "HEAD_VETERINARIAN", label: roleLabels.HEAD_VETERINARIAN },
  { value: "VETERINARIAN", label: roleLabels.VETERINARIAN },
  { value: "GROOM", label: roleLabels.GROOM },
  { value: "HORSE_OWNER", label: roleLabels.HORSE_OWNER },
];

const ROLE_STYLES: Record<string, { label: string; badge: string; avatar: string }> = {
  CLUB_MANAGER: {
    label: "Quản lý câu lạc bộ",
    badge: "bg-purple-50 text-purple-700 border-purple-200",
    avatar: "bg-purple-100 text-purple-700 border-purple-200",
  },
  HEAD_TRAINER: {
    label: "Huấn luyện viên trưởng",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
    avatar: "bg-amber-100 text-amber-800 border-amber-200",
  },
  HEAD_VETERINARIAN: {
    label: "Trưởng ban thú y",
    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
    avatar: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  VETERINARIAN: {
    label: "Bác sĩ thú y",
    badge: "bg-teal-50 text-teal-800 border-teal-200",
    avatar: "bg-teal-100 text-teal-800 border-teal-200",
  },
  GROOM: {
    label: "Nhân viên chăm sóc chuồng trại",
    badge: "bg-sky-50 text-sky-800 border-sky-200",
    avatar: "bg-sky-100 text-sky-800 border-sky-200",
  },
  HORSE_OWNER: {
    label: "Chủ sở hữu ngựa",
    badge: "bg-indigo-50 text-indigo-800 border-indigo-200",
    avatar: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
};

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ClubManagerUsersPage() {
  return (
    <HorseShell>
      <AccountManagement />
    </HorseShell>
  );
}

function AccountManagement() {
  const user = useHorseUser();
  const [tab, setTab] = useState<"active" | "locked" | "create">("active");
  const [role, setRole] = useState("ALL");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [lockTarget, setLockTarget] = useState<PendingUser | null>(null);
  const [lockReason, setLockReason] = useState("");
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
    if (tab === "create") return;
    setLoading(true);
    setError("");
    try {
      if (tab === "active") {
        setUsers(await listUsers("APPROVED", role));
      } else if (tab === "locked") {
        setUsers(await listUsers("LOCKED", role));
      }
    } catch (reason) {
      setUsers([]);
      setError(clubManagerError(reason));
    } finally {
      setLoading(false);
    }
  }, [role, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function lock() {
    if (!lockTarget) return;
    try {
      await lockUser(lockTarget.id, lockReason);
      setLockTarget(null);
      setLockReason("");
      setNotice(`Đã khóa tài khoản của ${lockTarget.full_name}.`);
      await load();
    } catch (reason) {
      setError(clubManagerError(reason));
    }
  }

  async function unlock(id: number, name: string) {
    try {
      await unlockUser(id);
      setNotice(`Đã mở khóa tài khoản của ${name}. Người dùng có thể đăng nhập lại.`);
      await load();
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 401) setUsers([]);
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
      setNotice(`Đã đổi vai trò của ${roleTarget.full_name} thành ${roleLabels[nextRole]}. Người dùng cần đăng nhập lại để áp dụng quyền mới.`);
      setRoleTarget(null);
      await load();
    } catch (reason) {
      setError(clubManagerError(reason));
    } finally {
      setSavingRole(false);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setCreatedCredentials(null);
    setCopiedCredentials(false);
    const trimmedPhone = newStaff.phone.trim();
    if (trimmedPhone && !/^(?:\+84|0)[35789]\d{8}$/.test(trimmedPhone)) {
      setError("Số điện thoại không đúng định dạng Việt Nam (ví dụ: 0912345678 hoặc +84912345678).");
      return;
    }
    setCreatingStaff(true);
    try {
      const created = await createStaffAccount({
        ...newStaff,
        phone: trimmedPhone || undefined,
      });
      setNotice(`Đã tạo tài khoản ${created.email}. Mật khẩu tạm thời đã được tự động gửi qua email và số điện thoại (SMS) của nhân sự.`);
      setCreatedCredentials({ email: created.email, password: newStaff.password });
      setNewStaff({ fullName: "", email: "", phone: "", password: "", roleName: "GROOM" });
    } catch (reason) {
      setError(clubManagerError(reason));
    } finally {
      setCreatingStaff(false);
    }
  }

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const term = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.phone && u.phone.toLowerCase().includes(term)),
    );
  }, [users, search]);

  if (user.roleName !== "CLUB_MANAGER") {
    return <Notice error>Chỉ Club Manager mới được quản lý tài khoản.</Notice>;
  }

  return (
    <section className="dashboard-workspace">
      {/* Page Header */}
      <div className="flex flex-col gap-4 border-b border-equine-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-sans text-3xl font-semibold text-slate-900">Quản lý tài khoản</h1>
          <p className="mt-1 text-sm font-medium text-slate-700">
            Xem danh sách thành viên, cập nhật vai trò, khóa/mở khóa tài khoản hoặc cấp tài khoản nhân sự mới.
          </p>
        </div>
        <button
          type="button"
          className="soft-button h-10 px-4 text-equine-navy hover:bg-slate-100"
          onClick={() => void load()}
        >
          <RefreshCw size={15} /> Làm mới
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2 border-b border-equine-line pb-3">
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "active"
              ? "border-primary bg-primary text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => {
            setRole("ALL");
            setSearch("");
            setTab("active");
          }}
        >
          <UserCheck size={16} /> Đang hoạt động
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "locked"
              ? "border-primary bg-primary text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => {
            setRole("ALL");
            setSearch("");
            setTab("locked");
          }}
        >
          <Lock size={16} /> Đã khóa
        </button>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
            tab === "create"
              ? "border-primary bg-primary text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          onClick={() => {
            setTab("create");
          }}
        >
          <UserPlus size={16} /> Tạo tài khoản nhân sự
        </button>
      </div>

      {error && <div className="mt-5"><Notice error>{error}</Notice></div>}
      {notice && <div className="mt-5"><Notice>{notice}</Notice></div>}

      {/* Tab: Cấp tài khoản nhân sự */}
      {tab === "create" && (
        <div className="mt-5 max-w-3xl">
          {createdCredentials && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-emerald-800 text-base">
                <Check size={18} className="text-emerald-600" />
                Khởi tạo tài khoản thành công!
              </div>
              <p className="mt-2 text-slate-700">Thông tin đăng nhập đã được gửi tới email của nhân sự:</p>
              <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3 space-y-1.5 font-mono text-xs">
                <p>Email: <strong className="text-slate-900">{createdCredentials.email}</strong></p>
                <p>Mật khẩu tạm: <strong className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{createdCredentials.password}</strong></p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="soft-button h-9 bg-white px-3.5 text-xs text-slate-700 hover:bg-emerald-100"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(`Email: ${createdCredentials.email}\nMật khẩu tạm: ${createdCredentials.password}`)
                      .then(() => setCopiedCredentials(true))
                      .catch(() => setError("Không thể sao chép. Hãy sao chép thông tin hiển thị thủ công."))
                  }
                >
                  <Copy size={14} /> {copiedCredentials ? "Đã sao chép!" : "Sao chép thông tin"}
                </button>
                <button
                  type="button"
                  className="soft-button h-9 bg-white px-3.5 text-xs text-slate-600 hover:bg-slate-100"
                  onClick={() => setCreatedCredentials(null)}
                >
                  Ẩn thông báo
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-equine-line bg-white p-6 shadow-xs sm:p-8">
            <h2 className="font-sans text-xl font-normal text-equine-navy">Cấp tài khoản nhân sự mới</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Mật khẩu tạm sẽ tự động được gửi qua Email và Số điện thoại (SMS) của nhân sự. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu tiên.
            </p>
            <form className="mt-6 space-y-4" onSubmit={createAccount}>
              <label className="block">
                <span className="field-label font-medium text-slate-700">Họ và tên</span>
                <input
                  className="field-control px-4"
                  maxLength={100}
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={newStaff.fullName}
                  onChange={(event) => setNewStaff((current) => ({ ...current, fullName: event.target.value }))}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="field-label font-medium text-slate-700">Gmail / Email</span>
                  <input
                    autoComplete="email"
                    className="field-control px-4"
                    maxLength={100}
                    required
                    placeholder="nhansu@gmail.com"
                    type="email"
                    value={newStaff.email}
                    onChange={(event) => setNewStaff((current) => ({ ...current, email: event.target.value }))}
                  />
                </label>
                <label className="block">
                  <span className="field-label font-medium text-slate-700">Số điện thoại (không bắt buộc)</span>
                  <input
                    autoComplete="tel"
                    inputMode="tel"
                    className="field-control px-4"
                    maxLength={15}
                    placeholder="Ví dụ: 0912345678"
                    type="tel"
                    value={newStaff.phone}
                    onChange={(event) => {
                      const cleaned = event.target.value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
                      setNewStaff((current) => ({ ...current, phone: cleaned }));
                    }}
                  />
                  <span className="mt-1 block text-xs text-slate-500">Định dạng 10 chữ số (VD: 0912345678). Để trống nếu chưa có.</span>
                </label>
              </div>

              <label className="block">
                <span className="field-label font-medium text-slate-700">Vai trò chuyên môn</span>
                <select
                  className="field-control px-4"
                  value={newStaff.roleName}
                  onChange={(event) => setNewStaff((current) => ({ ...current, roleName: event.target.value as CreatableRoleName }))}
                >
                  <option value="GROOM">{roleLabels.GROOM}</option>
                  <option value="HEAD_TRAINER">{roleLabels.HEAD_TRAINER}</option>
                  <option value="HEAD_VETERINARIAN">{roleLabels.HEAD_VETERINARIAN}</option>
                  <option value="VETERINARIAN">{roleLabels.VETERINARIAN}</option>
                  <option value="CLUB_MANAGER">{roleLabels.CLUB_MANAGER}</option>
                </select>
              </label>

              <label className="block">
                <span className="field-label font-medium text-slate-700">Mật khẩu tạm thời</span>
                <input
                  autoComplete="new-password"
                  className="field-control px-4"
                  minLength={8}
                  required
                  placeholder="Tối thiểu 8 ký tự"
                  type="password"
                  value={newStaff.password}
                  onChange={(event) => setNewStaff((current) => ({ ...current, password: event.target.value }))}
                />
                <span className="mt-1 block text-xs text-slate-500">Tối thiểu 8 ký tự. Nhân sự sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu tiên.</span>
              </label>

              <div className="pt-2">
                <button className="gold-button w-full sm:w-auto h-11 px-6 text-sm" disabled={creatingStaff} type="submit">
                  {creatingStaff ? "Đang tạo tài khoản..." : "Tạo và cấp tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Danh sách Đang hoạt động / Đã khóa */}
      {(tab === "active" || tab === "locked") && (
        <div className="mt-5 space-y-4">
          {/* Controls: Search and Role Filter */}
          <div className="rounded-xl border border-equine-line bg-white p-4 shadow-xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên, email, số điện thoại..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary focus:bg-white focus:outline-hidden transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              {/* Role Filter & Count */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <Filter size={15} className="text-slate-500" />
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    className="border-0 bg-transparent text-sm font-medium text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="ALL">Tất cả vai trò</option>
                    {ROLE_FILTERS.map((roleName) => (
                      <option key={roleName} value={roleName}>
                        {roleLabels[roleName]}
                      </option>
                    ))}
                  </select>
                </label>

                <span className="text-xs font-medium text-slate-500 hidden sm:inline-block">
                  Tổng cộng: <strong className="text-slate-900">{filteredUsers.length}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* User Cards List */}
          {loading ? (
            <Notice>Đang tải danh sách tài khoản...</Notice>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-500">
              <UserRound className="mx-auto h-10 w-10 text-slate-400 stroke-1" />
              <p className="mt-3 text-sm font-medium text-slate-700">Không tìm thấy tài khoản nào phù hợp</p>
              <p className="mt-1 text-xs text-slate-400">
                {search ? "Hãy thử tìm kiếm với từ khóa khác hoặc bỏ bộ lọc vai trò." : "Chưa có tài khoản nào trong danh sách này."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredUsers.map((account) => {
                const protectedAccount = account.id === user.id || account.role_name === "CLUB_MANAGER";
                const isSelf = account.id === user.id;
                const roleConfig = ROLE_STYLES[account.role_name] ?? {
                  label: roleLabels[account.role_name] ?? account.role_name,
                  badge: "bg-slate-100 text-slate-700 border-slate-200",
                  avatar: "bg-slate-200 text-slate-700 border-slate-300",
                };

                return (
                  <article
                    key={account.id}
                    className="group rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-blue-300 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {/* Left: Avatar & User Info */}
                      <div className="flex items-start gap-4 min-w-0">
                        {/* Avatar */}
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold text-base border shadow-xs ${roleConfig.avatar}`}
                        >
                          {getInitials(account.full_name)}
                        </div>

                        {/* Text Details */}
                        <div className="min-w-0 flex-1">
                          {/* Name + Role Badge + Status Badge */}
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-sans text-base font-semibold text-slate-900 truncate">
                              {account.full_name}
                            </h3>

                            {/* Role Badge */}
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${roleConfig.badge}`}
                            >
                              <Shield size={12} className="shrink-0 opacity-70" />
                              {roleConfig.label}
                            </span>

                            {/* Status Badge */}
                            {account.status === "LOCKED" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                Đã khóa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Đang hoạt động
                              </span>
                            )}

                            {isSelf && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                                Bạn
                              </span>
                            )}
                          </div>

                          {/* Contact: Email & Phone */}
                          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-slate-800">
                            <a
                              href={`mailto:${account.email}`}
                              className="inline-flex items-center gap-1.5 text-slate-900 font-medium hover:text-primary transition-colors"
                              title="Gửi email"
                            >
                              <Mail size={15} className="text-slate-600 shrink-0" />
                              <span className="font-mono text-xs sm:text-sm">{account.email}</span>
                            </a>

                            {account.phone ? (
                              <a
                                href={`tel:${account.phone}`}
                                className="inline-flex items-center gap-1.5 text-slate-900 font-medium hover:text-primary transition-colors"
                                title="Gọi điện"
                              >
                                <Phone size={15} className="text-slate-600 shrink-0" />
                                <span className="font-mono text-xs sm:text-sm font-semibold">{account.phone}</span>
                              </a>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium italic">
                                <Phone size={13} className="text-slate-400" /> Chưa cập nhật SĐT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Action Buttons */}
                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-end">
                        {tab === "locked" ? (
                          !protectedAccount && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-xs"
                              onClick={() => void unlock(account.id, account.full_name)}
                            >
                              <Unlock size={14} /> Mở khóa
                            </button>
                          )
                        ) : (
                          <>
                            {!protectedAccount ? (
                              <>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-xs"
                                  onClick={() => editRole(account)}
                                >
                                  <Pencil size={13} className="text-slate-500" /> Sửa vai trò
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-xs"
                                  onClick={() => setLockTarget(account)}
                                >
                                  <Lock size={13} /> Khóa
                                </button>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 italic px-2">
                                {isSelf ? "Tài khoản hiện tại" : "Quản trị viên CLB"}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Khóa tài khoản */}
      {lockTarget && (
        <Modal title={`Khóa tài khoản · ${lockTarget.full_name}`} onClose={() => setLockTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Tài khoản <strong>{lockTarget.email}</strong> sẽ bị vô hiệu hóa và không thể đăng nhập vào hệ thống sau khi khóa.
            </p>
            <label className="block">
              <span className="field-label font-medium text-slate-700">Lý do khóa (tùy chọn)</span>
              <textarea
                value={lockReason}
                onChange={(event) => setLockReason(event.target.value)}
                className="field-control h-24 resize-none px-4 py-2.5 text-sm"
                placeholder="Nhập lý do khóa tài khoản này..."
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="soft-button h-10 px-4 text-sm" onClick={() => setLockTarget(null)}>
                Hủy
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 transition-colors"
                onClick={() => void lock()}
              >
                <Lock size={15} /> Xác nhận khóa
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal: Đổi vai trò */}
      {roleTarget && (
        <Modal title={`Đổi vai trò · ${roleTarget.full_name}`} busy={savingRole} onClose={() => setRoleTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Vai trò hiện tại: <strong className="text-slate-900">{roleLabels[roleTarget.role_name]}</strong>. Người dùng sẽ nhận được thông báo và cần đăng nhập lại để áp dụng quyền mới.
            </p>
            <label className="block">
              <span className="field-label font-medium text-slate-700">Chọn vai trò mới</span>
              <select
                value={nextRole}
                onChange={(event) => setNextRole(event.target.value as AssignableRoleName)}
                className="field-control h-11 px-4 text-sm"
              >
                {EDITABLE_ROLES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="soft-button h-10 px-4 text-sm"
                disabled={savingRole}
                onClick={() => setRoleTarget(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="gold-button h-10 px-5 text-sm"
                disabled={savingRole || nextRole === roleTarget.role_name}
                onClick={() => void saveRole()}
              >
                {savingRole ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
