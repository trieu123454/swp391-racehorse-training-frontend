import { Routes } from "@/routes/Routes";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, Check, HeartPulse, ShieldCheck, Stethoscope, Trophy, Users, Warehouse } from "lucide-react";
import { SiteHeader } from "@/components/shared/SiteHeader";
import { SiteFooter } from "@/components/shared/SiteFooter";

const workflows = [
  { icon: BookOpen, title: "Hồ sơ ngựa" },
  { icon: CalendarDays, title: "Lịch huấn luyện" },
  { icon: HeartPulse, title: "Sức khỏe & chăm sóc" },
];
const roles = [
  { icon: ShieldCheck, name: "Quản lý CLB", tags: "Nhân sự · Vật tư · Thu chi" },
  { icon: Trophy, name: "HLV trưởng", tags: "Giáo án · Lịch tập · Thi đấu" },
  { icon: Stethoscope, name: "Bác sĩ thú y", tags: "Khám bệnh · Điều trị · Dinh dưỡng" },
  { icon: Warehouse, name: "Nhân viên chuồng trại", tags: "Chăm sóc · Khẩu phần · Sự cố" },
  { icon: Users, name: "Chủ ngựa", tags: "Hồ sơ · Thành tích · Chi phí" },
];
export default function HomePage() {
  return (
    <div className="landing" id="top">
      <SiteHeader />
      <main id="main-content">
        <section className="landing-hero landing-container" aria-labelledby="hero-title">
          <h1 id="hero-title">Quản lý ngựa đua.<br /><span>Mọi việc trong tầm tay.</span></h1>
          <div className="landing-actions">
            <Link className="gold-button" href={Routes.login}>Đăng nhập <ArrowRight size={17} /></Link>
            <a className="soft-button" href={Routes.homeSection("tong-quan")}>Xem tính năng</a>
          </div>
          <div className="landing-hero-media">
            <Image src="/img/hero-racehorse.webp" alt="Ngựa đua sải bước trên đường chạy" fill priority quality={95} sizes="(max-width: 1240px) 100vw, 1180px" className="object-cover object-[center_35%]" />
          </div>
        </section>
        <section className="landing-container landing-section" id="tong-quan">
          <div className="landing-section-heading"><h2>Công việc chính</h2></div>
          <div className="landing-workflows" id="quy-trinh">{workflows.map(({ icon: Icon, title }) => <article key={title} className="landing-workflow"><div className="landing-card-top"><span className="landing-icon"><Icon size={23} strokeWidth={1.6} /></span></div><h3>{title}</h3></article>)}</div>
        </section>
        <section className="landing-roles-section" id="vai-tro"><div className="landing-container landing-section">
          <div className="landing-section-heading"><h2>Không gian theo vai trò</h2></div>
          <div className="landing-roles">{roles.map(({ icon: Icon, name, tags }) => <article className="landing-role" key={name}><div className="landing-card-top"><span className="landing-icon"><Icon size={22} strokeWidth={1.6} /></span></div><h3>{name}</h3><div className="landing-role-bottom"><span>{tags}</span></div></article>)}</div>
        </div></section>
        <section className="landing-container landing-section landing-operation" id="van-hanh">
          <div className="landing-operation-image"><Image src="/img/stable-horse.webp" alt="Ngựa được chăm sóc tại chuồng trại" fill quality={95} sizes="(max-width: 800px) 100vw, 540px" className="object-cover object-[center_22%]" /></div>
          <div><h2>Chăm sóc mỗi ngày</h2><ul><li><Check size={17} /> Lịch chăm sóc và khẩu phần</li><li><Check size={17} /> Báo cáo sự cố</li><li><Check size={17} /> Kết quả huấn luyện</li></ul></div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
