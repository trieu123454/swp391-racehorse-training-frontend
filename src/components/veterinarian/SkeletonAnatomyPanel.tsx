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
  showLabels,
  setShowLabels,
  jawOpen,
  setJawOpen,
}: {
  records: SkeletonRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  explodeView: boolean;
  setExplodeView: (visible: boolean) => void;
  showLabels: boolean;
  setShowLabels: (visible: boolean) => void;
  jawOpen: boolean;
  setJawOpen: (visible: boolean) => void;
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

  if (records.length === 0) {
    return (
      <div className="flex h-[410px] min-h-0 flex-col rounded-xl border border-equine-line bg-white p-3">
        <h5 className="text-sm font-semibold text-equine-navy">Bộ xương</h5>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-amber-900">
          Không tìm thấy đủ điểm neo trên rig để dựng cột sống minh họa.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-[410px] min-h-0 flex-col rounded-xl border border-equine-line bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h5 className="text-sm font-semibold text-equine-navy">Bộ xương</h5>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
          <input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} className="accent-equine-navy" />
          Nhãn xương
        </label>
        <button type="button" onClick={() => setExplodeView(!explodeView)} aria-pressed={explodeView} className={`ml-auto rounded-md border px-2 py-1 text-[10px] font-semibold ${explodeView ? "border-equine-gold/50 bg-equine-champagne text-equine-navy" : "border-slate-200 text-slate-500"}`}>
          {explodeView ? "Gộp xương" : "Tách lớp"}
        </button>
      </div>
      <label className="mt-2 block">
        <span className="sr-only">Tìm xương theo tên Việt hoặc Latin</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên xương…" className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-equine-gold" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Lọc nhóm xương">
        {filters.map((filter) => <button key={filter.id} type="button" onClick={() => setGroup(filter.id)} aria-pressed={group === filter.id} className={`rounded-md px-2 py-1 text-[10px] ${group === filter.id ? "bg-equine-navy font-semibold text-white" : "bg-equine-mist text-equine-ink"}`}>{filter.label}</button>)}
      </div>
      <div className="mt-2 min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-100">
        {filtered.length ? filtered.map((record) => <button key={record.id} type="button" onClick={() => onSelect(record.id)} className={`block w-full border-b border-slate-100 px-2.5 py-1.5 text-left last:border-b-0 ${selectedId === record.id ? "bg-equine-champagne" : "hover:bg-slate-50"}`}>
          <span className="block text-[11px] font-medium text-slate-700">{record.name}</span>
        </button>) : <p className="px-3 py-4 text-center text-xs text-slate-400">Không tìm thấy xương phù hợp.</p>}
      </div>
      {selected ? <div className="mt-2 rounded-lg border border-equine-line bg-equine-paper p-2.5">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-xs font-semibold text-equine-navy">{selected.name}</p><p className="text-[10px] italic text-slate-500">{selected.latin}</p></div>
        </div>
        <p className="mt-1.5 line-clamp-3 text-[10px] leading-relaxed text-slate-600">{selected.description}</p>
        {selected.id === "mandible" && <button type="button" onClick={() => setJawOpen(!jawOpen)} aria-pressed={jawOpen} className="mt-2 rounded-md border border-equine-line bg-white px-2 py-1 text-[10px] font-semibold text-equine-navy">{jawOpen ? "Khép hàm" : "Mở hàm"}</button>}
      </div> : null}
    </div>
  );
}
