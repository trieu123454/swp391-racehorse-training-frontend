"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "./Brand";

const links = [
  ["Trang chủ", "/"],
  ["Chuồng trại", "/#vai-tro"],
  ["Huấn luyện", "/#vai-tro"],
  ["Phả hệ & Di truyền", "/#pha-he"],
  ["Giải đấu", "/#vai-tro"],
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-equine-navy/95 text-white shadow-lg backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link aria-label="Về trang chủ" href="/">
          <Brand compact light />
        </Link>
        <nav className="hidden items-center gap-5 xl:flex">
          {links.map(([label, href]) => (
            <Link
              className="nav-link text-[13px] font-medium text-white/80 transition hover:text-equine-champagne"
              href={href}
              key={label}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            className="nav-link px-4 py-2 text-[13px] font-semibold text-white/80 hover:text-equine-champagne"
            href="/login"
          >
            Đăng nhập
          </Link>
          <Link className="gold-button !h-10 !px-5" href="/register">
            Đăng ký
          </Link>
        </div>
        <button
          aria-label={open ? "Đóng menu" : "Mở menu"}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10 xl:hidden"
          onClick={() => setOpen(!open)}
          type="button"
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open ? (
        <nav
          id="mobile-navigation"
          className="mobile-menu border-t border-white/10 px-5 py-4 xl:hidden"
        >
          {links.map(([label, href]) => (
            <Link
              className="block py-3 text-sm text-white/80"
              href={href}
              key={label}
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link className="soft-button border-white/20" href="/login">
              Đăng nhập
            </Link>
            <Link className="gold-button" href="/register">
              Đăng ký
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
