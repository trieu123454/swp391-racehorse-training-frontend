"use client";

import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { Brand } from "@/components/shared/Brand";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { register } from "@/api/client";
import { routeForRole } from "@/lib/roles";
import { saveSession } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const update = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const googleSuccess = useCallback(
    (auth: AuthResponse) => {
      saveSession(auth);
      router.replace(
        auth.user.mustChangePassword
          ? Routes.changePassword
          : routeForRole(auth.user.roleName),
      );
    },
    [router],
  );
  const showError = useCallback((value: string) => setError(value), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận chưa trùng khớp.");
      return;
    }
    setLoading(true);
    try {
      await register({
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        roleName: "HORSE_OWNER",
      });
      setMessage("Đăng ký thành công. Bạn có thể đăng nhập ngay.");
      setForm({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng ký không thành công");
    } finally {
      setLoading(false);
    }
  }

  const input = (
    label: string,
    key: keyof typeof form,
    Icon: typeof UserRound,
    type = "text",
    placeholder = "",
  ) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <span className="relative block">
        <Icon
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
          size={18}
        />
        <input
          className="field-control"
          autoComplete={key === "fullName" ? "name" : key === "email" ? "email" : key === "phone" ? "tel" : "new-password"}
          minLength={type === "password" ? 8 : undefined}
          onChange={(event) => update(key)(event.target.value)}
          placeholder={placeholder}
          required={key !== "phone"}
          type={type}
          value={form[key]}
        />
      </span>
    </label>
  );

  return (
    <main className="auth-page auth-page--standard overflow-x-hidden">
      <div className="auth-topbar">
        <Link
          className="auth-back"
          href={Routes.home}
        >
          <ArrowLeft size={17} /> Về trang chủ
        </Link>
      </div>
      <div className="auth-layout auth-layout--register">
        <AuthVisual />
        <section className="auth-form-panel">
          <div className="auth-form-content">
            <div className="auth-form-brand"><Brand /></div>
            <h1 className="auth-title">
              Đăng ký tài khoản mới
            </h1>
            <p className="auth-subtitle">
              Tạo tài khoản Chủ ngựa để bắt đầu.
            </p>
            <form className="auth-form" onSubmit={handleSubmit}>
              {input(
                "Họ và tên",
                "fullName",
                UserRound,
                "text",
                "Nguyễn Văn Tuấn",
              )}
              <div className="auth-form-grid">
                {input(
                  "Email",
                  "email",
                  Mail,
                  "email",
                  "tuan.nguyen@example.com",
                )}
                {input(
                  "Số điện thoại",
                  "phone",
                  Phone,
                  "tel",
                  "+84 912 345 678",
                )}
              </div>
              <div className="auth-form-grid">
                <label className="block">
                  <span className="field-label">Mật khẩu</span>
                  <span className="relative block">
                    <LockKeyhole
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                      size={18}
                    />
                    <input
                      className="field-control pr-12"
                      minLength={8}
                      onChange={(event) =>
                        update("password")(event.target.value)
                      }
                      placeholder="Tối thiểu 8 ký tự"
                      required
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                    />
                    <button
                      aria-label="Hiện hoặc ẩn mật khẩu"
                      className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-slate-500"
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </span>
                </label>
                {input(
                  "Xác nhận mật khẩu",
                  "confirmPassword",
                  LockKeyhole,
                  showPassword ? "text" : "password",
                  "Nhập lại mật khẩu",
                )}
              </div>
              <div className="auth-register-notice">
                <AlertTriangle className="shrink-0" size={19} />
                <p>
                  Tài khoản đăng ký tại đây là tài khoản Chủ ngựa. Các vai trò
                  nhân sự khác do Club Manager cấp tài khoản.
                </p>
              </div>
              <label className="auth-legal cursor-pointer">
                <input
                  checked={accepted}
                  className="mt-1 h-4 w-4"
                  onChange={(event) => setAccepted(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span>
                  Tôi đồng ý với{" "}
                  <strong className="font-semibold text-[#a03b00]">
                    Điều khoản sử dụng
                  </strong>{" "}
                  và Chính sách bảo mật câu lạc bộ.
                </span>
              </label>
              {message ? (
                <p className="auth-feedback auth-feedback--success">
                  {message}
                </p>
              ) : null}
              {error ? (
                <p
                  className="auth-feedback auth-feedback--error"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <button
                className="gold-button auth-submit w-full"
                disabled={loading || !accepted}
                type="submit"
              >
                {loading ? "Đang gửi đăng ký..." : "Đăng ký tài khoản"}
              </button>
            </form>
            <div className="auth-divider">
              Hoặc đăng ký bằng
            </div>
            <GoogleAuthButton
              label="signup_with"
              onError={showError}
              onSuccess={googleSuccess}
              roleName="HORSE_OWNER"
            />
            <p className="auth-footer">
              Đã có tài khoản thành viên?{" "}
              <Link
                className="font-bold uppercase text-equine-gold hover:underline"
                href={Routes.login}
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
