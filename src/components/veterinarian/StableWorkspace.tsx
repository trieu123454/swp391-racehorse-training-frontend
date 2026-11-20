"use client";

import { useMemo, useState, type ComponentProps } from "react";
import { RefreshCw } from "lucide-react";
import type { VetHorse } from "@/api/veterinarian/api";
import { statusLabels, type Horse } from "@/api/horses/api";
import HorseStableYard from "./HorseStableYard";
import { HorseImage } from "@/components/horses/HorseUI";

export default function StableWorkspace({ horses, loading, onRefresh, onOpen, onSelectHorse, stables, onGoToExam, onUpdateStatus }: {
  horses: VetHorse[]; loading: boolean; onRefresh: () => void; onOpen: (id: string) => void; onSelectHorse: (id: string) => void;
} & Pick<ComponentProps<typeof HorseStableYard>, "stables" | "onGoToExam" | "onUpdateStatus">) {
  const [view, setView] = useState<"map" | "list">("map");
  const [section, setSection] = useState("");
  const [injured, setInjured] = useState(false);
  const [search, setSearch] = useState("");
  const sections = useMemo(() => [...new Set(horses.map((horse) => horse.stable_box?.section).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "vi")), [horses]);
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase();
  const filtered = horses.filter((horse) => (!section || (section === "unassigned" ? !horse.stable_box : horse.stable_box?.section === section))
    && (!injured || horse.current_status === "Injured")
    && normalize(`${horse.horse_name} ${horse.id} ${horse.stable_box?.box_code ?? ""}`).includes(normalize(search.trim())));
  const groups = new Map<string, { box: VetHorse["stable_box"]; horses: VetHorse[] }>();
  for (const horse of filtered) {
    const key = horse.stable_box?.id ?? "unassigned";
    if (!groups.has(key)) groups.set(key, { box: horse.stable_box, horses: [] });
    groups.get(key)!.horses.push(horse);
  }

  const status = (horse: VetHorse) => <span className={`rounded-full px-2 py-1 text-xs ${horse.current_status === "Healthy" ? "bg-emerald-100 text-emerald-800" : horse.current_status === "Injured" ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-700"}`}>{statusLabels[horse.current_status] ?? horse.current_status}</span>;
  const identity = (horse: VetHorse) => <button type="button" onClick={() => onOpen(horse.id)} className="flex min-w-0 items-center gap-3 text-left hover:underline"><span className="h-10 w-10 shrink-0 overflow-hidden rounded-md bg-equine-mist"><HorseImage horse={horse as unknown as Horse} /></span><span className="min-w-0"><span className="block break-words font-semibold text-equine-navy">{horse.horse_name}</span><span className="block text-xs text-slate-500">{horse.id.slice(0, 8)}</span></span></button>;
  return <section className="mt-5 rounded-lg border border-equine-line bg-white p-4 shadow-sm sm:p-5" aria-label="Chuồng trại">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-equine-navy">Chuồng trại</h2><div className="flex items-center gap-2">
      <div className="flex rounded-lg bg-slate-100 p-1" role="group" aria-label="Chế độ xem">{([{ key: "map", label: "Sơ đồ" }, { key: "list", label: "Danh sách" }] as const).map((item) => <button type="button" key={item.key} aria-pressed={view === item.key} onClick={() => setView(item.key)} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${view === item.key ? "!bg-blue-700 !text-white shadow-sm" : "text-slate-600 hover:bg-slate-200"}`}>{item.label}</button>)}</div>
      <button type="button" disabled={loading} onClick={onRefresh} className="soft-button h-9 px-3 text-xs"><RefreshCw size={14} className={loading ? "animate-spin" : ""} />Làm mới</button>
    </div></div>
    <div className="my-4 flex flex-wrap items-center gap-3 border-y border-equine-line py-3">
      <label className="min-w-48 flex-1"><span className="sr-only">Tìm ngựa hoặc chuồng</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, mã ngựa hoặc chuồng…" className="w-full rounded-md border border-equine-line px-3 py-2 text-sm" /></label>
      <label className="flex items-center gap-2 text-sm text-slate-600">Khu<select value={section} onChange={(event) => setSection(event.target.value)} className="rounded-md border border-equine-line px-3 py-2"><option value="">Tất cả khu</option>{sections.map((name) => <option key={name} value={name}>{name}</option>)}<option value="unassigned">Chưa xếp chuồng</option></select></label>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={injured} onChange={(event) => setInjured(event.target.checked)} className="h-4 w-4 accent-blue-700" />Có chấn thương</label>
      {(search || section || injured) && <button type="button" onClick={() => { setSearch(""); setSection(""); setInjured(false); }} className="text-xs font-medium text-equine-navy underline">Xóa bộ lọc</button>}
    </div>
    <p role="status" className="mb-3 text-xs text-slate-500">{filtered.length}/{horses.length} ngựa · {groups.size} chuồng có ngựa phù hợp</p>
    {loading && horses.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Đang tải chuồng trại…</p> : filtered.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">Không có ngựa phù hợp. Thử thay đổi bộ lọc.</p> : view === "map" ? <HorseStableYard horses={filtered} stables={stables} onSelectHorse={onSelectHorse} onGoToExam={onGoToExam} onUpdateStatus={onUpdateStatus} /> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-slate-50"><tr>{["Ngựa", "Chuồng", "Khu", "Trạng thái"].map((label) => <th key={label} scope="col" className="px-3 py-3 font-semibold text-equine-navy">{label}</th>)}</tr></thead><tbody className="divide-y divide-equine-line">{filtered.map((horse) => <tr key={horse.id} className="hover:bg-slate-50"><td className="px-3 py-3">{identity(horse)}</td><td className="px-3 py-3">{horse.stable_box?.box_code ?? "Chưa xếp"}</td><td className="px-3 py-3">{horse.stable_box?.section ?? "—"}</td><td className="px-3 py-3">{status(horse)}</td></tr>)}</tbody></table></div>}
  </section>;
}
