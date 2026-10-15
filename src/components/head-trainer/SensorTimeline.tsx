import type { SensorReading } from "@/api/head-trainer/api";

export default function SensorTimeline({ readings }: { readings: SensorReading[] }) {
  if (!readings.length) return <p className="text-sm text-slate-500">Chưa có mẫu cảm biến.</p>;
  const last = readings.at(-1)!;
  const duration = Math.max(1, last.elapsed_seconds);
  const x = (second: number) => 45 + second / duration * 660;
  const series = [
    { key: "speed_kmh" as const, title: "Tốc độ (km/h)", color: "#2563eb", ceiling: Math.max(10, ...readings.map((r) => r.speed_kmh)) },
    { key: "heart_rate" as const, title: "Nhịp tim (bpm)", color: "#dc2626", ceiling: Math.max(100, ...readings.map((r) => r.heart_rate)) },
  ];
  return <div className="mt-4 grid gap-4 sm:grid-cols-2">{series.map((line) => <div key={line.key} className="rounded-xl border border-equine-line p-3">
    <h4 className="text-sm font-semibold text-equine-navy">{line.title}</h4>
    <svg viewBox="0 0 730 210" role="img" aria-label={`${line.title} theo thời gian`} className="mt-2 w-full">
      <path d="M45 15 V175 H705" fill="none" stroke="#cbd5e1" />
      <text x="4" y="22" fontSize="13" fill="#64748b">{line.ceiling.toFixed(0)}</text><text x="20" y="175" fontSize="13" fill="#64748b">0</text>
      <polyline fill="none" stroke={line.color} strokeWidth="2.5" points={readings.map((r) => `${x(r.elapsed_seconds)},${175-r[line.key]/line.ceiling*155}`).join(" ")} />
      {readings.filter((_, index) => index % Math.max(1, Math.ceil(readings.length/60)) === 0).map((r) => <circle key={r.elapsed_seconds} cx={x(r.elapsed_seconds)} cy={175-r[line.key]/line.ceiling*155} r="3" fill={line.color}><title>{r.elapsed_seconds}s: {Number(r[line.key]).toFixed(1)}</title></circle>)}
      <text x="45" y="200" fontSize="13" fill="#64748b">0 phút</text><text x="640" y="200" fontSize="13" fill="#64748b">{(duration/60).toFixed(1)} phút</text>
    </svg>
  </div>)}</div>;
}
