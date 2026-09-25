import Link from "next/link";
import { Brand } from "./Brand";

const sections = [
  {
    title: "Quy trình chính",
    links: [
      ["Hồ sơ & lý lịch ngựa", "/#quy-trinh"],
      ["Huấn luyện", "/#quy-trinh"],
      ["Y tế & phục hồi", "/#quy-trinh"],
    ],
  },
  {
    title: "Vận hành câu lạc bộ",
    links: [
      ["Chăm sóc & dinh dưỡng", "/#van-hanh"],
      ["Thi đấu & thành tích", "/#van-hanh"],
      ["Phân quyền & quản trị", "/#vai-tro"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-equine-navy px-5 py-12 text-white/65 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1360px] gap-9 border-b border-white/10 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-12">
        <div>
          <Brand compact light />
          <p className="mt-4 max-w-sm text-xs leading-6">
            Nền tảng kết nối hồ sơ, huấn luyện và chăm sóc sức khỏe ngựa đua —
            dành cho toàn bộ đội ngũ câu lạc bộ.
          </p>
        </div>
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-white">
              {section.title}
            </h2>
            <ul className="mt-4 space-y-3 text-xs">
              {section.links.map(([label, href]) => (
                <li key={label}>
                  <Link className="transition hover:text-equine-champagne" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="rounded-2xl border border-equine-gold/20 bg-white/[0.05] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-equine-champagne">
            Khu vực thành viên
          </p>
          <p className="mt-3 text-xs leading-6">
            Đăng nhập để tiếp tục theo dõi công việc theo vai trò được cấp.
          </p>
          <Link className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-white transition hover:text-equine-champagne" href="/login">
            Đăng nhập <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-7 flex max-w-[1360px] flex-col gap-3 text-[10px] sm:flex-row sm:justify-between">
        <p>© 2026 Equine Sovereign. Bảo lưu mọi quyền.</p>
        <p>Hồ sơ ngựa · Chăm sóc · Huấn luyện · Thi đấu</p>
      </div>
    </footer>
  );
}
