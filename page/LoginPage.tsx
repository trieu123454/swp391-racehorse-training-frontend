"use client";

import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
} from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { Brand } from "@/components/shared/Brand";
import { ApiRequestError, login } from "@/api/client";
import { routeForRole } from "@/lib/roles";
import { saveSession } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

function loginErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    const message = error.message.toLowerCase();
    if (message.includes("email or password is incorrect") || message.includes("user not found")) {
      return "Email hoặc mật khẩu không chính xác.";
    }
    if (message.includes("awaiting club manager approval")) {
      return "Tài khoản đang chờ Quản lý Câu lạc bộ phê duyệt.";
    }
    if (message.includes("account is locked") || message.includes("account is deleted")) {
      return "Tài khoản hiện không thể đăng nhập. Vui lòng liên hệ Quản lý Câu lạc bộ.";
    }
  }
  return error instanceof Error ? error.message : "Đăng nhập không thành công. Vui lòng thử lại.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const completeLogin = useCallback(
    (auth: AuthResponse) => {
      saveSession(auth, remember);
      router.replace(
        auth.user.mustChangePassword
          ? Routes.changePassword
          : routeForRole(auth.user.roleName),
      );
    },
    [router, remember],
  );
  const showGoogleError = useCallback((message: string) => setError(message), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      completeLogin(await login(email.trim(), password));
    } catch (reason) {
      setError(loginErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

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

      <div className="auth-layout">
        <AuthVisual />
        <section className="auth-form-panel">
          <div className="auth-form-content">
            <div className="auth-form-brand"><Brand /></div>
            <h1 className="auth-title">
              Đăng nhập hệ thống
            </h1>
            <p className="auth-subtitle">
              Nhập email và mật khẩu để tiếp tục.
            </p>

            <form className="auth-form" onSubmit={handleSubmit}>
              <label className="block">
                <span className="field-label">Email tài khoản</span>
                <span className="relative block">
                  <Mail
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    size={19}
                  />
                  <input
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    className="field-control pl-12"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ten@equine.vn"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                </span>
              </label>

              <label className="block">
                <span className="field-label">Mật khẩu</span>
                <span className="relative block">
                  <LockKeyhole
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    size={19}
                  />
                  <input
                    autoComplete="current-password"
                    className="field-control pl-12 pr-12"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Nhập mật khẩu"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={showPassword}
                    className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-slate-500"
                    onClick={() => setShowPassword((visible) => !visible)}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </span>
              </label>

              <label className="auth-checkbox-row cursor-pointer">
                <input
                  checked={remember}
                  className="h-4 w-4"
                  onChange={(event) => setRemember(event.target.checked)}
                  type="checkbox"
                />
                Ghi nhớ đăng nhập trong tab này
              </label>

              {error ? (
                <p className="auth-feedback auth-feedback--error" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                aria-busy={loading}
                className="gold-button auth-submit w-full"
                disabled={loading}
                type="submit"
              >
                {loading ? "Đang đăng nhập…" : "Đăng nhập"}
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </form>

            <div className="auth-divider">
              Hoặc đăng nhập bằng
            </div>
            <GoogleAuthButton
              label="signin_with"
              onError={showGoogleError}
              onSuccess={completeLogin}
            />

            <p className="auth-footer">
              Chưa có tài khoản?{" "}
              <Link
                className="font-bold uppercase text-equine-gold hover:underline"
                href={Routes.register}
              >
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
