import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CalendarCheck,
  Dna,
  HeartPulse,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trophy,
  Users,
  Utensils,
  Warehouse,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

const workflows = [
  {
    number: "01",
    icon: BookOpen,
    label: "HỒ SƠ & LÝ LỊCH",
    title: "Mỗi chiến mã, một hồ sơ xuyên suốt.",
    description:
      "Lưu trữ thông tin, dòng dõi, chủ sở hữu, vị trí chuồng và lịch sử thi đấu trong cùng một hồ sơ dễ tra cứu.",
    details: ["Pedigree và lịch sử thành tích", "Sức khỏe, cân nặng, trạng thái"],
  },
  {
    number: "02",
    icon: CalendarCheck,
    label: "GIÁO ÁN HUẤN LUYỆN",
    title: "Kế hoạch rõ ràng cho từng giai đoạn.",
    description:
      "Lập bài tập theo cự ly, khối lượng và mặt sân; phân công lịch hằng ngày, theo dõi nhịp tim/vận tốc và đánh giá sau buổi tập.",
    details: ["Lịch tập và lượt chạy thử", "Chỉ số thể lực, cảnh báo rủi ro"],
  },
  {
    number: "03",
    icon: HeartPulse,
    label: "Y TẾ & PHỤC HỒI",
    title: "Chăm sóc đúng lúc, trở lại an toàn.",
    description:
      "Theo dõi trạng thái sức khỏe, hồ sơ khám, chẩn đoán và phác đồ điều trị; đánh dấu tổn thương và khóa bài tập khi ngựa cần nghỉ dưỡng.",
    details: ["Lịch tiêm phòng và chăm sóc định kỳ", "Theo dõi chấn thương, quá trình hồi phục"],
  },
];

const roles = [
  {
    icon: Trophy,
    title: "Huấn luyện viên trưởng",
    english: "HEAD TRAINER",
    description:
      "Điều phối giáo án, lịch tập, lượt chạy thử và đánh giá phong độ của toàn đội.",
    items: ["Thể lực & cảnh báo", "Lịch tập / lượt chạy", "Đăng ký giải đua"],
  },
  {
    icon: Stethoscope,
    title: "Bác sĩ thú y",
    english: "VETERINARIAN",
    description:
      "Quản lý sức khỏe đàn ngựa, hồ sơ khám và kế hoạch điều trị, phục hồi.",
    items: ["Trạng thái sức khỏe", "Phác đồ & tổn thương 3D", "Lịch chăm sóc định kỳ"],
  },
  {
    icon: Warehouse,
    title: "Nhân viên chuồng trại",
    english: "GROOM / STABLE HAND",
    description:
      "Nắm lịch sinh hoạt, khẩu phần và các đầu việc chăm sóc trong ngày.",
    items: ["Chuồng & khẩu phần ăn", "Xác nhận công việc", "Sự cố kèm hình ảnh"],
  },
  {
    icon: BadgeCheck,
    title: "Chủ sở hữu ngựa",
    english: "HORSE OWNER",
    description:
      "Theo dõi chiến mã của mình với thông tin rõ ràng và cập nhật xuyên suốt.",
    items: ["Dòng dõi & thành tích", "Video, lịch tập & nhận xét", "Chi phí & tiền thưởng"],
  },
  {
    icon: ShieldCheck,
    title: "Quản lý câu lạc bộ",
    english: "CLUB MANAGER",
    description:
      "Quản lý nguồn lực, nhân sự, phân quyền và hiệu quả vận hành câu lạc bộ.",
    items: ["Ngựa, nhân sự, vật tư", "Phân quyền & Audit Log", "Chi phí & hiệu suất"],
  },
];

