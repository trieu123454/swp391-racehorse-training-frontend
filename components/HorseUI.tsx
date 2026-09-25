"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Shield, X } from "lucide-react";
import { horseRequest, horseStatus, type Horse } from "@/lib/horses";

export function HorseImage({ horse, preview }: { horse?: Horse; preview?: string }) {
  const [url, setUrl] = useState<string>();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setUrl(undefined);
    setLoaded(false);
    if (!horse?.image_url || preview) return;
    let active = true;
    const refresh = () => horseRequest<{ hasImage: boolean; url?: string }>(`/${horse.id}/image`)
      .then(data => { if (active) setUrl(data.url); }).catch(() => { if (active) setUrl(undefined); });
    void refresh();
    const timer = setInterval(refresh, 240000);
    return () => { active = false; clearInterval(timer); };
  }, [horse?.id, horse?.image_url, preview]);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [preview, url]);
  return (preview || url) && !broken
    // Signed URLs expire and are authorized per user; do not cache them in Next's image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className={`horse-photo ${loaded ? "is-loaded" : ""}`} src={preview || url} alt={horse?.horse_name || "Ảnh ngựa đã chọn"} onLoad={() => setLoaded(true)} onError={() => setBroken(true)} />
    : <div className="horse-placeholder"><Shield size={44} strokeWidth={1.2} /><span>EQUINE SOVEREIGN</span><small>Chưa có ảnh hồ sơ</small></div>;
}

export function StatusBadge({ horse }: { horse: Horse }) {
  return <span className={`horse-badge ${horse.current_status === "Healthy" ? "healthy" : "attention"}`}><i />{horseStatus(horse.current_status)}</span>;
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <div role={error ? "alert" : "status"} className={`horse-notice ${error ? "error" : ""}`}>{children}</div>;
}

export function Modal({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="horse-dialog" aria-labelledby="horse-dialog-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}>
    <button className="horse-icon-button modal-close" type="button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={20} /></button>
    <h2 id="horse-dialog-title">{title}</h2>{children}
  </dialog>;
}
