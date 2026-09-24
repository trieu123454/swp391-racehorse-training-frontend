import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  Dna,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trophy,
  Users,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const roles = [
  {
    icon: Trophy,
    title: "Huấn Luyện Viên Trưởng",
    code: "HEAD TRAINER",
    text: "Lập giáo án chi tiết, theo dõi thể lực và phân công lịch huấn luyện cho từng chiến mã.",
  },
  {
    icon: Stethoscope,
    title: "Bác Sĩ Thú Y",
    code: "VETERINARIAN",
    text: "Quản lý hồ sơ y tế, phác đồ điều trị và cảnh báo nguy cơ chấn thương.",
  },
  {
    icon: Building2,
    title: "Nhân Viên Chuồng Trại",
    code: "GROOM",
    text: "Theo dõi chăm sóc, dinh dưỡng và công việc chuồng trại mỗi ngày.",
  },
  {
    icon: BadgeCheck,
    title: "Chủ Sở Hữu Ngựa",
    code: "OWNER",
    text: "Truy cập phả hệ, sức khỏe, thành tích và báo cáo tài chính minh bạch.",
  },
  {
    icon: ShieldCheck,
    title: "Quản Lý Câu Lạc Bộ",
    code: "MANAGER",
    text: "Phê duyệt tài khoản, quản lý RBAC và giám sát hoạt động toàn hệ thống.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-equine-paper">
      <SiteHeader />
      <section className="relative flex min-h-[680px] items-end overflow-hidden bg-equine-navy pt-20 text-white lg:min-h-[760px]">
        <Image
          alt="Chiến mã thuần chủng đang luyện tập trên đường đua"
          className="object-cover object-[62%_center] opacity-55"
          fill
          priority
          sizes="100vw"
          src="/images/hero-racehorse.png"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,25,44,0.98)_0%,rgba(11,25,44,0.76)_46%,rgba(11,25,44,0.12)_100%)]" />
        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-16 pt-28 sm:px-8 lg:px-12 lg:pb-20">
          <div className="hero-content max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 border border-equine-gold/50 bg-equine-navy/60 px-3 py-2 text-[10px] font-bold uppercase text-equine-champagne backdrop-blur-sm">
              <Sparkles size={14} /> Hệ điều hành hoàng gia · Chuẩn quốc tế FEI
            </div>
            <p className="eyebrow mb-3 text-equine-champagne">
              Equine Sovereign Protocol
            </p>
            <h1 className="font-sans text-4xl font-semibold leading-[1.2] sm:text-5xl lg:text-6xl">
              Nền Tảng Quản Lý &amp; Huấn Luyện Chiến Mã Đỉnh Cao
            </h1>
            <p className="mt-6 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
              Giải pháp chuyên biệt số hóa dinh dưỡng, phả hệ, y tế và hiệu suất
              vận động dành cho các câu lạc bộ đua ngựa chuyên nghiệp.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="gold-button" href="/register">
                Bắt đầu ngay <ArrowRight size={17} />
              </Link>
              <a
                className="soft-button border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
                href="#vai-tro"
              >
                Khám phá các phân hệ
              </a>
            </div>
          </div>
          <div className="mt-16 grid max-w-4xl gap-4 border-t border-white/15 pt-6 text-xs text-white/80 sm:grid-cols-3">
            <span className="flex items-center gap-2">
              <Activity className="text-equine-champagne" size={16} /> IoT
              Telemetry vận tốc &amp; nhịp tim
            </span>
            <span className="flex items-center gap-2">
              <Dna className="text-equine-champagne" size={16} /> Phả hệ chuẩn
              quốc tế
            </span>
            <span className="flex items-center gap-2">
              <HeartPulse className="text-equine-champagne" size={16} /> Hồ sơ
              thú y chuyên sâu
            </span>
          </div>
        </div>
      </section>
      <section className="border-b border-equine-line bg-white py-5">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-px bg-equine-line px-5 sm:grid-cols-4 sm:px-8 lg:px-12">
          {[
            ["Tốc độ đỉnh vòng 6", "68.4 km/h"],
            ["Hồi phục tim sau 15m", "82 BPM"],
            ["Chỉ số sẵn sàng đua", "96.8%"],
            ["Đàn ngựa đang active", "142 chiến mã"],
          ].map(([label, value]) => (
            <div className="bg-white px-4 py-2" key={label}>
              <p className="text-[9px] uppercase text-slate-500">{label}</p>
              <p className="mt-1 text-sm font-semibold text-equine-navy">
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section
        className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12"
        id="vai-tro"
      >
        <p className="eyebrow">Kiến trúc phân quyền vận hành</p>
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h2 className="max-w-3xl font-sans text-3xl font-semibold text-equine-navy sm:text-4xl">
              Hệ Sinh Thái Phân Quyền 5 Vai Trò Chuyên Biệt
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Mỗi thành viên được tiếp cận chính xác công cụ cần thiết, bảo đảm
              minh bạch và hiệu suất vận hành.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase text-equine-gold">
            Hệ thống RBAC tiêu chuẩn
          </span>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {roles.map(({ icon: Icon, title, code, text }, index) => (
            <article
              className={`feature-card border border-equine-line bg-white p-6 transition hover:border-equine-gold hover:shadow-[0_12px_32px_-8px_rgba(197,160,89,0.18)] ${index < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}
              key={code}
            >
              <div className="flex items-start justify-between gap-4">
                <span className="grid h-10 w-10 place-items-center bg-equine-navy text-equine-champagne">
                  <Icon size={19} />
                </span>
                <span className="bg-equine-mist px-2 py-1 text-[9px] font-bold text-equine-blue">
                  {code}
                </span>
              </div>
              <h3 className="mt-5 font-sans text-xl text-equine-navy">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bg-[#eef1fb] px-5 py-16 sm:px-8 lg:px-12" id="pha-he">
        <div className="mx-auto grid max-w-[1360px] gap-10 rounded-md bg-equine-navy p-8 text-white shadow-xl md:grid-cols-2 md:p-12">
          <div>
            <p className="eyebrow text-equine-champagne">Đột phá kỹ thuật số</p>
            <h2 className="mt-3 font-sans text-3xl font-semibold">
              Số Hóa Phả Hệ 5 Đời Cùng Telemetry Bước Chạy
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/70">
              Kết hợp dữ liệu phả hệ di truyền với cảm biến IMU gắn trên móng,
              nâng tầm phân tích hiệu suất bằng dữ liệu chuẩn quốc tế.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 self-center">
            <div className="border border-white/10 bg-white/5 p-5">
              <p className="text-2xl font-semibold text-equine-champagne">
                7.42m
              </p>
              <p className="mt-1 text-xs text-white/60">Chiều dài sải chân</p>
            </div>
            <div className="border border-white/10 bg-white/5 p-5">
              <p className="text-2xl font-semibold text-equine-champagne">
                0.118s
              </p>
              <p className="mt-1 text-xs text-white/60">Thời gian tiếp đất</p>
            </div>
          </div>
        </div>
      </section>
      <section className="px-5 py-24 text-center sm:px-8">
        <Users className="mx-auto text-equine-gold" size={28} />
        <h2 className="mx-auto mt-5 max-w-2xl font-sans text-3xl font-semibold text-equine-navy">
          Sẵn Sàng Nâng Tầm Chuẩn Mực Quản Trị Đua Ngựa?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
          Đăng ký tham gia hệ sinh thái quản lý ngựa đua chuyên nghiệp và chờ
          kích hoạt quyền truy cập.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link className="navy-button" href="/register">
            Đăng ký tài khoản mới
          </Link>
          <Link
            className="soft-button bg-equine-mist text-equine-navy hover:bg-equine-line"
            href="/login"
          >
            Đăng nhập cổng điều hành
          </Link>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
