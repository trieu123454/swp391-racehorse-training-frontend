"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Brand } from "@/shared/components/Brand";
import { changePassword, validateSession } from "@/lib/api";
import { routeForRole } from "@/lib/roles";
import { isRemembered, saveSession } from "@/lib/session";
import type { AuthUser } from "@/lib/types";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    validateSession()
      .then((sessionUser) => {
        if (!active) return;
        if (!sessionUser.mustChangePassword) {
          router.replace(routeForRole(sessionUser.roleName));
          return;
        }
        setUser(sessionUser);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu mới xác nhận chưa trùng khớp.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Mật khẩu mới phải khác mật khẩu tạm thời.");
      return;
    }

    setLoading(true);
    try {
      const auth = await changePassword(currentPassword, newPassword);
      saveSession(auth, isRemembered());
      router.replace(routeForRole(auth.user.roleName));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi mật khẩu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-equine-paper px-4 py-10">
      <section className="w-full max-w-xl rounded-[28px] border border-equine-line bg-white p-6 shadow-[0_30px_80px_-40px_rgba(11,25,44,0.5)] sm:p-10">
        <Link href="/" className="inline-flex"><Brand /></Link>
        <h1 className="mt-8 font-sans text-3xl font-semibold text-equine-navy">Đổi mật khẩu lần đầu</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {user
            ? `Xin chào ${user.fullName}. Hãy nhập mật khẩu tạm thời Club Manager đã cấp và chọn mật khẩu mới để tiếp tục.`
            : "Đang xác thực tài khoản..."}
        </p>
        <form className="mt-7 space-y-5" onSubmit={submit}>
          <PasswordField label="Mật khẩu hiện tại" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
          <PasswordField label="Mật khẩu mới" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
          <PasswordField label="Xác nhận mật khẩu mới" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
          {error ? <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p> : null}
          <button className="gold-button w-full" disabled={!user || loading} type="submit">
            {loading ? "Đang cập nhật..." : "Lưu mật khẩu mới"}
          </button>
        </form>
      </section>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
        <input
          autoComplete={autoComplete}
          className="field-control"
          minLength={8}
          onChange={(event) => onChange(event.target.value)}
          required
          type="password"
          value={value}
        />
      </span>
    </label>
  );
}
