"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Filter, LockKeyhole, Search, ShieldAlert, Trophy, X } from "lucide-react";
import { statusLabels, type Horse } from "@/api/horses/api";
import { HorseImage } from "@/components/horses/HorseUI";
import {
  extractStableOptions,
  filterSearchableHorses,
  horseBoxCode,
  horseSection,
  normalizedHorseReadiness,
  normalizedHorseStatus,
  type SearchableHorse,
} from "@/lib/horse-search";

export type HorseSearchFilterState = {
  query: string;
  status: string;
  stable: string;
  readiness: string;
  filteredIds: Set<string>;
  hasActiveFilter: boolean;
};

type HorseSearchPickerProps<T extends SearchableHorse> = {
  horses: T[];
  selectedId: string;
  onSelect: (id: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  showFilters?: boolean;
  allOptionLabel?: string;
  allOptionValue?: string;
  maxResults?: number;
  onFilterChange?: (state: HorseSearchFilterState) => void;
  className?: string;
};

export default function HorseSearchPicker<T extends SearchableHorse>({
  horses,
  selectedId,
  onSelect,
  placeholder = "Tìm ngựa theo tên, chuồng, mã chip...",
  ariaLabel = "Tìm kiếm ngựa",
  disabled = false,
  loading = false,
  showFilters = true,
  allOptionLabel,
  allOptionValue = "ALL",
  maxResults = 60,
  onFilterChange,
  className = "",
}: HorseSearchPickerProps<T>) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [stable, setStable] = useState("ALL");
  const [readiness, setReadiness] = useState("ALL");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const stableOptions = useMemo(() => extractStableOptions(horses), [horses]);
  const filtered = useMemo(
    () => filterSearchableHorses(horses, { query, status, stable, readiness }),
    [horses, query, status, stable, readiness],
  );
  const hasActiveFilter = Boolean(query.trim()) || status !== "ALL" || stable !== "ALL" || readiness !== "ALL";

  useEffect(() => {
    onFilterChange?.({
      query,
      status,
      stable,
      readiness,
      filteredIds: new Set(filtered.map((item) => item.id)),
      hasActiveFilter,
    });
  }, [filtered, hasActiveFilter, onFilterChange, query, readiness, stable, status]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function clearAll() {
    setQuery("");
    setStatus("ALL");
    setStable("ALL");
    setReadiness("ALL");
  }

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex min-w-[220px] flex-1 items-center rounded-xl border border-equine-line bg-white px-3 py-2 shadow-sm focus-within:border-equine-blue focus-within:ring-2 focus-within:ring-equine-blue/15">
          <Search size={16} className="shrink-0 text-slate-400" />
          <span className="sr-only">{ariaLabel}</span>
          <input
            type="text"
            value={query}
            disabled={disabled}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="w-full border-0 bg-transparent pl-2.5 pr-12 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {query && (
              <button
                type="button"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => {
                  setQuery("");
                  setOpen(true);
                }}
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              disabled={disabled}
              aria-label="Mở danh sách ngựa"
              aria-expanded={open}
              onClick={() => setOpen((current) => !current)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </div>
        </label>

        {showFilters && (
          <>
            <label className="flex items-center gap-1.5 rounded-xl border border-equine-line bg-white px-2.5 py-2 text-xs text-slate-700 shadow-sm focus-within:border-equine-blue">
              <Filter size={14} className="shrink-0 text-slate-400" />
              <select
                aria-label="Lọc theo trạng thái sức khỏe"
                value={status}
                disabled={disabled}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setOpen(true);
                }}
                className="cursor-pointer border-0 bg-transparent text-xs font-medium text-slate-800 outline-none"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Healthy">Khỏe mạnh</option>
                <option value="Monitoring">Cần theo dõi</option>
                <option value="Quarantine">Cách ly</option>
                <option value="Injured">Chấn thương</option>
              </select>
            </label>

            {stableOptions.length > 0 && (
              <label className="flex items-center gap-1.5 rounded-xl border border-equine-line bg-white px-2.5 py-2 text-xs text-slate-700 shadow-sm focus-within:border-equine-blue">
                <ShieldAlert size={14} className="shrink-0 text-slate-400" />
                <select
                  aria-label="Lọc theo chuồng"
                  value={stable}
                  disabled={disabled}
                  onChange={(event) => {
                    setStable(event.target.value);
                    setOpen(true);
                  }}
                  className="max-w-[180px] cursor-pointer border-0 bg-transparent text-xs font-medium text-slate-800 outline-none"
                >
                  <option value="ALL">Tất cả chuồng</option>
                  {stableOptions.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex items-center gap-1.5 rounded-xl border border-equine-line bg-white px-2.5 py-2 text-xs text-slate-700 shadow-sm focus-within:border-equine-blue">
              <Trophy size={14} className="shrink-0 text-slate-400" />
              <select
                aria-label="Lọc theo sẵn sàng thi đấu"
                value={readiness}
                disabled={disabled}
                onChange={(event) => {
                  setReadiness(event.target.value);
                  setOpen(true);
                }}
                className="cursor-pointer border-0 bg-transparent text-xs font-medium text-slate-800 outline-none"
              >
                <option value="ALL">Tất cả thi đấu</option>
                <option value="Ready">Sẵn sàng thi đấu</option>
                <option value="NotReady">Chưa sẵn sàng</option>
                <option value="Unknown">Chưa đánh giá</option>
              </select>
            </label>

            {hasActiveFilter && (
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg px-2 py-1.5 text-xs font-semibold text-teal-700 hover:bg-slate-100 hover:underline"
              >
                Xóa bộ lọc
              </button>
            )}
          </>
        )}
      </div>

      {open && (
        <div
          role="listbox"
          aria-label="Kết quả tìm kiếm ngựa"
          className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-equine-line bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-3 py-2 text-xs text-slate-500">
            <span role="status">
              {loading && horses.length === 0
                ? "Đang tìm ngựa..."
                : `${filtered.length} / ${horses.length} ngựa phù hợp`}
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-200/70"
            >
              Đóng
            </button>
          </div>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto p-2">
            {allOptionLabel && (
              <button
                type="button"
                role="option"
                aria-selected={selectedId === allOptionValue}
                onClick={() => {
                  onSelect(allOptionValue);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                  selectedId === allOptionValue
                    ? "border-equine-navy bg-blue-50/70 font-semibold text-equine-navy"
                    : "border-equine-line bg-slate-50/60 text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span>{allOptionLabel}</span>
                {selectedId === allOptionValue && (
                  <span className="rounded bg-equine-navy px-2 py-0.5 text-[10px] font-semibold text-white">
                    Đang xem
                  </span>
                )}
              </button>
            )}

            {loading && horses.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">Đang tải danh sách ngựa...</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">Không tìm thấy ngựa phù hợp với bộ lọc.</p>
            ) : (
              filtered.slice(0, maxResults).map((horse) => {
                const isSelected = horse.id === selectedId;
                const box = horseBoxCode(horse);
                const section = horseSection(horse);
                const normStatus = normalizedHorseStatus(horse.current_status);
                const statusClass =
                  normStatus === "Injured" || normStatus === "Quarantine"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : normStatus === "Monitoring"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-emerald-200 bg-emerald-50 text-emerald-800";
                const statusText = horse.current_status
                  ? (statusLabels[horse.current_status] ?? horse.current_status)
                  : "";
                const hasReadiness = horse.readiness_status !== undefined && horse.readiness_status !== null;
                const normReadiness = normalizedHorseReadiness(horse.readiness_status);
                const readinessText =
                  normReadiness === "Ready"
                    ? "Sẵn sàng thi đấu"
                    : normReadiness === "NotReady"
                      ? "Chưa sẵn sàng"
                      : "Chưa đánh giá";
                const readinessClass =
                  normReadiness === "Ready"
                    ? "border-sky-200 bg-sky-50 text-sky-800"
                    : normReadiness === "NotReady"
                      ? "border-amber-200 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-slate-100 text-slate-600";
                const idHint = [
                  horse.breed,
                  horse.microchip_number ? `Chip: ${horse.microchip_number}` : null,
                  horse.passport_number ? `HC: ${horse.passport_number}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <button
                    key={horse.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(horse.id);
                      setQuery("");
                      setOpen(false);
                    }}
                    className={`w-full rounded-lg border p-2.5 text-left transition ${
                      isSelected
                        ? "border-equine-navy bg-blue-50/50 shadow-sm ring-1 ring-equine-navy/20"
                        : "border-equine-line hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-equine-mist">
                        <HorseImage horse={horse as unknown as Horse} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold text-equine-navy">{horse.horse_name}</p>
                          {isSelected && (
                            <span className="shrink-0 rounded bg-equine-navy px-1.5 py-0.5 text-[10px] font-semibold text-white">
                              Đang xem
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">
                          {box ? `${box}${section ? ` · Khu ${section}` : ""}` : "Chưa xếp chuồng"}
                        </p>
                        {idHint && <p className="truncate text-[11px] text-slate-400">{idHint}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {statusText && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                            {statusText}
                          </span>
                        )}
                        {hasReadiness && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${readinessClass}`}>
                            {readinessText}
                          </span>
                        )}
                      </div>
                    </div>
                    {horse.is_training_locked && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-700">
                        <LockKeyhole size={12} /> Đang khóa huấn luyện
                      </p>
                    )}
                  </button>
                );
              })
            )}
            {filtered.length > maxResults && (
              <p className="border-t border-slate-100 pt-2 text-center text-xs text-slate-500">
                Hiển thị {maxResults} kết quả đầu tiên. Nhập từ khóa hoặc lọc thêm để thu hẹp.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
