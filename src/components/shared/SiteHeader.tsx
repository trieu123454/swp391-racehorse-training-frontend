"use client";
import { Routes } from "@/routes/Routes";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "./Brand";

const links = [
  ["Giới thiệu", Routes.homeSection("gioi-thieu")],
  ["Tầm nhìn", Routes.homeSection("tam-nhin")],
  ["Giá trị cốt lõi", Routes.homeSection("gia-tri")],
  ["Hệ sinh thái", Routes.homeSection("vai-tro")],
  ["Vận hành", Routes.homeSection("van-hanh")],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 text-[#1F2125] backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-8 px-6 sm:px-8 lg:h-[84px] lg:px-12">
        <Link
          aria-label="Equine Racehorse System - Về trang chủ"
          className="-ml-2 shrink-0 whitespace-nowrap"
          href={Routes.home}
        >
          <Brand compact />
        </Link>

        <nav
          aria-label="Điều hướng trang chủ"
          className="hidden items-center gap-7 lg:flex xl:gap-9"
        >
          {links.map(([label, href]) => (
            <Link
              className="nav-link shrink-0 whitespace-nowrap text-[15px] font-normal text-[#1F2125] transition-colors hover:text-[#1464F4] xl:text-base"
              href={href}
              key={label}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center lg:flex">
          <Link
            className="vf-btn-primary whitespace-nowrap"
            href={Routes.login}
          >
            Truy cập hệ thống
            <ArrowRight size={16} />
          </Link>
        </div>

        <button
          aria-controls="mobile-navigation"
          aria-expanded={open}
          aria-label={open ? "Đóng menu" : "Mở menu"}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[4px] border border-slate-200 text-[#1F2125] transition-colors hover:bg-slate-100 lg:hidden"
          onClick={() => setOpen(!open)}
          type="button"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open ? (
        <nav
          aria-label="Điều hướng di động"
          className="mobile-menu border-t border-slate-200 bg-white px-6 py-5 shadow-lg sm:px-8 lg:hidden"
          id="mobile-navigation"
        >
          <div className="flex flex-col divide-y divide-slate-100">
            {links.map(([label, href]) => (
              <Link
                className="py-3.5 text-base font-medium text-[#1F2125] transition-colors hover:text-[#1464F4]"
                href={href}
                key={label}
                onClick={() => setOpen(false)}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 pt-2">
            <Link
              className="vf-btn-secondary w-full justify-center whitespace-nowrap"
              href={Routes.register}
              onClick={() => setOpen(false)}
            >
              Đăng ký Chủ ngựa
            </Link>
            <Link
              className="vf-btn-primary w-full justify-center whitespace-nowrap"
              href={Routes.login}
              onClick={() => setOpen(false)}
            >
              Đăng nhập
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

