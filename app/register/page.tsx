"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { FormEvent, useCallback, useState } from "react";
import { AuthVisual } from "@/components/AuthVisual";
import { Brand } from "@/components/Brand";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { register } from "@/lib/api";
import { roleOptions, routeForRole } from "@/lib/roles";
import { saveSession } from "@/lib/session";
import type { AuthResponse, RoleName } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [roleName, setRoleName] = useState<RoleName>("HORSE_OWNER");
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
      router.replace(routeForRole(auth.user.roleName));
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
        roleName,
      });
      setMessage(
        "Đăng ký thành công. Tài khoản đang chờ Club Manager phê duyệt.",
      );
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
    <main className="min-h-screen overflow-x-hidden bg-equine-paper px-4 py-6 sm:px-8">
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
      <div className="mx-auto grid min-w-0 max-w-[1440px] grid-cols-[minmax(0,1fr)] overflow-hidden rounded-lg bg-white shadow-[0_24px_60px_-20px_rgba(11,25,44,0.25)] lg:grid-cols-[0.88fr_1.12fr]">
        <AuthVisual mode="register" />
        <section className="flex min-w-0 max-w-full items-center overflow-hidden px-5 py-10 sm:px-12 lg:px-16">
          <div className="mx-auto w-full min-w-0 max-w-[720px]">
            <Brand />
            <h1 className="mt-5 font-serif text-3xl font-semibold text-equine-navy sm:text-5xl">
              Đăng ký tài khoản mới
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Gia nhập hệ sinh thái quản lý và huấn luyện ngựa đua Equine
              Sovereign.
            </p>
            <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
              {input(
                "Họ và tên",
                "fullName",
                UserRound,
                "text",
                "Nguyễn Văn Tuấn",
              )}
              <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="grid gap-4 sm:grid-cols-2">
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
              <label className="block">
                <span className="field-label">Vai trò đăng ký</span>
                <span className="relative block">
                  <select
                    className="field-control cursor-pointer appearance-none px-4 pr-11"
                    onChange={(event) =>
                      setRoleName(event.target.value as RoleName)
                    }
                    value={roleName}
                  >
                    {roleOptions.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-500"
                    size={18}
                  />
                </span>
              </label>
              <div className="flex gap-3 rounded-md bg-[#fff7e9] p-4 text-xs leading-5 text-[#674b12]">
                <AlertTriangle className="shrink-0" size={19} />
                <p>
                  <strong>Lưu ý quan trọng:</strong> Tài khoản sẽ ở trạng thái{" "}
                  <strong>CHỜ DUYỆT (PENDING)</strong> và cần Club Manager phê
                  duyệt.
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-600">
                <input
                  checked={accepted}
                  className="mt-1 h-4 w-4 accent-[#0b192c]"
                  onChange={(event) => setAccepted(event.target.checked)}
                  required
                  type="checkbox"
                />
                <span>
                  Tôi đồng ý với{" "}
                  <strong className="text-equine-gold">
                    Điều khoản sử dụng
                  </strong>{" "}
                  và Chính sách bảo mật câu lạc bộ.
                </span>
              </label>
              {message ? (
                <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {message}
                </p>
              ) : null}
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
                disabled={loading || !accepted}
                type="submit"
              >
                {loading ? "Đang gửi đăng ký..." : "Đăng ký tài khoản"}
              </button>
            </form>
            <div className="my-5 flex items-center gap-4 text-[10px] font-bold uppercase text-slate-500">
              <span className="h-px flex-1 bg-equine-line" />
              Hoặc đăng ký bằng
              <span className="h-px flex-1 bg-equine-line" />
            </div>
            <GoogleAuthButton
              label="signup_with"
              onError={showError}
              onSuccess={googleSuccess}
              roleName={roleName}
            />
            <p className="mt-6 text-center text-sm text-slate-600">
              Đã có tài khoản thành viên?{" "}
              <Link
                className="font-bold uppercase text-equine-gold hover:underline"
                href="/login"
              >
                Đăng nhập
              </Link>
            </p>
          </div>
        </section>
      </div>
      <p className="py-8 text-center text-[10px] text-slate-500">
        © 2026 Equine Sovereign Syndicate · Nền Tảng Quản Trị Đua Ngựa Quý Tộc
      </p>
    </main>
  );
}
