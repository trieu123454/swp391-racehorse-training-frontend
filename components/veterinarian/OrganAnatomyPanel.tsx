import type { Dispatch, SetStateAction } from "react";
import { organSystemNames, type OrganRecord, type OrganSystems, type OrganSystem } from "./organ-builder";

const systemOrder: OrganSystem[] = ["respiratory", "circulatory", "digestive", "urinary", "nervous"];

export default function OrganAnatomyPanel({
  records,
  systems,
  setSystems,
  selectedId,
  onSelect,
}: {
  records: OrganRecord[];
  systems: OrganSystems;
  setSystems: Dispatch<SetStateAction<OrganSystems>>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const visibleRecords = records.filter((record) => systems[record.system]);
  const selected = records.find((record) => record.id === selectedId);

  return (
    <aside className="min-w-0 rounded-xl border border-[#dce6eb] bg-white/90 p-3 shadow-sm" aria-label="Tra cứu nội tạng ngựa">
      <h5 className="text-sm font-semibold text-[#36566a]">Hệ cơ quan</h5>
      <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Bật/tắt từng hệ. Nhấp mesh để xem chức năng, nhấp đúp để lấy nét.</p>

      <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label="Bật tắt hệ cơ quan">
        {systemOrder.map((system) => (
          <button
            key={system}
            type="button"
            aria-pressed={systems[system]}
            onClick={() => setSystems((current) => ({ ...current, [system]: !current[system] }))}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] transition ${systems[system] ? "border-[#789a9d] bg-[#edf4f3] font-semibold text-[#36566a]" : "border-slate-200 bg-white text-slate-500"}`}
          >
            <span className={`h-3 w-3 rounded border ${systems[system] ? "border-[#456b72] bg-[#456b72] shadow-[inset_0_0_0_2px_white]" : "border-slate-300 bg-white"}`} />
            {organSystemNames[system]}
          </button>
        ))}
      </div>

      <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-100" role="listbox" aria-label="Danh sách cơ quan">
        {visibleRecords.length ? visibleRecords.map((record) => (
          <button
            key={record.id}
            type="button"
            role="option"
            aria-selected={selectedId === record.id}
            onClick={() => onSelect(record.id)}
            className={`flex w-full items-start justify-between gap-2 border-b border-slate-100 px-2.5 py-2 text-left last:border-b-0 ${selectedId === record.id ? "bg-[#edf4f3]" : "bg-white hover:bg-slate-50"}`}
          >
            <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{record.name}</span>
            {record.estimated && <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] text-amber-800">Ước lượng</span>}
          </button>
        )) : <p className="px-2.5 py-3 text-xs text-slate-500">Bật một hệ để xem danh sách mesh.</p>}
      </div>

      {selected ? (
        <div className="mt-3 border-t border-slate-100 pt-3" aria-live="polite">
          <div className="flex items-start justify-between gap-2">
            <h6 className="text-sm font-semibold text-[#36566a]">{selected.name}</h6>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-[9px] font-medium text-amber-800">Minh họa</span>
          </div>
          <p className="mt-1 text-[10px] font-medium text-slate-400">{organSystemNames[selected.system]}</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{selected.description}</p>
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[10px] leading-relaxed text-amber-900">
            Mesh được dựng cho mục đích học tập; hình dạng và vị trí là ước lượng theo rig ngựa hiện có.
          </p>
        </div>
      ) : (
        <p className="mt-3 border-t border-slate-100 pt-3 text-[11px] leading-relaxed text-slate-500">Chọn một cơ quan trong mô hình hoặc danh sách để xem chức năng.</p>
      )}
    </aside>
  );
}
