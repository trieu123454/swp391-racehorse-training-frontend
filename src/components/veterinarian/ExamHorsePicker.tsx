"use client";

import { useMemo, useState } from "react";
import type { VetHorse } from "@/api/veterinarian/api";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export default function ExamHorsePicker({ horses, selected, disabled, onSelect }: {
  horses: VetHorse[]; selected: VetHorse; disabled: boolean; onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => horses.filter((horse) => normalize(`${horse.horse_name} ${horse.id} ${horse.stable_box?.box_code ?? ""} ${horse.stable_box?.section ?? ""}`).includes(normalize(query.trim()))), [horses, query]);
  return <div className="relative min-w-0 flex-1">
    <p className="mb-2 text-xs font-medium text-slate-500">Ngựa đang xem<strong className="mt-0.5 block break-words text-lg font-semibold leading-snug text-equine-navy sm:text-xl">{selected.horse_name}</strong></p>
    <label><span className="sr-only">Tìm ngựa theo tên, mã hoặc chuồng</span><input type="search" value={query} disabled={disabled} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); event.currentTarget.blur(); } }} placeholder="Tìm tên, mã ngựa hoặc chuồng…" className="w-full rounded-md border border-equine-line bg-white px-3 py-2 text-sm" /></label>
    {open && <div className="absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-equine-line bg-white shadow-lg">
      <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-slate-500"><span role="status">{results.length} ngựa phù hợp</span><button type="button" onClick={() => setOpen(false)} className="px-2 py-1">Đóng</button></div>
      <ul className="max-h-64 overflow-y-auto p-1">{results.slice(0, 50).map((horse) => <li key={horse.id}><button type="button" aria-pressed={selected.id === horse.id} className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 ${selected.id === horse.id ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-700"}`} onClick={() => { onSelect(horse.id); setQuery(""); setOpen(false); }}><span className="block">{horse.horse_name}{selected.id === horse.id ? " · Đang xem" : ""}</span><span className="text-xs text-slate-500">{horse.stable_box?.box_code ?? "Chưa gán chuồng"} · {horse.id}</span></button></li>)}</ul>
      {results.length === 0 && <p className="p-3 text-sm text-slate-500">Không tìm thấy ngựa phù hợp.</p>}
      {results.length > 50 && <p className="border-t p-2 text-xs text-slate-500">Hiển thị 50 kết quả đầu. Nhập thêm để thu hẹp.</p>}
    </div>}
  </div>;
}
