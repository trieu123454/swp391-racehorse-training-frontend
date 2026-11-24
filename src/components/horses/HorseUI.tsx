"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Shield, ShieldAlert, X } from "lucide-react";
import { horseRequest, horseStatus, type Horse } from "@/api/horses/api";
import { APP_MUTATION_COMPLETED_EVENT, SWR_CACHE_UPDATED_EVENT } from "@/api/client";

export function HorseImage({ horse, preview, priority = false }: { horse?: Horse; preview?: string; priority?: boolean }) {
  const directUrl = preview || horse?.image_signed_url || (horse?.image_url && /^(https?:\/\/|\/|blob:)/.test(horse.image_url) ? horse.image_url : undefined);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(priority);
  useEffect(() => {
    if (visible) return;
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);
  const [url, setUrl] = useState<string | undefined>(directUrl);
  const [loadedSrc, setLoadedSrc] = useState<string>();
  useEffect(() => {
    if (directUrl) {
      setUrl(directUrl);
      return;
    }
    setUrl(undefined);
    setLoadedSrc(undefined);
    // Role-specific lists may omit image_url. The horse ID is the shared source
    // of truth for resolving the current, authorized image URL.
    if (!horse?.id || preview || !visible) return;
    let active = true;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      try {
        const data = await horseRequest<{ hasImage: boolean; url?: string }>(`/${encodeURIComponent(horse.id)}/image`);
        if (active) setUrl(data.hasImage ? data.url : undefined);
      } catch {
        // Keep a working image during transient API failures; retry on refresh.
      } finally {
        refreshing = false;
      }
    };
    const onMutation = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path;
      if (path?.startsWith("/api/horses") || path?.startsWith("/api/horse-owner/horse-registration-requests")) void refresh();
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 240000);
    const onCacheUpdate = (event: Event) => {
      const paths = (event as CustomEvent<{ paths?: string[] }>).detail?.paths;
      if (!paths || paths.includes(`/api/horses/${encodeURIComponent(horse.id)}/image`)) void refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener(APP_MUTATION_COMPLETED_EVENT, onMutation);
    window.addEventListener(SWR_CACHE_UPDATED_EVENT, onCacheUpdate);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener(APP_MUTATION_COMPLETED_EVENT, onMutation);
      window.removeEventListener(SWR_CACHE_UPDATED_EVENT, onCacheUpdate);
    };
  }, [horse?.id, horse?.image_url, directUrl, preview, visible]);
  const [brokenSrc, setBrokenSrc] = useState<string>();
  const finalSrc = preview || directUrl || url;
  return <span ref={containerRef} className="block h-full w-full">{visible && finalSrc && brokenSrc !== finalSrc
    // Signed URLs expire and are authorized per user; do not cache them in Next's image optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className={`horse-photo ${loadedSrc === finalSrc ? "is-loaded" : ""}`} src={finalSrc} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} decoding="async" alt={horse?.horse_name || "Ảnh ngựa đã chọn"} onLoad={() => setLoadedSrc(finalSrc)} onError={() => setBrokenSrc(finalSrc)} />
    : <span className="horse-placeholder"><Shield size={36} strokeWidth={1.4} /><span>EQUINE</span><small>Chưa có ảnh hồ sơ</small></span>}</span>;
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
