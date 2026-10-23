import { Routes } from "@/routes/Routes";
import Link from "next/link";
import { Brand } from "./Brand";

const footerGroups = [
  {
    title: "Về Equine",
    links: [
      ["Giới thiệu chung", Routes.homeSection("gioi-thieu")],
      ["Tầm nhìn & Sứ mệnh", Routes.homeSection("tam-nhin")],
      ["Giá trị cốt lõi", Routes.homeSection("gia-tri")],
    ],
  },
  {
    title: "Hệ sinh thái vận hành",
    links: [
      ["5 Vai trò chuyên biệt", Routes.homeSection("vai-tro")],
      ["6 Phân hệ nghiệp vụ", Routes.homeSection("van-hanh")],
      ["Tiêu chuẩn an toàn y tế", Routes.homeSection("an-toan")],
    ],
  },
  {
    title: "Cổng truy cập",
    links: [
      ["Đăng nhập hệ thống", Routes.login],
      ["Đăng ký Chủ sở hữu", Routes.register],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white text-[#475569]">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-10 border-b border-slate-200 pb-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-5">
            <div className="-ml-2">
              <Brand compact />
            </div>
            <p className="mt-4 max-w-sm text-sm font-normal leading-[1.7] text-[#475569]">
              Hệ thống quản trị vận hành câu lạc bộ ngựa đua tiêu chuẩn chuyên nghiệp.
              Đồng bộ hóa dữ liệu chuồng trại, huấn luyện thể lực, y tế thú y 3D và tài chính minh bạch.
            </p>
          </div>

          {footerGroups.map((group, idx) => (
            <div
              className={idx === 1 ? "lg:col-span-3" : "lg:col-span-2"}
              key={group.title}
            >
              <h2 className="text-sm font-medium text-[#1F2125]">
                {group.title}
              </h2>
              <ul className="mt-4 space-y-3 text-sm font-normal">
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    <Link
                      className="text-[#475569] transition-colors hover:text-[#1464F4]"
                      href={href}
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col gap-3 text-sm font-normal text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Equine Racehorse System. Bảo lưu mọi quyền.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span>Hệ thống nội bộ CLB</span>
            <span aria-hidden="true">·</span>
            <span>Phân quyền 5 cấp độ</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

