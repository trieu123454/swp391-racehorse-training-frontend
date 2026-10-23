import { Routes } from "@/routes/Routes";
import Link from "next/link";
import { Brand } from "./Brand";

const sections = [
  { title: "Khám phá", links: [["Tính năng", Routes.homeSection("quy-trinh")], ["Vai trò", Routes.homeSection("vai-tro")]] },
];

export function SiteFooter() {
  return (
    <footer className="bg-equine-mist px-5 py-8 text-slate-600 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1360px] gap-6 border-b border-equine-line pb-7 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_auto] lg:gap-12">
        <div>
          <Brand compact />
        </div>
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.1em] text-equine-navy">
              {section.title}
            </h2>
            <ul className="mt-4 space-y-3 text-xs">
              {section.links.map(([label, href]) => (
                <li key={label}>
                  <Link className="transition hover:text-equine-blue" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <Link className="inline-flex items-center gap-2 text-xs font-bold text-equine-navy transition hover:text-equine-blue" href={Routes.login}>
            Đăng nhập <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-5 flex max-w-[1360px] flex-col gap-3 text-[10px] sm:flex-row sm:justify-between">
        <p>© 2026 Equine</p>
      </div>
    </footer>
  );
}
