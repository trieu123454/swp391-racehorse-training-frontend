"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Shield, ShieldAlert, X } from "lucide-react";
import { horseRequest, horseStatus, type Horse } from "@/api/horses/api";
import { APP_MUTATION_COMPLETED_EVENT, SWR_CACHE_UPDATED_EVENT } from "@/api/client";

export function HorseImage({ horse, preview, priority = false }: { horse?: Horse; preview?: string; priority?: boolean }) {
  const directUrl = preview || horse?.image_signed_url || (horse?.image_url && /^(https?:\/\/|\/|blob:)/.test(horse.image_url) ? horse.image_url : undefined);
  const sourceKey = JSON.stringify([horse?.id, horse?.image_url, horse?.image_signed_url, preview]);
  const containerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(priority);
  const [resolved, setResolved] = useState<{ key: string; url?: string }>();
  const [repair, setRepair] = useState({ key: "", count: 0 });
  const [failedKey, setFailedKey] = useState("");
  const [resolving, setResolving] = useState(false);
  const [brokenSrc, setBrokenSrc] = useState<string>();
  const force = repair.key === sourceKey && repair.count > 0;
  const finalSrc = preview || (resolved?.key === sourceKey ? resolved.url : directUrl);

  useEffect(() => {
    if (visible || priority) return;
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible, priority]);

  useEffect(() => {
    if ((!visible && !priority) || !horse?.id || preview) return;
    let active = true;
    const path = `/${encodeURIComponent(horse.id)}/image`;
    const load = async (fresh = false) => {
      setResolving(true);
      try {
        const data = await horseRequest<{ hasImage: boolean; url?: string }>(path, fresh ? { cache: "reload" } : {});
        if (active) { setResolved({ key: sourceKey, url: data.hasImage ? data.url : undefined }); setFailedKey(""); }
      } catch {
        if (active) setFailedKey(sourceKey);
      } finally {
        if (active) setResolving(false);
      }
    };
    if (!directUrl || force) void load(force);
    // Successful images do not need polling: expiring a signature does not
    // invalidate the pixels already displayed by the browser.
    const mutation = (event: Event) => {
      const changed = (event as CustomEvent<{ path?: string }>).detail?.path;
      if (changed === `/api/horses/${encodeURIComponent(horse.id)}` || changed === `/api/horses${path}`) void load(true);
    };
    const cacheUpdated = (event: Event) => {
      const paths = (event as CustomEvent<{ paths?: string[] }>).detail?.paths;
      if (paths?.includes(`/api/horses${path}`)) void load();
    };
    window.addEventListener(APP_MUTATION_COMPLETED_EVENT, mutation);
    window.addEventListener(SWR_CACHE_UPDATED_EVENT, cacheUpdated);
    return () => { active = false; window.removeEventListener(APP_MUTATION_COMPLETED_EVENT, mutation); window.removeEventListener(SWR_CACHE_UPDATED_EVENT, cacheUpdated); };
  }, [horse?.id, directUrl, sourceKey, preview, visible, priority, force, repair.count]);

  const failed = failedKey === sourceKey || Boolean(finalSrc && brokenSrc === finalSrc);
  return <span ref={containerRef} className="block h-full w-full">{(visible || priority) && finalSrc && brokenSrc !== finalSrc
    // Signed images stay in the browser cache, outside Next's shared optimizer.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="horse-photo is-loaded" src={finalSrc} loading="eager" fetchPriority={priority ? "high" : "auto"} decoding="async" alt={horse?.horse_name || "Ảnh ngựa đã chọn"} onError={() => {
      setBrokenSrc(finalSrc);
      // Recover an expired signed URL once, without an infinite retry loop.
      if (horse?.id && !preview && !force) setRepair({ key: sourceKey, count: 1 });
    }} />
    : <span className="horse-placeholder"><Shield size={32} strokeWidth={1.4} /><span>EQUINE</span><small>{resolving ? "Đang tải ảnh…" : failed ? "Không tải được ảnh" : "Chưa có ảnh hồ sơ"}</small>{failed && horse?.id && !preview && <button type="button" className="text-xs text-blue-700 underline" disabled={resolving} onClick={() => { setBrokenSrc(undefined); setRepair((current) => ({ key: sourceKey, count: current.count + 1 })); }}>Tải lại ảnh</button>}</span>}</span>;
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
