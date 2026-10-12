import type { Dispatch, SetStateAction } from "react";
import type { EquineMuscleRecord, MuscleFilters, MuscleGroupFilter } from "./muscle-builder";

const groupLabels: Record<MuscleGroupFilter, string> = {
  all: "Tất cả nhóm",
  "head-neck": "Đầu – cổ",
  trunk: "Thân mình",
  forelimb: "Chi trước",
  hindlimb: "Chi sau",
  "tendon-ligament": "Gân & dây chằng",
};

export default function MuscleAnatomyPanel({
  filters,
  setFilters,
  muscles,
  selectedMuscle,
  selectedId,
  onSelect,
}: {
  filters: MuscleFilters;
  setFilters: Dispatch<SetStateAction<MuscleFilters>>;
  muscles: EquineMuscleRecord[];
  selectedMuscle?: EquineMuscleRecord;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="min-w-0 rounded-xl border border-[#dce6eb] bg-white/90 p-3 shadow-sm" aria-label="Tra cứu cơ ngựa">
      <h5 className="text-sm font-semibold text-[#36566a]">Tra cứu giải phẫu</h5>
      <label className="mt-2 block text-[11px] font-medium text-slate-500" htmlFor="muscle-search">Tìm cơ / gân</label>
      <input
        id="muscle-search"
        type="search"
        value={filters.search}
        onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
        placeholder="Tên tiếng Việt hoặc Latin"
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none transition focus:border-[#789a9d] focus:ring-2 focus:ring-[#789a9d]/20"
      />
      <label className="mt-2 block text-[11px] font-medium text-slate-500" htmlFor="muscle-group">Nhóm giải phẫu</label>
      <select
        id="muscle-group"
        value={filters.group}
        onChange={(event) => setFilters((current) => ({ ...current, group: event.target.value as MuscleGroupFilter }))}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-[#789a9d]"
      >
        {Object.entries(groupLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Lớp nông và sâu">
        {(["superficial", "deep"] as const).map((layer) => {
          const active = filters[layer];
          return (
            <button
              key={layer}
              type="button"
              aria-pressed={active}
              onClick={() => setFilters((current) => ({ ...current, [layer]: !current[layer] }))}
              className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${active ? "border-[#446b72] bg-[#446b72] font-semibold text-white" : "border-slate-200 bg-white text-slate-600"}`}
            >
              {layer === "superficial" ? "Lớp nông" : "Lớp sâu"}
            </button>
          );
        })}
        <span className="ml-auto self-center text-[10px] text-slate-400">{muscles.length} cấu trúc</span>
      </div>

      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-slate-100" role="listbox" aria-label="Danh sách cấu trúc">
        {muscles.length ? muscles.map((muscle) => (
          <button
            key={muscle.id}
            type="button"
            role="option"
            aria-selected={selectedId === muscle.id}
            onClick={() => onSelect(muscle.id)}
            className={`flex w-full items-start gap-2 border-b border-slate-100 px-2.5 py-2 text-left last:border-b-0 ${selectedId === muscle.id ? "bg-[#edf4f3]" : "bg-white hover:bg-slate-50"}`}
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: muscle.color }} />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-700">{muscle.vi}</span>
              <span className="block truncate text-[10px] italic text-slate-400">{muscle.latin}</span>
            </span>
          </button>
        )) : <p className="px-2.5 py-3 text-xs text-slate-500">Không tìm thấy cấu trúc phù hợp.</p>}
      </div>

      {selectedMuscle ? (
        <div className="mt-3 border-t border-slate-100 pt-3" aria-live="polite">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h6 className="text-sm font-semibold text-[#36566a]">{selectedMuscle.vi}</h6>
              <p className="text-[11px] italic text-slate-500">{selectedMuscle.latin}</p>
            </div>
            <span className="rounded-full bg-[#edf4f3] px-2 py-1 text-[10px] font-medium text-[#446b72]">
              {selectedMuscle.kind === "muscle" ? "Cơ" : selectedMuscle.kind === "fascia" ? "Cân" : selectedMuscle.kind === "tendon" ? "Gân" : "Dây chằng"}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{selectedMuscle.function}</p>
          <dl className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-slate-500">
            <div><dt className="inline font-semibold text-slate-600">Nguyên ủy: </dt><dd className="inline">{selectedMuscle.origin.label}</dd></div>
            <div><dt className="inline font-semibold text-slate-600">Bám tận: </dt><dd className="inline">{selectedMuscle.insertion.label}</dd></div>
            {selectedMuscle.commonInjuries && <div><dt className="inline font-semibold text-slate-600">Chấn thương thường gặp: </dt><dd className="inline">{selectedMuscle.commonInjuries}</dd></div>}
            {!!selectedMuscle.synergists.length && <div><dt className="inline font-semibold text-slate-600">Hiệp đồng: </dt><dd className="inline">{selectedMuscle.synergists.join(", ")}</dd></div>}
            {!!selectedMuscle.antagonists.length && <div><dt className="inline font-semibold text-slate-600">Đối kháng: </dt><dd className="inline">{selectedMuscle.antagonists.join(", ")}</dd></div>}
          </dl>
          {selectedMuscle.note && <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-900">Ước lượng mô hình: {selectedMuscle.note}</p>}
        </div>
      ) : (
        <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">Chọn một cấu trúc trên mô hình hoặc trong danh sách để xem điểm bám và chức năng.</p>
      )}
    </aside>
  );
}

