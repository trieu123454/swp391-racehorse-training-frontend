import type { SensorReading } from "@/api/head-trainer/api";
import RaceTrackScene3D, { type RaceTrackRunner } from "./RaceTrackScene3D";

function distanceFromReadings(readings: SensorReading[]) {
  let distance = 0;
  for (let index = 1; index < readings.length; index += 1) {
    const previous = readings[index - 1];
    const current = readings[index];
    const seconds = current.elapsed_seconds - previous.elapsed_seconds;
    if (seconds > 0) distance += ((previous.speed_kmh + current.speed_kmh) / 2 / 3.6) * seconds;
  }
  return distance;
}

function surfaceLabel(surface?: string | null) {
  const value = surface?.trim().toLowerCase() ?? "";
  if (value.includes("dirt") || value.includes("sand") || value.includes("soil") || value.includes("đất") || value.includes("dat")) return "Đất · Dirt";
  if (value.includes("grass") || value.includes("turf") || value.includes("cỏ") || value.includes("co")) return "Cỏ · Turf";
  return "Nhân tạo · Synthetic";
}

export default function RaceTrackVisualization({
  horseName,
  horseId,
  readings,
  targetDistance,
  currentSpeed,
  surface,
  isRunning,
}: {
  horseName: string;
  horseId: string;
  readings: SensorReading[];
  targetDistance: number;
  currentSpeed: number;
  surface?: string | null;
  isRunning: boolean;
}) {
  const distance = distanceFromReadings(readings);
  const progress = targetDistance > 0 ? Math.max(0, Math.min(1, distance / targetDistance)) : 0;
  const runners: RaceTrackRunner[] = [{ id: horseId, name: horseName, lane: 1, progress, speedKmh: currentSpeed }];

  return <section className="training-track-visualization mt-4 overflow-hidden rounded-xl border border-equine-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-equine-line px-4 py-3">
      <div><h4 className="font-semibold text-equine-navy">Đường đua 3D mô phỏng</h4><p className="text-xs text-slate-500">{horseName} · ngựa chạy trên mặt sân 3D</p></div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-equine-mist px-3 py-1 text-xs font-semibold text-equine-navy">{surfaceLabel(surface)}</span>
        <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vận tốc hiện tại</p><p className="font-bold tabular-nums text-equine-navy">{currentSpeed.toFixed(1)} km/h</p></div>
      </div>
    </div>
    <div className="p-2 sm:p-3">
      <RaceTrackScene3D surface={surface} runners={runners} targetDistanceMeters={targetDistance} isRunning={isRunning} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-sm">
      <span className="font-medium text-slate-700">Đã chạy {distance.toFixed(0)} / {targetDistance.toLocaleString("vi-VN")} m</span>
      <span className="text-slate-500">{Math.round(progress * 100)}% cự ly mục tiêu</span>
    </div>
    <div className="h-1.5 bg-slate-100"><div className="h-full bg-equine-gold transition-[width] duration-700" style={{ width: `${progress * 100}%` }} /></div>
  </section>;
}
