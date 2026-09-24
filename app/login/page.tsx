"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import { AuthVisual } from "@/components/AuthVisual";
import { Brand } from "@/components/Brand";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { login } from "@/lib/api";
import { routeForRole } from "@/lib/roles";
import { saveSession } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

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
      saveSession(auth);
      router.replace(routeForRole(auth.user.roleName));
    },
    [router],
  );
  const showError = useCallback((message: string) => setError(message), []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      completeLogin(await login(email, password));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đăng nhập không thành công",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-equine-paper px-4 py-6 sm:px-8 lg:py-8">
      <div className="mx-auto mb-6 flex max-w-[1440px] items-center justify-between gap-4">
        <Link
          className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase text-slate-600 hover:text-equine-navy sm:text-xs"
          href="/"
        >
          <ArrowLeft size={17} /> Về trang chủ
        </Link>
        <div className="min-w-0 flex-1 sm:flex-none">
          <Brand compact />
        </div>
      </div>
      <div className="mx-auto grid min-w-0 max-w-[1360px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_-20px_rgba(11,25,44,0.25)] lg:grid-cols-[1fr_1.08fr]">
        <AuthVisual mode="login" />
        <section className="flex min-h-[720px] min-w-0 max-w-full items-center overflow-hidden px-5 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto w-full min-w-0 max-w-[550px]">
            <Brand />
            <h1 className="mt-8 font-sans text-3xl font-semibold text-equine-navy sm:text-5xl">
              Đăng nhập hệ thống
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Chào mừng trở lại. Nhập thông tin tài khoản để truy cập không gian
              làm việc chuyên biệt.
            </p>
            <form className="mt-9 space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="field-label">Email / Tên đăng nhập</span>
                <span className="relative block">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    size={19}
                  />
                  <input
                    autoComplete="email"
                    className="field-control"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="trainer@equinesovereign.com"
                    required
                    type="email"
                    value={email}
                  />
                </span>
              </label>
              <label className="block">
                <span className="field-label">Mật khẩu</span>
                <span className="relative block">
                  <LockKeyhole
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    size={19}
                  />
                  <input
                    autoComplete="current-password"
                    className="field-control pr-12"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Nhập mật khẩu"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                  />
                  <button
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-slate-500"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </span>
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    checked={remember}
                    className="h-4 w-4 accent-[#0b192c]"
                    onChange={(event) => setRemember(event.target.checked)}
                    type="checkbox"
                  />{" "}
                  Ghi nhớ đăng nhập
                </label>
                <button
                  className="font-semibold text-equine-gold hover:underline"
                  type="button"
                >
                  Quên mật khẩu?
                </button>
              </div>
              {error ? (
                <p
                  className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
              <button
                className="gold-button w-full"
                disabled={loading}
                type="submit"
              >
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                <ArrowRight size={18} />
              </button>
            </form>
            <div className="my-6 flex items-center gap-4 text-[10px] font-bold uppercase text-slate-500">
              <span className="h-px flex-1 bg-equine-line" />
              Hoặc đăng nhập bằng
              <span className="h-px flex-1 bg-equine-line" />
            </div>
            <GoogleAuthButton
              label="signin_with"
              onError={showError}
              onSuccess={completeLogin}
            />
            <div className="mt-5 flex gap-3 rounded-md bg-[#eef1ff] p-4 text-xs leading-5 text-slate-600">
              <ShieldCheck className="shrink-0 text-equine-gold" size={19} />
              <p>
                Hệ thống tự xác định vai trò và đưa bạn đến đúng bảng điều
                khiển.
              </p>
            </div>
            <p className="mt-7 text-center text-sm text-slate-600">
              Chưa có tài khoản?{" "}
              <Link
                className="font-bold uppercase text-equine-gold hover:underline"
                href="/register"
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
