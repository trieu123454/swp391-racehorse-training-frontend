"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  LockKeyhole,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Brand } from "@/components/shared/Brand";
import { forgotPassword, resetPassword, ApiRequestError } from "@/api/client";
import { Routes } from "@/routes/Routes";

type Step = "REQUEST_CODE" | "VERIFY_AND_RESET" | "SUCCESS";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("REQUEST_CODE");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Step 1: Submit email to receive OTP
  async function handleRequestCode(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!email.trim()) {
      setError("Vui lòng nhập địa chỉ email.");
      return;
    }

    setLoading(true);
    try {
      const res = await forgotPassword(email.trim());
      setNotice(res.message || "Mã xác nhận đã được gửi về email của bạn.");
      setStep("VERIFY_AND_RESET");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Không thể gửi mã xác nhận. Vui lòng kiểm tra lại email hoặc thử lại sau.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Resend OTP code
  async function handleResendCode() {
    setError("");
    setResending(true);
    try {
      const res = await forgotPassword(email.trim());
      setNotice(res.message || "Đã gửi lại mã xác nhận mới đến email của bạn.");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Không thể gửi lại mã xác nhận. Vui lòng thử lại sau.");
      }
    } finally {
      setResending(false);
    }
  }

  // Step 2: Submit OTP code and new password
  async function handleResetPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!code.trim() || code.trim().length !== 6) {
      setError("Mã xác nhận phải gồm đúng 6 chữ số.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Xác nhận mật khẩu mới chưa khớp.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim(), code.trim(), newPassword);
      setStep("SUCCESS");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Không thể đặt lại mật khẩu. Vui lòng kiểm tra lại mã xác nhận.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-equine-paper px-4 py-10">
      <section className="w-full max-w-xl rounded-[28px] border border-equine-line bg-white p-6 shadow-[0_30px_80px_-40px_rgba(11,25,44,0.5)] sm:p-10">
        <Link href={Routes.home} className="inline-flex">
          <Brand />
        </Link>

        {step === "REQUEST_CODE" && (
          <div className="mt-8">
            <h1 className="font-sans text-3xl font-semibold text-equine-navy">
              Quên mật khẩu
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Nhập email tài khoản của bạn. Hệ thống sẽ gửi một mã xác nhận (OTP) 6 chữ số qua email để bạn đặt lại mật khẩu mới.
            </p>

            <form className="mt-7 space-y-5" onSubmit={handleRequestCode}>
              <label className="block">
                <span className="field-label">Địa chỉ email</span>
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
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ten@equine.vn"
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                </span>
              </label>

              {error && (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <button
                aria-busy={loading}
                className="gold-button auth-submit w-full"
                disabled={loading}
                type="submit"
              >
                {loading ? "Đang gửi mã xác nhận…" : "Gửi mã xác nhận"}
                <ArrowRight aria-hidden="true" size={18} />
              </button>

              <div className="pt-2 text-center">
                <Link
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-equine-navy hover:underline"
                  href={Routes.login}
                >
                  <ArrowLeft size={16} /> Quay lại đăng nhập
                </Link>
              </div>
            </form>
          </div>
        )}

        {step === "VERIFY_AND_RESET" && (
          <div className="mt-8">
            <h1 className="font-sans text-3xl font-semibold text-equine-navy">
              Đặt lại mật khẩu
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Mã xác nhận đã được gửi đến <strong className="text-equine-navy">{email}</strong>. Vui lòng kiểm tra hộp thư đến (và thư rác) để lấy mã OTP gồm 6 chữ số.
            </p>

            {notice && (
              <div className="mt-4 rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {notice}
              </div>
            )}

            <form className="mt-6 space-y-5" onSubmit={handleResetPassword}>
              <label className="block">
                <span className="field-label">Mã xác nhận (OTP 6 số)</span>
                <span className="relative block">
                  <KeyRound
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    size={19}
                  />
                  <input
                    autoComplete="one-time-code"
                    className="field-control pl-12 tracking-widest text-lg font-mono"
                    maxLength={6}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    required
                    type="text"
                    value={code}
                  />
                </span>
              </label>

              <label className="block">
                <span className="field-label">Mật khẩu mới</span>
                <span className="relative block">
                  <LockKeyhole
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    size={19}
                  />
                  <input
                    autoComplete="new-password"
                    className="field-control pl-12 pr-12"
                    minLength={8}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                    required
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                  />
                  <button
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center text-slate-500"
                    onClick={() => setShowPassword((v) => !v)}
                    type="button"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </span>
              </label>

              <label className="block">
                <span className="field-label">Xác nhận mật khẩu mới</span>
                <span className="relative block">
                  <LockKeyhole
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
                    size={19}
                  />
                  <input
                    autoComplete="new-password"
                    className="field-control pl-12"
                    minLength={8}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    required
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                  />
                </span>
              </label>

              {error && (
                <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}

              <button
                aria-busy={loading}
                className="gold-button auth-submit w-full"
                disabled={loading}
                type="submit"
              >
                {loading ? "Đang xử lý…" : "Xác nhận đặt lại mật khẩu"}
                <ArrowRight aria-hidden="true" size={18} />
              </button>

              <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row text-sm">
                <button
                  className="inline-flex items-center gap-1.5 font-medium text-equine-gold hover:underline disabled:opacity-50"
                  disabled={resending}
                  onClick={handleResendCode}
                  type="button"
                >
                  <RefreshCw size={14} className={resending ? "animate-spin" : ""} />
                  {resending ? "Đang gửi lại…" : "Gửi lại mã xác nhận"}
                </button>

                <button
                  className="font-medium text-slate-500 hover:text-slate-800 hover:underline"
                  onClick={() => {
                    setStep("REQUEST_CODE");
                    setCode("");
                    setError("");
                    setNotice("");
                  }}
                  type="button"
                >
                  Thay đổi email nhận mã
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "SUCCESS" && (
          <div className="mt-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 size={36} />
            </div>
            <h1 className="mt-5 font-sans text-2xl font-semibold text-equine-navy">
              Đặt lại mật khẩu thành công!
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Mật khẩu tài khoản của bạn đã được cập nhật thành công. Bạn có thể đăng nhập ngay bằng mật khẩu mới này.
            </p>

            <div className="mt-8">
              <button
                className="gold-button w-full"
                onClick={() => router.push(Routes.login)}
                type="button"
              >
                Đăng nhập ngay
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

