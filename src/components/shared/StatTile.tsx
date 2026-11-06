import type { ReactNode } from "react";

export type StatTone = "slate" | "indigo" | "emerald" | "amber" | "rose" | "blue";

const TONES: Record<StatTone, { bar: string; value: string; alert: string }> = {
  slate: { bar: "bg-slate-400", value: "text-slate-900", alert: "border-slate-300" },
  indigo: { bar: "bg-indigo-500", value: "text-indigo-900", alert: "border-indigo-300" },
  emerald: { bar: "bg-emerald-500", value: "text-emerald-900", alert: "border-emerald-300" },
  amber: { bar: "bg-amber-500", value: "text-amber-900", alert: "border-amber-300 bg-amber-50/60" },
  rose: { bar: "bg-rose-500", value: "text-rose-900", alert: "border-rose-300 bg-rose-50/60" },
  blue: { bar: "bg-blue-500", value: "text-blue-900", alert: "border-blue-300" },
};

/**
 * Ô thống kê gọn: thanh màu bên trái, nhãn, giá trị lớn, mô tả nhỏ.
 * `highlight` = true khi chỉ số cần chú ý (viền màu nổi bật); khi giá trị bằng 0 thì giữ màu trung tính.
 */
export function StatTile({
  label,
  value,
  suffix,
  hint,
  tone = "slate",
  highlight = false,
  onClick,
  active = false,
}: {
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  highlight?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const t = TONES[tone];
  const base = `relative flex w-full overflow-hidden rounded-xl border bg-white text-left shadow-xs transition ${
    highlight ? t.alert : "border-slate-200"
  } ${active ? "ring-2 ring-slate-900/15" : ""} ${onClick ? "hover:border-slate-400 cursor-pointer" : ""}`;
  const body = (
    <>
      <span className={`w-1 shrink-0 ${highlight || tone === "indigo" || tone === "emerald" || tone === "blue" ? t.bar : "bg-slate-200"}`} />
      <span className="flex min-w-0 flex-1 flex-col px-3.5 py-2.5">
        <span className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`mt-0.5 text-2xl font-black leading-tight ${highlight || tone !== "amber" && tone !== "rose" ? t.value : "text-slate-700"}`}>
          {value}
          {suffix != null && <span className="ml-0.5 text-sm font-bold text-slate-400">{suffix}</span>}
        </span>
        {hint != null && <span className="mt-0.5 truncate text-[11px] text-slate-500">{hint}</span>}
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={base}>{body}</button>
  ) : (
    <div className={base}>{body}</div>
  );
}
