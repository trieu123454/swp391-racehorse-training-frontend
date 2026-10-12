"use client";

import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Notice } from "@/components/horses/HorseUI";
import { authenticatedRequest } from "@/api/client";

type AppNotification = {
  id: string;
  message: string;
  related_table: string | null;
  related_id: string | null;
  is_read: boolean;
  scheduled_at: string | null;
  created_at: string;
};
type NotificationPage = { data: AppNotification[]; unread_count: number; total: number };

export default function NotificationCenter() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await authenticatedRequest<NotificationPage>("/api/notifications?page=1&limit=10");
      setItems(response.data);
      setUnread(response.unread_count);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể tải thông báo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function markRead(id: string) {
    setBusy(true);
    try {
      await authenticatedRequest(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật thông báo.");
    } finally { setBusy(false); }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await authenticatedRequest("/api/notifications/read-all", { method: "POST" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể cập nhật thông báo.");
    } finally { setBusy(false); }
  }

  return <details className="rounded-2xl border border-equine-line bg-white p-4 shadow-sm sm:p-5">
    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 font-sans text-lg font-semibold text-equine-navy"><Bell size={18} /> Thông báo{unread > 0 && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{unread} chưa đọc</span>}</span>
      <span className="text-xs text-slate-500">Tự cập nhật mỗi phút</span>
    </summary>
    <div className="mt-4 border-t border-equine-line pt-4">
      <div className="mb-3 flex justify-end gap-2">
        <button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={13} /> Làm mới</button>
        <button type="button" className="soft-button h-9 px-3 text-xs" onClick={() => void markAllRead()} disabled={busy || unread === 0}><CheckCheck size={13} /> Đọc tất cả</button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {loading ? <Notice>Đang tải thông báo…</Notice> : items.length === 0 ? <p className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">Chưa có thông báo.</p> : <div className="space-y-2">
        {items.map((item) => <article key={item.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${item.is_read ? "border-equine-line bg-white" : "border-equine-gold/40 bg-[#fffaf2]"}`}>
          <div><p className="text-sm font-medium text-equine-navy">{item.message}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.scheduled_at ?? item.created_at).toLocaleString("vi-VN")}{item.is_read ? " · Đã đọc" : " · Chưa đọc"}</p></div>
          {!item.is_read && <button type="button" className="soft-button h-9 px-3 text-xs" disabled={busy} onClick={() => void markRead(item.id)}>Đánh dấu đã đọc</button>}
        </article>)}
      </div>}
    </div>
  </details>;
}
