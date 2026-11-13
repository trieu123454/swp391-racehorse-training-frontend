"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Shield, ShieldAlert, X } from "lucide-react";
import { getHorseImageUrl, horseStatus, type Horse } from "@/api/horses/api";

export function HorseImage({ horse, preview }: { horse?: Horse; preview?: string }) {
  const directUrl = preview || horse?.image_signed_url || (horse?.image_url && (horse.image_url.startsWith("http://") || horse.image_url.startsWith("https://") || horse.image_url.startsWith("/") || horse.image_url.startsWith("blob:")) ? horse.image_url : undefined);
  const [url, setUrl] = useState<string | undefined>(directUrl);
  const [loaded, setLoaded] = useState(Boolean(directUrl));
  useEffect(() => {
    if (directUrl) {
      setUrl(directUrl);
      return;
    }
    setUrl(undefined);
    setLoaded(false);
    if (!horse?.image_url || !horse?.id) return;
    let active = true;
    const refresh = () => getHorseImageUrl(horse.id, horse.image_url)
      .then(signedUrl => { if (active) setUrl(signedUrl); }).catch(() => { if (active) setUrl(undefined); });
    void refresh();
    const timer = setInterval(refresh, 240000);
    return () => { active = false; clearInterval(timer); };
  }, [horse?.id, horse?.image_url, directUrl]);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [preview, url, directUrl]);
  const finalSrc = preview || directUrl || url;
  return finalSrc && !broken
    // Signed URLs expire and are authorized per user; do not cache them in Next's image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className={`horse-photo ${loaded ? "is-loaded" : ""}`} src={finalSrc} alt={horse?.horse_name || "Ảnh ngựa đã chọn"} onLoad={() => setLoaded(true)} onError={() => setBroken(true)} />
    : <div className="horse-placeholder"><Shield size={36} strokeWidth={1.4} /><span>EQUINE</span><small>Chưa có ảnh hồ sơ</small></div>;
}

export function StatusBadge({ horse }: { horse: Horse }) {
  const status = horse.current_status;
  if (status === "Healthy") {
    return (
      <span className="horse-badge healthy">
        <CheckCircle2 size={13} strokeWidth={2.2} />
        {horseStatus(status)}
      </span>
    );
  }
  if (status === "Monitoring") {
    return (
      <span className="horse-badge monitoring">
        <AlertCircle size={13} strokeWidth={2.2} />
        {horseStatus(status)}
      </span>
    );
  }
  if (status === "Quarantine") {
    return (
      <span className="horse-badge quarantine">
        <ShieldAlert size={13} strokeWidth={2.2} />
        {horseStatus(status)}
      </span>
    );
  }
  return (
    <span className="horse-badge critical">
      <AlertTriangle size={13} strokeWidth={2.2} />
      {horseStatus(status)}
    </span>
  );
}

export function Notice({ children, error = false, variant }: { children: ReactNode; error?: boolean; variant?: "error" | "warning" | "success" | "info" }) {
  const finalVariant = variant ?? (error ? "error" : "info");
  const Icon = finalVariant === "error" ? AlertCircle : finalVariant === "warning" ? AlertTriangle : finalVariant === "success" ? CheckCircle2 : Info;
  return (
    <div role={finalVariant === "error" ? "alert" : "status"} className={`horse-notice ${finalVariant}`}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
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
    <button className="horse-icon-button modal-close" type="button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={18} /></button>
    <h2 id="horse-dialog-title">{title}</h2>{children}
  </dialog>;
}
