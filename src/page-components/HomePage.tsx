import { Routes } from "@/routes/Routes";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CalendarDays, Check, HeartPulse, ShieldCheck, Stethoscope, Trophy, Users, Warehouse } from "lucide-react";
import { SiteHeader } from "@/components/shared/SiteHeader";
import { SiteFooter } from "@/components/shared/SiteFooter";

const workflows = [
  { icon: BookOpen, number: "01", title: "Hiểu từng chiến mã", description: "Hồ sơ, dòng dõi và lịch sử sức khỏe được lưu trữ tập trung, dễ dàng tra cứu.", label: "Hồ sơ & lý lịch" },
  { icon: CalendarDays, number: "02", title: "Chủ động mỗi buổi tập", description: "Sắp xếp giáo án, phân công lịch tập và theo dõi tiến bộ qua từng giai đoạn.", label: "Kế hoạch huấn luyện" },
  { icon: HeartPulse, number: "03", title: "Chăm sóc đúng thời điểm", description: "Kết nối đội ngũ thú y và chuồng trại để việc điều trị, phục hồi luôn liền mạch.", label: "Sức khỏe & chăm sóc" },
];
const roles = [
  { icon: ShieldCheck, name: "Quản lý câu lạc bộ", detail: "Nắm bắt vận hành, phân công nhân sự và kiểm soát nguồn lực.", tags: "Nhân sự · Vật tư · Thu chi", number: "01" },
  { icon: Trophy, name: "Huấn luyện viên trưởng", detail: "Lập giáo án, điều phối lịch tập và đánh giá phong độ từng ngựa.", tags: "Giáo án · Lịch tập · Thi đấu", number: "02" },
  { icon: Stethoscope, name: "Bác sĩ thú y", detail: "Theo dõi sức khỏe, quản lý hồ sơ khám và kế hoạch phục hồi.", tags: "Khám bệnh · Điều trị · Dinh dưỡng", number: "03" },
  { icon: Warehouse, name: "Nhân viên chuồng trại", detail: "Theo dõi công việc hằng ngày, khẩu phần và các ngựa được giao.", tags: "Chăm sóc · Khẩu phần · Sự cố", number: "04" },
  { icon: Users, name: "Chủ sở hữu ngựa", detail: "Cập nhật sức khỏe, quá trình huấn luyện và thành tích ngựa của bạn.", tags: "Hồ sơ · Thành tích · Chi phí", number: "05" },
];
export default function HomePage() {
  return (
    <div className="landing" id="top">
      <SiteHeader />
      <main id="main-content">
        <section className="landing-hero landing-container" aria-labelledby="hero-title">
          <h1 id="hero-title">Chăm sóc tận tâm.<br /><span>Vươn xa trên đường đua.</span></h1>
          <p className="landing-intro">Hồ sơ, huấn luyện và sức khỏe — kết nối trong một không gian.<br className="hidden sm:block" /> Để cả đội tập trung vào điều quan trọng: sự phát triển của từng chiến mã.</p>
          <div className="landing-actions">
            <Link className="gold-button" href={Routes.login}>Vào không gian làm việc <ArrowRight size={17} /></Link>
            <a className="soft-button" href={Routes.homeSection("tong-quan")}>Khám phá nền tảng <ArrowUpRight size={17} /></a>
          </div>
          <div className="landing-hero-media">
            <Image src="/img/hero-racehorse.webp" alt="Ngựa đua sải bước trên đường chạy" fill priority sizes="(max-width: 1240px) 100vw, 1180px" className="object-cover" />
          </div>
          <div className="landing-principles"><span><Check size={15} /> Thông tin tập trung</span><span><Check size={15} /> Phối hợp rõ ràng</span><span><Check size={15} /> Theo dõi xuyên suốt</span></div>
        </section>
        <section className="landing-container landing-section" id="tong-quan">
          <div className="landing-section-heading"><div><p className="landing-kicker">TỔ CHỨC ĐƠN GIẢN</p><h2>Mọi việc đúng nhịp.<br />Mọi thông tin đúng chỗ.</h2></div><p>Từ hồ sơ đầu tiên đến ngày thi đấu, mỗi bước được kết nối để đội ngũ phối hợp dễ dàng hơn.</p></div>
          <div className="landing-workflows" id="quy-trinh">{workflows.map(({ icon: Icon, number, title, description, label }) => <article key={number} className="landing-workflow"><div className="landing-card-top"><span className="landing-icon"><Icon size={23} strokeWidth={1.6} /></span><span>{number}</span></div><p className="landing-card-label">{label}</p><h3>{title}</h3><p>{description}</p></article>)}</div>
        </section>
        <section className="landing-roles-section" id="vai-tro"><div className="landing-container landing-section">
          <div className="landing-section-heading"><div><p className="landing-kicker">MỘT ĐỘI NGŨ, CÙNG MỤC TIÊU</p><h2>Không gian riêng.<br />Kết nối chung.</h2></div><p>Năm vai trò, một quy trình thống nhất. Mỗi thành viên có các công cụ phù hợp với công việc của mình.</p></div>
          <div className="landing-roles">{roles.map(({ icon: Icon, name, detail, tags, number }) => <article className="landing-role" key={number}><div className="landing-card-top"><span className="landing-icon"><Icon size={22} strokeWidth={1.6} /></span><span>{number}</span></div><h3>{name}</h3><p>{detail}</p><div className="landing-role-bottom"><span>{tags}</span></div></article>)}</div>
          <p className="landing-role-note"><ShieldCheck size={16} /> Sau khi đăng nhập, bạn được chuyển đến không gian phù hợp với vai trò của mình.</p>
        </div></section>
        <section className="landing-container landing-section landing-operation" id="van-hanh">
          <div className="landing-operation-image"><Image src="/img/stable-horse.webp" alt="Ngựa được chăm sóc tại chuồng trại" fill sizes="(max-width: 800px) 100vw, 540px" className="landing-stable-image" /></div>
          <div><p className="landing-kicker">CHĂM SÓC TỪ NHỮNG ĐIỀU NHỎ</p><h2>Một ngày chăm sóc tốt.<br />Một hành trình bền vững.</h2><p>Công việc rõ ràng giúp đội ngũ dành nhiều thời gian hơn cho từng chiến mã.</p><ul><li><Check size={17} /> Lịch chăm sóc và khẩu phần dễ theo dõi</li><li><Check size={17} /> Sự cố được ghi nhận và chuyển đúng người</li><li><Check size={17} /> Kết quả huấn luyện cập nhật xuyên suốt</li></ul><Link className="landing-text-link" href={Routes.login}>Bắt đầu công việc của bạn <ArrowRight size={17} /></Link></div>
        </section>
        <section className="landing-container landing-cta"><div><p className="landing-kicker">SẴN SÀNG CHO MỘT NGÀY MỚI</p><h2>Cùng chăm sóc. Cùng tiến xa.</h2></div><Link className="gold-button" href={Routes.login}>Đăng nhập hệ thống <ArrowRight size={17} /></Link></section>
      </main>
      <SiteFooter />
    </div>
  );
}
