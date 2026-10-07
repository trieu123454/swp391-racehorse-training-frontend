import type { SensorReading } from "@/api/head-trainer/api";
import RacingHorseSprite from "./RacingHorseSprite";

const tracks = {
  grass: { src: "/img/tracks/grass.png", label: "Cỏ · Turf" },
  dirt: { src: "/img/tracks/dirt.png", label: "Đất · Dirt" },
  synthetic: { src: "/img/tracks/synthetic.png", label: "Nhân tạo · Synthetic" },
};

function trackForSurface(surface?: string | null) {
  const value = surface?.trim().toLowerCase();
  if (value === "dirt" || value?.includes("đất")) return tracks.dirt;
  if (value === "turf" || value === "grass" || value?.includes("cỏ")) return tracks.grass;
  return tracks.synthetic;
}

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

function positionOnTrack(progress: number) {
  const straightLength = 480;
  const turnRadiusX = 210;
  const turnRadiusY = 145;
  const turnLength = Math.PI * turnRadiusX;
  const lapLength = straightLength * 2 + turnLength * 2;
  const distance = Math.min(1, Math.max(0, progress)) * lapLength;

  if (distance < straightLength) {
    const ratio = distance / straightLength;
    return { x: 740 - ratio * straightLength, y: 480, heading: 180 };
  }
  if (distance < straightLength + turnLength) {
    const angle = Math.PI / 2 + (distance - straightLength) / turnRadiusX;
    return {
      x: 260 + turnRadiusX * Math.cos(angle),
      y: 335 + turnRadiusY * Math.sin(angle),
      heading: Math.atan2(turnRadiusY * Math.cos(angle), -turnRadiusX * Math.sin(angle)) * 180 / Math.PI,
    };
  }
  if (distance < straightLength * 2 + turnLength) {
    const ratio = (distance - straightLength - turnLength) / straightLength;
    return { x: 260 + ratio * straightLength, y: 190, heading: 0 };
  }
  const angle = 3 * Math.PI / 2 + (distance - straightLength * 2 - turnLength) / turnRadiusX;
  return {
    x: 740 + turnRadiusX * Math.cos(angle),
    y: 335 + turnRadiusY * Math.sin(angle),
    heading: Math.atan2(turnRadiusY * Math.cos(angle), -turnRadiusX * Math.sin(angle)) * 180 / Math.PI,
  };
}

export default function RaceTrackVisualization({
  horseName,
  readings,
  targetDistance,
  currentSpeed,
  surface,
}: {
  horseName: string;
  readings: SensorReading[];
  targetDistance: number;
  currentSpeed: number;
  surface?: string | null;
}) {
  const track = trackForSurface(surface);
  const distance = distanceFromReadings(readings);
  const progress = targetDistance > 0 ? Math.max(0, Math.min(1, distance / targetDistance)) : 0;
  const horse = positionOnTrack(progress);

  return <section className="training-track-visualization mt-4 overflow-hidden rounded-xl border border-equine-line bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-equine-line px-4 py-3">
      <div><h4 className="font-semibold text-equine-navy">Đường đua mô phỏng</h4><p className="text-xs text-slate-500">{horseName} · vị trí chạy theo cự ly cảm biến</p></div>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-equine-mist px-3 py-1 text-xs font-semibold text-equine-navy">{track.label}</span>
        <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-right"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Vận tốc hiện tại</p><p className="font-bold tabular-nums text-equine-navy">{currentSpeed.toFixed(1)} km/h</p></div>
      </div>
    </div>
    <div className="p-2 sm:p-3">
      <svg viewBox="0 0 1000 670" role="img" aria-label={`Đường đua ${track.label}, ${horseName} đã chạy ${distance.toFixed(0)} trên ${targetDistance} mét`} className="block w-full rounded-lg">
        <image href={track.src} x="0" y="0" width="1000" height="670" preserveAspectRatio="xMidYMid slice" />
        <g aria-label="Vạch xuất phát và đích">
          {Array.from({ length: 8 }, (_, row) => Array.from({ length: 2 }, (_, column) => <rect key={`${row}-${column}`} x={735 + column * 8} y={446 + row * 8} width="8" height="8" fill={(row + column) % 2 === 0 ? "#fff" : "#25302b"} opacity=".95" />))}
        </g>
        <g transform={`translate(${horse.x} ${horse.y}) rotate(${horse.heading})`} style={{ transition: "transform 900ms linear" }}>
          <RacingHorseSprite x={-78} y={-47} width={156} height={94} className="race-track-sprite" />
        </g>
      </svg>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 text-sm">
      <span className="font-medium text-slate-700">Đã chạy {distance.toFixed(0)} / {targetDistance.toLocaleString("vi-VN")} m</span>
      <span className="text-slate-500">{Math.round(progress * 100)}% cự ly mục tiêu</span>
    </div>
    <div className="h-1.5 bg-slate-100"><div className="h-full bg-equine-gold transition-[width] duration-700" style={{ width: `${progress * 100}%` }} /></div>
  </section>;
}
