"use client";

import { useMemo, useState } from "react";
import type { SkeletonGroup, SkeletonRecord } from "./skeleton-builder";

const filters: { id: "all" | SkeletonGroup; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "axial", label: "Trục" },
  { id: "forelimb", label: "Chi trước" },
  { id: "hindlimb", label: "Chi sau" },
  { id: "head", label: "Đầu" },
];

export default function SkeletonAnatomyPanel({
  records,
  selectedId,
  onSelect,
  explodeView,
  setExplodeView,
}: {
  records: SkeletonRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  explodeView: boolean;
  setExplodeView: (visible: boolean) => void;
}) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<"all" | SkeletonGroup>("all");
  const query = search.trim().toLocaleLowerCase("vi");
  const filtered = useMemo(() => records.filter((record) => {
    const inGroup = group === "all" || record.group === group;
    const text = `${record.name} ${record.latin} ${record.description}`.toLocaleLowerCase("vi");
    return inGroup && (!query || text.includes(query));
  }), [records, group, query]);
  const selected = records.find((record) => record.id === selectedId) ?? null;

  return (
    <div className="flex h-[410px] min-h-0 flex-col rounded-xl border border-[#dce6eb] bg-white/90 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-semibold text-[#36566a]">Bộ xương</h5>
          <p className="text-[10px] text-slate-500">{records.length} cấu trúc · chọn để lấy nét</p>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={() => setExplodeView(!explodeView)} aria-pressed={explodeView} className={`ml-auto rounded-md border px-2 py-1 text-[10px] font-semibold ${explodeView ? "border-[#87a8a3] bg-[#eef6f3] text-[#365f59]" : "border-slate-200 text-slate-500"}`}>
          {explodeView ? "Gộp xương" : "Tách lớp"}
        </button>
      </div>
      <label className="mt-2 block">
        <span className="sr-only">Tìm xương theo tên Việt hoặc Latin</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên xương…" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[#719496]" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Lọc nhóm xương">
        {filters.map((filter) => <button key={filter.id} type="button" onClick={() => setGroup(filter.id)} aria-pressed={group === filter.id} className={`rounded-md px-2 py-1 text-[10px] ${group === filter.id ? "bg-[#446b72] font-semibold text-white" : "bg-slate-100 text-slate-600"}`}>{filter.label}</button>)}
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-100">
        {filtered.length ? filtered.map((record) => <button key={record.id} type="button" onClick={() => onSelect(record.id)} className={`block w-full border-b border-slate-100 px-2.5 py-1.5 text-left last:border-b-0 ${selectedId === record.id ? "bg-[#edf4f3]" : "hover:bg-slate-50"}`}>
          <span className="block text-[11px] font-medium text-slate-700">{record.name}</span>
          <span className="block text-[9px] italic text-slate-500">{record.latin}</span>
        </button>) : <p className="px-3 py-4 text-center text-xs text-slate-400">Không tìm thấy xương phù hợp.</p>}
      </div>
      {selected ? <div className="mt-2 rounded-lg border border-[#e1e9e8] bg-[#f7faf9] p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-xs font-semibold text-[#36566a]">{selected.name}</p><p className="text-[10px] italic text-slate-500">{selected.latin}</p></div>
          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-800">Minh họa</span>
        </div>
        <p className="mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-slate-600">{selected.description}</p>
      </div> : <p className="mt-2 rounded-lg bg-[#f7faf9] px-2.5 py-2 text-[10px] leading-relaxed text-slate-500">Mesh xương được dựng theo rig hiện có; số đo, bề mặt khớp và biến thiên cá thể là ước lượng phục vụ học tập.</p>}
    </div>
  );
}
