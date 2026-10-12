"use client";
import { Routes } from "@/routes/Routes";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "./Brand";

const links = [
  ["Trang chủ", Routes.homeSection("top")],
  ["Nền tảng", Routes.homeSection("tong-quan")],
  ["Vai trò", Routes.homeSection("vai-tro")],
  ["Vận hành", Routes.homeSection("van-hanh")],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header fixed inset-x-0 top-0 z-50 border-b border-equine-line bg-white/95 text-equine-navy shadow-sm backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link aria-label="Về trang chủ" href={Routes.home}>
          <Brand compact />
        </Link>
        <nav className="hidden items-center gap-5 xl:flex">
          {links.map(([label, href]) => (
            <Link
              className="nav-link text-[13px] font-medium text-slate-600 transition hover:text-equine-blue"
              href={href}
              key={label}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            className="nav-link px-4 py-2 text-[13px] font-semibold text-slate-600 hover:text-equine-blue"
            href={Routes.login}
          >
            Đăng nhập
          </Link>
          <Link className="gold-button !h-10 !px-5" href={Routes.register}>
            Đăng ký
          </Link>
        </div>
        <button
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          className="grid h-10 w-10 place-items-center rounded-full text-equine-navy hover:bg-equine-mist xl:hidden"
          onClick={() => setOpen(!open)}
          type="button"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open ? (
        <nav
          id="mobile-navigation"
          className="mobile-menu border-t border-equine-line bg-white px-5 py-4 xl:hidden"
        >
          {links.map(([label, href]) => (
            <Link
              className="block py-3 text-sm text-slate-600"
              href={href}
              key={label}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link className="soft-button" href={Routes.login} onClick={() => setOpen(false)}>
              Đăng nhập
            </Link>
            <Link className="gold-button" href={Routes.register} onClick={() => setOpen(false)}>
              Đăng ký
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
