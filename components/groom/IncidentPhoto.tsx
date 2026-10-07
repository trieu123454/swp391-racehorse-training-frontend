"use client";

import { useEffect, useState } from "react";
import { authenticatedRequest } from "@/api/client";

export default function IncidentPhoto({ incidentId, imageUrl }: { incidentId: string; imageUrl: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let current = true;
    setUrl(null);
    if (!imageUrl) return () => { current = false; };
    if (imageUrl.startsWith("https://") || imageUrl.startsWith("http://")) {
      setUrl(imageUrl);
      return () => { current = false; };
    }
    if (!imageUrl.startsWith("incidents/")) return () => { current = false; };

    const refresh = () => {
      setLoading(true);
      authenticatedRequest<{ hasImage: boolean; url?: string }>(`/api/stable-incidents/${encodeURIComponent(incidentId)}/image`)
        .then((result) => { if (current) setUrl(result.hasImage ? result.url ?? null : null); })
        .catch(() => { if (current) setUrl(null); })
        .finally(() => { if (current) setLoading(false); });
    };
    refresh();
    const timer = window.setInterval(refresh, 240000);
    return () => { current = false; window.clearInterval(timer); };
  }, [incidentId, imageUrl]);

  if (!imageUrl) return null;
  if (url) return <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-blue-700 underline">Mở ảnh đính kèm</a>;
  return <p className="mt-2 text-xs text-slate-500">{loading ? "Đang tải ảnh đính kèm…" : "Không tải được ảnh đính kèm."}</p>;
}