export default function HomePage() {
  return (
    <main id="top" className="min-h-screen bg-equine-paper">
      <SiteHeader />

      <section
        aria-labelledby="hero-title"
        className="home-hero relative isolate flex min-h-[760px] items-center overflow-hidden bg-equine-navy pt-20 text-white lg:min-h-[820px]"
      >
        <Image
          alt="Chiến mã bứt tốc trên đường đua lúc hoàng hôn"
          className="home-hero-image object-cover object-[58%_center]"
          fill
          priority
          quality={82}
          sizes="100vw"
          src="/images/hero-racehorse.webp"
        />
        <div className="home-hero-veil absolute inset-0" />
        <div className="home-hero-glow pointer-events-none absolute inset-0" />

        <div className="relative mx-auto w-full max-w-[1440px] px-5 pb-20 pt-16 sm:px-8 lg:px-12 lg:pb-24 lg:pt-20">
          <div className="home-hero-copy relative z-10 max-w-[760px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-equine-champagne backdrop-blur-md">
              <Sparkles size={14} /> Một nền tảng · Năm vai trò · Cùng mục tiêu
            </div>
            <p className="eyebrow mb-4 text-equine-champagne">
              Equine Sovereign · Racehorse Management
            </p>
            <h1
              id="hero-title"
              className="max-w-[760px] font-display text-[2.65rem] font-semibold leading-[1.08] tracking-[-0.045em] sm:text-6xl lg:text-[4.65rem]"
            >
              Chăm sóc hôm nay.
              <br />
              <span className="text-equine-champagne">Chinh phục đường đua.</span>
            </h1>
            <p className="mt-6 max-w-[590px] text-sm leading-7 text-white/75 sm:text-base sm:leading-8">
              Kết nối hồ sơ, huấn luyện và y tế trong một hành trình nhất quán —
              để mỗi chiến mã được chăm sóc tốt hơn và sẵn sàng đúng thời điểm.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="gold-button !h-[52px] !px-6" href="/login">
                Vào không gian làm việc <ArrowRight size={17} />
              </Link>
              <Link
                className="soft-button !h-[52px] border-white/20 bg-white/[0.08] !px-6 text-white backdrop-blur-sm hover:bg-white/[0.15]"
                href="#quy-trinh"
              >
                Khám phá nền tảng <ArrowDownRight size={16} />
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-2"><Dna size={15} className="text-equine-champagne" /> Lý lịch & dòng dõi</span>
              <span className="inline-flex items-center gap-2"><Activity size={15} className="text-equine-champagne" /> Thể lực & tập luyện</span>
              <span className="inline-flex items-center gap-2"><HeartPulse size={15} className="text-equine-champagne" /> Y tế & phục hồi</span>
            </div>
          </div>

        </div>
        <a aria-label="Cuộn đến tổng quan nền tảng" className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/45 lg:flex" href="#tong-quan">
          Cuộn để khám phá <span className="home-scroll-dot" />
        </a>
      </section>

      <section aria-label="Các phân hệ chính" className="relative z-10 px-5 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-[1240px] -translate-y-7 overflow-hidden rounded-2xl border border-equine-line/80 bg-white shadow-[0_20px_60px_-35px_rgba(11,25,44,0.38)] sm:grid-cols-3">
          {[
            ["01", "Hồ sơ & lý lịch", "Một hồ sơ đầy đủ cho mỗi chiến mã"],
            ["02", "Huấn luyện", "Giáo án, lịch tập và đánh giá"],
            ["03", "Y tế & phục hồi", "Sức khỏe, điều trị và chăm sóc"],
          ].map(([number, title, description]) => (
            <a className="home-index-item group flex items-center gap-4 border-b border-equine-line px-5 py-5 last:border-0 sm:border-b-0 sm:border-r sm:px-7 sm:py-6" href="#quy-trinh" key={number}>
              <span className="font-display text-2xl text-equine-gold/80">{number}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-equine-navy">{title}</span><span className="mt-0.5 block text-[11px] text-slate-500">{description}</span></span>
              <ArrowRight className="shrink-0 text-equine-gold transition-transform duration-300 group-hover:translate-x-1" size={16} />
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-20 pt-9 sm:px-8 sm:pb-28 lg:px-12" id="tong-quan">
        <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div>
            <p className="eyebrow">Một hành trình liền mạch</p>
            <h2 className="display-title mt-4 max-w-2xl text-3xl text-equine-navy sm:text-5xl">
              Từ lý lịch đầu đời đến ngày ra đường đua.
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-600 lg:justify-self-end lg:pb-1">
            Thông tin quan trọng được tổ chức theo từng chiến mã và chia sẻ đúng
            đến người phụ trách. Đội ngũ phối hợp trên cùng một bức tranh về
            chăm sóc, tập luyện và sức khỏe.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3" id="quy-trinh">
          {workflows.map(({ number, icon: Icon, label, title, description, details }) => (
            <article className="home-workflow-card group relative overflow-hidden rounded-[24px] border border-equine-line bg-white p-6 sm:p-8" key={number}>
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-equine-navy text-equine-champagne shadow-brass-tight transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-105"><Icon size={21} /></span>
                <span className="font-display text-4xl text-equine-gold/45">{number}</span>
              </div>
              <p className="mt-7 text-[9px] font-bold uppercase tracking-[0.16em] text-equine-gold">{label}</p>
              <h3 className="display-title mt-2 text-[1.4rem] text-equine-navy">{title}</h3>
              <p className="mt-3 min-h-[74px] text-sm leading-6 text-slate-600">{description}</p>
              <ul className="mt-5 space-y-3 border-t border-equine-line pt-5">
                {details.map((detail) => <li className="flex items-start gap-2.5 text-xs leading-5 text-slate-600" key={detail}><span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-current" /></span>{detail}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#0b192c] px-5 py-20 text-white sm:px-8 sm:py-24 lg:px-12" id="vai-tro">
        <div className="pointer-events-none absolute -right-40 -top-48 h-[540px] w-[540px] rounded-full border border-white/[0.06]" />
        <div className="pointer-events-none absolute -right-20 -top-28 h-[300px] w-[300px] rounded-full border border-equine-gold/10" />
        <div className="relative mx-auto max-w-[1440px]">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="eyebrow text-equine-champagne">Công cụ phù hợp từng người</p>
              <h2 className="display-title mt-4 max-w-3xl text-3xl text-white sm:text-5xl">Cả đội cùng chăm sóc. Mỗi người đúng chuyên môn.</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-white/55">Phân quyền theo nhiệm vụ giúp huấn luyện viên, bác sĩ, nhân viên, chủ ngựa và quản lý phối hợp mạch lạc.</p>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {roles.map(({ icon: Icon, title, english, description, items }) => (
              <article className="home-role-card group rounded-[20px] border border-white/10 bg-white/[0.045] p-5 backdrop-blur-sm" key={english}>
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-equine-gold/25 bg-equine-gold/10 text-equine-champagne"><Icon size={18} /></span>
                  <span className="pt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">{english}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold leading-6 text-white">{title}</h3>
                <p className="mt-2 min-h-[72px] text-xs leading-5 text-white/55">{description}</p>
                <ul className="mt-4 space-y-2 border-t border-white/10 pt-4">
                  {items.map((item) => <li className="flex items-center gap-2 text-[10px] text-white/65" key={item}><span className="h-1 w-1 rounded-full bg-equine-champagne/70" />{item}</li>)}
                </ul>
              </article>
            ))}
          </div>
          <div className="mt-6 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="flex items-center gap-3"><Users className="text-equine-champagne" size={20} /><p className="text-xs leading-5 text-white/65">Quyền truy cập được quản lý theo vai trò và phạm vi công việc.</p></div>
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-equine-champagne"><ShieldCheck size={15} /> RBAC · Minh bạch · Có kiểm soát</span>
          </div>
        </div>
      </section>

      <section className="bg-equine-mist px-5 py-20 sm:px-8 sm:py-24 lg:px-12" id="van-hanh">
        <div className="mx-auto grid max-w-[1360px] overflow-hidden rounded-[30px] bg-white shadow-[0_24px_80px_-46px_rgba(11,25,44,0.45)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="home-stable-image media-frame relative min-h-[380px] lg:min-h-[580px]">
            <Image alt="Ngựa được chăm sóc trong chuồng trại" className="media-zoom object-cover object-[42%_center]" fill quality={78} sizes="(max-width: 1024px) 100vw, 42vw" src="/images/stable-horse.webp" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#071322]/85 via-[#071322]/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-9">
              <p className="eyebrow text-equine-champagne">Từng việc nhỏ đều quan trọng</p>
              <p className="mt-3 max-w-md font-display text-3xl font-semibold leading-tight">Một ngày chăm sóc tốt tạo nên một mùa giải tốt.</p>
            </div>
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <p className="eyebrow">Vận hành trọn vẹn</p>
            <h2 className="display-title mt-4 text-3xl text-equine-navy sm:text-4xl">Chuồng trại, dinh dưỡng và thành tích — cùng một nhịp.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">Ngoài các quy trình cốt lõi, nền tảng còn hỗ trợ công việc hằng ngày tại chuồng và theo dõi hành trình thi đấu của từng chiến mã.</p>

            <div className="mt-8 divide-y divide-equine-line border-y border-equine-line">
              <div className="flex gap-4 py-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f4efe5] text-equine-navy"><Utensils size={19} /></span>
                <div><h3 className="text-sm font-semibold text-equine-navy">Chăm sóc & dinh dưỡng mỗi ngày</h3><p className="mt-1 text-xs leading-5 text-slate-600">Theo dõi khẩu phần, lịch sinh hoạt, công việc chuồng trại và báo cáo sự cố kèm hình ảnh.</p></div>
              </div>
              <div className="flex gap-4 py-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f4efe5] text-equine-navy"><Trophy size={19} /></span>
                <div><h3 className="text-sm font-semibold text-equine-navy">Thi đấu & báo cáo thành tích</h3><p className="mt-1 text-xs leading-5 text-slate-600">Lựa chọn giải phù hợp, đăng ký thi đấu và tổng hợp kết quả, chi phí, tiền thưởng.</p></div>
              </div>
              <div className="flex gap-4 py-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#f4efe5] text-equine-navy"><ShieldCheck size={19} /></span>
                <div><h3 className="text-sm font-semibold text-equine-navy">Quản trị câu lạc bộ minh bạch</h3><p className="mt-1 text-xs leading-5 text-slate-600">Quản lý nhân sự, danh mục, quyền thao tác, chi phí vận hành và nhật ký hệ thống.</p></div>
              </div>
            </div>
            <Link className="navy-button mt-7 self-start" href="/login">Đăng nhập để tiếp tục <ArrowRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-5 py-20 text-center sm:px-8 sm:py-28">
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-equine-gold/[0.08] blur-3xl" />
        <div className="relative mx-auto max-w-3xl">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-equine-navy text-equine-champagne shadow-brass"><Activity size={23} /></span>
          <p className="eyebrow bare mt-6">Cùng hướng đến phong độ bền vững</p>
          <h2 className="display-title mt-3 text-3xl text-equine-navy sm:text-5xl">Sẵn sàng bước vào nhịp vận hành mới?</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">Đăng nhập để tiếp tục công việc theo đúng vai trò và quyền truy cập của bạn.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link className="gold-button" href="/login">Đăng nhập <ArrowRight size={16} /></Link>
            <Link className="soft-button bg-white" href="/register">Tạo tài khoản</Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
