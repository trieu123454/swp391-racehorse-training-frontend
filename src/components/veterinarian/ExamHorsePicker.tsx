"use client";

import type { VetHorse } from "@/api/veterinarian/api";
import HorseSearchPicker from "@/components/shared/HorseSearchPicker";

export default function ExamHorsePicker({ horses, selected, disabled, onSelect }: {
  horses: VetHorse[]; selected: VetHorse; disabled: boolean; onSelect: (id: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <p className="text-xs font-medium text-slate-500">
        Ngựa đang xem
        <strong className="mt-0.5 block break-words text-lg font-semibold leading-snug text-equine-navy sm:text-xl">
          {selected.horse_name}
        </strong>
      </p>
      <HorseSearchPicker
        horses={horses}
        selectedId={selected.id}
        onSelect={onSelect}
        disabled={disabled}
        showFilters={true}
        placeholder="Tìm tên, chuồng, mã chip hoặc mã ngựa…"
        ariaLabel="Tìm ngựa theo tên, mã hoặc chuồng"
      />
    </div>
  );
}
