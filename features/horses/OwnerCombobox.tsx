"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, LoaderCircle, Search, UserRound } from "lucide-react";
import { errorMessage, getHorseOwners, type Owner } from "@/features/horses/api";

type Props = {
  value: number | null;
  onChange: (ownerId: number | null) => void;
};

export function OwnerCombobox({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value === null) {
      setSelectedOwner(null);
      setLoadingSelection(false);
      return;
    }
    if (selectedOwner?.user_id === value) {
      setLoadingSelection(false);
      return;
    }

    const controller = new AbortController();
    setSelectedOwner(null);
    setLoadingSelection(true);
    void getHorseOwners(String(value), 0, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setSelectedOwner(result.items.find((owner) => owner.user_id === value) ?? null);
        setLoadingSelection(false);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(reason));
          setLoadingSelection(false);
        }
      });
    return () => controller.abort();
  }, [value, selectedOwner?.user_id]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    const isId = /^#?\d+$/.test(term);
    if (!isId && term.length < 3) {
      setOwners([]);
      setHasMore(false);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError("");
      void getHorseOwners(term, page, controller.signal)
        .then((result) => {
          setOwners((current) => page === 0 ? result.items : [...current, ...result.items]);
          setHasMore(result.hasMore);
        })
        .catch((reason) => {
          if (!controller.signal.aborted) setError(errorMessage(reason));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, page === 0 ? 250 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, page]);

  function startSearch() {
    setOpen(true);
    setQuery("");
    setOwners([]);
    setPage(0);
    setHasMore(false);
    setError("");
  }

  function choose(owner: Owner | null) {
    setSelectedOwner(owner);
    onChange(owner?.user_id ?? null);
    setOpen(false);
    setQuery("");
    setPage(0);
    setError("");
  }

  const queryIsId = /^#?\d+$/.test(query.trim());
  const canSearch = queryIsId || query.trim().length >= 3;

  return (
    <div ref={rootRef} className="relative">
      <span id="owner-selector-label" className="field-label">Chủ sở hữu</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-controls="owner-selector-options"
        aria-labelledby="owner-selector-label owner-selector-value"
        aria-expanded={open}
        onClick={() => open ? setOpen(false) : startSearch()}
        className="field-control flex min-h-[52px] items-center justify-between gap-3 text-left"
      >
        <span id="owner-selector-value" className="min-w-0">
          <span className="block truncate text-sm font-medium text-equine-navy">
            {selectedOwner?.full_name ?? (value === null ? "Không gán chủ sở hữu" : `Chủ sở hữu #${value}`)}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {selectedOwner ? `${selectedOwner.email} · Mã #${selectedOwner.user_id}` : value !== null ? (loadingSelection ? "Đang tải thông tin chủ sở hữu..." : `Mã #${value}`) : "Chọn để tìm theo tên, email, số điện thoại hoặc mã chủ"}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-equine-line bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-equine-line px-3">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(event) => { setQuery(event.target.value); setPage(0); setOwners([]); setError(""); }}
              className="min-w-0 flex-1 border-0 bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
              placeholder="Nhập tên, email, số điện thoại hoặc mã #..."
              aria-label="Tìm chủ sở hữu"
            />
            {loading && <LoaderCircle size={17} className="animate-spin text-slate-400" />}
          </div>

          <div className="max-h-72 overflow-y-auto p-1">
            <div id="owner-selector-options" role="listbox" aria-label="Kết quả chủ sở hữu">
            <button type="button" role="option" aria-selected={value === null} onClick={() => choose(null)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-slate-50">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500"><UserRound size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-equine-navy">Không gán chủ sở hữu</span>
                <span className="block text-xs text-slate-500">Có thể gán chủ sau</span>
              </span>
              {value === null && <Check size={16} className="text-equine-gold" />}
            </button>

            {owners.map((owner) => (
              <button key={owner.user_id} type="button" role="option" aria-selected={value === owner.user_id} onClick={() => choose(owner)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[#f7f9ff]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#eef2ff] text-equine-navy"><UserRound size={16} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-equine-navy">{owner.full_name}</span>
                  <span className="block truncate text-xs text-slate-500">{owner.email}{owner.phone ? ` · ${owner.phone}` : ""} · Mã #{owner.user_id}</span>
                </span>
                {value === owner.user_id && <Check size={16} className="shrink-0 text-equine-gold" />}
              </button>
            ))}
            </div>

            {!canSearch && <p className="px-3 py-4 text-sm text-slate-500">Nhập ít nhất 3 ký tự để tìm, hoặc nhập mã chủ sở hữu.</p>}
            {canSearch && !loading && !error && owners.length === 0 && <p className="px-3 py-4 text-sm text-slate-500">Không tìm thấy chủ sở hữu phù hợp.</p>}
            {error && <p role="alert" className="px-3 py-3 text-sm text-red-600">{error}</p>}

            {hasMore && (
              <button type="button" onClick={() => setPage((current) => current + 1)} disabled={loading} className="w-full rounded-lg px-3 py-2.5 text-sm font-medium text-equine-navy hover:bg-[#f7f9ff] disabled:opacity-50">
                {loading ? "Đang tải..." : "Tải thêm kết quả"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
