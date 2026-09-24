import Link from "next/link";
import { Brand } from "./Brand";

export function SiteFooter() {
  return (
    <footer className="bg-equine-navy px-5 py-12 text-white/65 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-[1360px] gap-10 border-b border-white/10 pb-10 md:grid-cols-4">
        <div>
          <Brand compact light />
          <p className="mt-4 text-xs leading-6">
            Nền tảng quản lý ngựa đua chuyên biệt cho dinh dưỡng, phả hệ, y tế
            và hiệu suất vận động.
          </p>
        </div>
        <div>
          <h3 className="text-[10px] font-bold uppercase text-white">
            Hệ thống phân hệ
          </h3>
          <p className="mt-4 text-xs leading-7">
            Hồ sơ chiến mã &amp; giống nòi
            <br />
            Theo dõi tim &amp; khớp
            <br />
            Phân tích vận tốc furlong
          </p>
        </div>
        <div>
          <h3 className="text-[10px] font-bold uppercase text-white">
            Tổ chức quản trị
          </h3>
          <p className="mt-4 text-xs leading-7">
            Tiêu chuẩn bác sĩ thú y<br />
            Quy chế bảo trợ sở hữu
            <br />
            Nhật ký vận hành
          </p>
        </div>
        <div className="border border-equine-gold/20 bg-white/5 p-5">
          <p className="text-[10px] font-bold uppercase text-equine-champagne">
            Khu vực riêng tư
          </p>
          <p className="mt-3 text-xs leading-6">
            Truy cập độc quyền dành riêng cho thành viên câu lạc bộ.
          </p>
          <Link
            className="mt-3 inline-block text-xs font-bold text-white"
            href="/login"
          >
            Đăng nhập →
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-7 flex max-w-[1360px] flex-col gap-3 text-[10px] sm:flex-row sm:justify-between">
        <p>© 2026 Equine Sovereign Syndicate. Bảo lưu mọi quyền.</p>
        <p>Điều khoản hội viên · Chính sách bảo mật</p>
      </div>
    </footer>
  );
}
