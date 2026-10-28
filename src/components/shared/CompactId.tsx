"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CompactId({
  id,
  prefix,
  copyable = true,
  className = "",
}: {
  id: string | null | undefined;
  prefix?: string;
  copyable?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!id) return <span className="text-slate-400">—</span>;

  const display =
    id.length > 14
      ? `${id.slice(0, 8)}…${id.slice(-4)}`
      : id;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // fallback
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs text-slate-700 ${className}`}
      title={id}
    >
      {prefix && <span className="text-slate-500 font-sans text-[11px]">{prefix}</span>}
      <span className="select-all font-medium">{display}</span>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          aria-label={copied ? "Đã sao chép mã" : `Sao chép mã ${id}`}
          title={copied ? "Đã sao chép!" : "Sao chép mã đầy đủ"}
        >
          {copied ? (
            <Check size={12} className="text-emerald-600" />
          ) : (
            <Copy size={12} />
          )}
        </button>
      )}
    </span>
  );
}
