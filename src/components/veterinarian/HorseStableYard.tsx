"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X, Stethoscope, ShieldAlert, HeartPulse, FileText, Sparkles } from "lucide-react";
import { Routes } from "@/routes/Routes";
import type { VetHorse } from "@/api/veterinarian/api";
import { HorseImage, Notice } from "@/components/horses/HorseUI";
import type { Horse } from "@/api/horses/api";
import HorseIllustration, { type HorseCoat } from "./Horse";

type MotionState = "walk" | "trot" | "graze" | "idle";
type HorseAgent = { id: string; x: number; direction: -1 | 1; motion: MotionState; remainingMs: number; speed: number };
type StableHorse = { horse: VetHorse; colorIndex: number };
type StableGroup = {
  id: string;
  name: string;
  section: string;
  box_type?: "Normal" | "Quarantine" | "Injury";
  capacity?: number;
  horses: StableHorse[];
};

export type YardStableBox = {
  id: string;
  box_code: string;
  section: string;
  box_type: "Normal" | "Quarantine" | "Injury";
  capacity: number;
  status: string;
  occupied: number;
};

const HORSE_WIDTH = 150;
const FRAME_MS = 1000 / 60;
function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function randomMotion(): MotionState {
  const choice = Math.random();
  return choice < 0.18 ? "graze" : choice < 0.26 ? "trot" : "walk";
}

function nextMotion(current: MotionState): MotionState {
  const choice = Math.random();
  if (current === "walk") return choice < 0.45 ? "graze" : "trot";
  if (current === "trot") return choice < 0.78 ? "walk" : "graze";
  return choice < 0.8 ? "walk" : "trot";
}

function motionDuration(motion: MotionState) {
  if (motion === "trot") return randomBetween(1300, 2600);
  if (motion === "graze") return randomBetween(4200, 8200);
  return randomBetween(5000, 10500);
}

function motionSpeed(motion: MotionState) {
  if (motion === "trot") return randomBetween(1.3, 1.8);
  if (motion === "walk") return randomBetween(0.35, 0.6);
  return 0;
}

function sceneHeightForHorseCount(count: number) {
  const laneCount = Math.min(2, Math.max(1, count));
  return Math.max(260, 230 + Math.ceil(count / laneCount) * 40);
}

function healthDotClass(status: string) {
  if (status === "Healthy") return "bg-emerald-500 text-emerald-800 border-emerald-300";
  if (status === "Monitoring" || status === "Under Observation") return "bg-amber-500 text-amber-900 border-amber-300";
  return "bg-rose-600 text-rose-900 border-rose-300";
}

const horseStatusLabels: Record<string, string> = {
  Healthy: "Khỏe mạnh",
  Injured: "Chấn thương",
  Quarantine: "Cách ly",
  Monitoring: "Đang theo dõi",
  "Under Observation": "Cần theo dõi",
  Sick: "Đang bệnh",
};

export default function HorseStableYard({
  horses,
  stables = [],
  onSelectHorse,
  onGoToExam,
  onUpdateStatus,
}: {
  horses: VetHorse[];
  stables?: YardStableBox[];
  onSelectHorse: (id: string) => void;
  onGoToExam?: (id: string) => void;
  onUpdateStatus?: (horseId: string, status: string, readiness: string, note?: string) => Promise<void>;
}) {
  const [selectedHorse, setSelectedHorse] = useState<VetHorse | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const groups = useMemo(() => {
    const byStable = new Map<string, StableGroup>();

    // 1. Luôn hiển thị các chuồng Cách ly (Q-01..Q-03) và Chấn thương (I-01..I-03) dù đang có hay không có ngựa
    stables.forEach((s) => {
      const isMedical = s.box_type === "Quarantine" || s.box_type === "Injury";
      if (isMedical) {
        byStable.set(s.id, {
          id: s.id,
          name: `Chuồng ${s.box_code}`,
          section: s.section,
          box_type: s.box_type,
          capacity: s.capacity,
          horses: [],
        });
      }
    });

    // 2. Phân bổ các con ngựa vào chuồng
    horses.forEach((horse, colorIndex) => {
      const box = horse.stable_box;
      const id = box?.id ?? "unassigned";
      let existing = byStable.get(id);
      if (!existing) {
        existing = {
          id,
          name: box?.box_code ? `Chuồng ${box.box_code}` : "Chưa xếp chuồng",
          section: box?.section ? `Khu ${box.section}` : "Chưa có khu",
          box_type: (box?.box_type as "Normal" | "Quarantine" | "Injury") ?? "Normal",
          capacity: 1,
          horses: [],
        };
        byStable.set(id, existing);
      }
      existing.horses.push({ horse, colorIndex });
    });

    // 3. Ưu tiên đưa Khu Cách ly lên đầu, sau đó Khu Chấn thương, rồi đến chuồng thường
    return [...byStable.values()].sort((a, b) => {
      const rank = (g: StableGroup) =>
        g.box_type === "Quarantine" ? 1 : g.box_type === "Injury" ? 2 : g.id === "unassigned" ? 99 : 10;
      const diff = rank(a) - rank(b);
      if (diff !== 0) return diff;
      return a.section.localeCompare(b.section, "vi") || a.name.localeCompare(b.name, "vi");
    });
  }, [horses, stables]);

  const sceneHeight = Math.max(260, ...groups.map((group) => sceneHeightForHorseCount(group.horses.length)));

  const selectHorse = useCallback((horse: VetHorse) => {
    setActionError("");
    setSelectedHorse(horse);
    onSelectHorse(horse.id);
  }, [onSelectHorse]);

  async function handleRelocate(horseId: string, status: string, readiness: string, note: string) {
    if (!onUpdateStatus) return;
    setActionBusy(true);
    setActionError("");
    try {
      await onUpdateStatus(horseId, status, readiness, note);
      setSelectedHorse(null);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Không thể cập nhật trạng thái. Vui lòng thử lại.");
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-equine-line bg-white shadow-sm" aria-label="Khu chuồng trại">
        {/* Header với bộ lọc trực quan các phân khu */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-equine-line bg-slate-50/70 px-4 py-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-sans text-sm font-black text-equine-navy">Sơ đồ chuồng trại</h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                Trực quan 2D
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {horses.length} ngựa · {groups.length} khu vực chuồng
            </p>
          </div>

        </div>

        {/* Lưới các chuồng 2D */}
        <div className="grid grid-cols-1 gap-3.5 p-3.5 xl:grid-cols-2">
          {groups.map((group) => {
            const isQuarantine = group.box_type === "Quarantine" || group.section.toLowerCase().includes("cách ly");
            const isInjury = group.box_type === "Injury" || group.section.toLowerCase().includes("chấn thương");
            const isEmpty = group.horses.length === 0;

            return (
              <section
                key={group.id}
                className={`stable-yard-stall rounded-xl border transition shadow-xs ${
                  isQuarantine
                    ? "!border-rose-400 !ring-2 !ring-rose-300/40 bg-rose-50/20"
                    : isInjury
                    ? "!border-amber-400 !ring-2 !ring-amber-300/40 bg-amber-50/20"
                    : "border-slate-300 bg-white"
                }`}
                aria-label={`${group.name}, ${group.horses.length} ngựa`}
              >
                {/* Header của từng chuồng */}
                <div
                  className={`stable-yard-stall__header flex items-center justify-between border-b px-3.5 py-2.5 ${
                    isQuarantine
                      ? "!bg-rose-100/70 !border-rose-300"
                      : isInjury
                      ? "!bg-amber-100/70 !border-amber-300"
                      : "bg-slate-100/80 border-slate-200"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="stable-yard-stall__title text-sm font-black text-slate-900 flex items-center gap-1.5">
                        {isQuarantine && <ShieldAlert size={16} className="text-rose-700" />}
                        {isInjury && <HeartPulse size={16} className="text-amber-700" />}
                        {group.name}
                      </h3>
                      {isQuarantine && (
                        <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-black text-rose-900 border border-rose-300">
                          ☣️ Khu Cách ly Y tế (1 con/box)
                        </span>
                      )}
                      {isInjury && (
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-950 border border-amber-300">
                          🏥 Khu Dưỡng thương (1 con/box)
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500 font-medium">{group.section}</p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold border ${
                      isEmpty
                        ? "bg-white text-slate-500 border-slate-300"
                        : isQuarantine
                        ? "bg-rose-600 text-white border-rose-700"
                        : isInjury
                        ? "bg-amber-600 text-white border-amber-700"
                        : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    {isEmpty ? "0/1 (Đang trống)" : `${group.horses.length} ngựa`}
                  </span>
                </div>

                {/* Nội dung bên trong chuồng */}
                {isEmpty ? (
                  <div className="flex min-h-[240px] flex-col items-center justify-center p-6 text-center">
                    {isQuarantine ? (
                      <div className="max-w-sm space-y-2">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-100 text-rose-700 border border-rose-300">
                          <ShieldAlert size={26} />
                        </div>
                        <p className="text-sm font-black text-rose-950">Chuồng Cách Ly Vô Trùng Đang Trống</p>
                        <p className="text-xs text-rose-800">
                          Khu vực cách ly kiểm dịch 1 con/chuồng. Khi bác sĩ đổi trạng thái ngựa sang &quot;Cách ly&quot;, hệ thống sẽ tự động đưa ngựa vào đây.
                        </p>
                        <span className="inline-block rounded-full bg-rose-100 px-3 py-1 text-[11px] font-bold text-rose-900 border border-rose-300">
                          Sẵn sàng tiếp nhận ca nhiễm
                        </span>
                      </div>
                    ) : isInjury ? (
                      <div className="max-w-sm space-y-2">
                        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700 border border-amber-300">
                          <HeartPulse size={26} />
                        </div>
                        <p className="text-sm font-black text-amber-950">Chuồng Dưỡng Thương Đang Trống</p>
                        <p className="text-xs text-amber-800">
                          Khu vực tĩnh dưỡng riêng 1 con/chuồng cho ngựa chấn thương cơ, xương hoặc khớp cần phục hồi.
                        </p>
                        <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-900 border border-amber-300">
                          Sẵn sàng tiếp nhận ca chấn thương
                        </span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">Chuồng đang trống</div>
                    )}
                  </div>
                ) : (
                  <StablePen horses={group.horses} label={group.name} sceneHeight={sceneHeight} onSelectHorse={selectHorse} />
                )}
              </section>
            );
          })}

          {groups.length === 0 && (
            <p className="rounded-xl bg-slate-50 px-3 py-8 text-center text-xs text-slate-500 xl:col-span-2">
              Chưa có dữ liệu chuồng trại.
            </p>
          )}
        </div>
      </section>

      {/* THẺ HÀNH ĐỘNG Y TẾ TRỰC TIẾP KHI BẤM VÀO NGỰA */}
      {selectedHorse && (
        <aside
          className="fixed inset-x-3 bottom-4 z-[85] max-w-md mx-auto rounded-2xl border-2 border-indigo-600/40 bg-white p-5 shadow-2xl sm:left-auto sm:right-6 sm:w-[420px]"
          role="region"
          aria-label={`Bàn hành động y tế ngựa ${selectedHorse.horse_name}`}
          aria-live="polite"
        >
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                <HorseImage horse={selectedHorse as unknown as Horse} />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-black text-slate-900">{selectedHorse.horse_name}</h4>
                <p className="text-xs text-slate-600 font-medium">
                  {selectedHorse.stable_box
                    ? `Chuồng ${selectedHorse.stable_box.box_code} · Khu ${selectedHorse.stable_box.section}`
                    : "Chưa gán chuồng"}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Đóng"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setSelectedHorse(null)}
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600">Tình trạng sức khỏe:</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${healthDotClass(selectedHorse.current_status)}`}>
              {horseStatusLabels[selectedHorse.current_status] ?? selectedHorse.current_status}
            </span>
          </div>

          {/* CÁC NÚT HÀNH ĐỘNG TRỰC TIẾP DÀNH CHO BÁC SĨ THÚ Y */}
          {actionError && <Notice error>{actionError}</Notice>}
          <div className="mt-4 space-y-2">
            {onGoToExam && (
              <button
                type="button"
                onClick={() => {
                  onGoToExam(selectedHorse.id);
                  setSelectedHorse(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-xs font-black text-white shadow-md shadow-indigo-200 hover:bg-indigo-700 transition"
              >
                <Stethoscope size={16} /> Vào Bàn Khám & Ghi Bệnh Án Con Này
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onSelectHorse(selectedHorse.id);
                  setSelectedHorse(null);
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <FileText size={14} /> Hồ sơ bệnh án
              </button>

              <Link
                href={Routes.horse(selectedHorse.id)}
                className="flex items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Xem chi tiết <ArrowUpRight size={13} />
              </Link>
            </div>

            {/* Các nút điều chuyển nhanh chuồng Cách ly / Chấn thương */}
            {onUpdateStatus && (
              <div className="pt-1 border-t border-slate-100">
                {selectedHorse.current_status !== "Quarantine" && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleRelocate(selectedHorse.id, "Quarantine", "NotReady", "Chuyển chuồng cách ly khẩn cấp do phát hiện triệu chứng")}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 py-2 text-xs font-bold text-rose-800 hover:bg-rose-100 transition mt-1.5"
                  >
                    <ShieldAlert size={14} /> Chuyển sang Chuồng Cách Ly (Q-01..Q-03)
                  </button>
                )}

                {selectedHorse.current_status !== "Injured" && selectedHorse.current_status !== "Quarantine" && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleRelocate(selectedHorse.id, "Injured", "NotReady", "Chuyển chuồng chấn thương để tĩnh dưỡng")}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 transition mt-1.5"
                  >
                    <HeartPulse size={14} /> Chuyển sang Chuồng Chấn Thương (I-01..I-03)
                  </button>
                )}

                {(selectedHorse.current_status === "Quarantine" || selectedHorse.current_status === "Injured") && (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => void handleRelocate(selectedHorse.id, "Healthy", "Ready", "Ngựa đã hồi phục, đưa về lại chuồng gốc")}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition mt-1.5"
                  >
                    <Sparkles size={14} /> Đã Khỏi Bệnh · Trả Về Lại Chuồng Gốc
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}

function StablePen({
  horses,
  label,
  sceneHeight,
  onSelectHorse,
}: {
  horses: StableHorse[];
  label: string;
  sceneHeight: number;
  onSelectHorse: (horse: VetHorse) => void;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const horseNodesRef = useRef(new Map<string, HTMLButtonElement>());
  const laneCount = Math.min(2, Math.max(1, horses.length));

  const registerHorseNode = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) horseNodesRef.current.set(id, node);
    else horseNodesRef.current.delete(id);
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || horses.length === 0) return;

    const agents: HorseAgent[] = horses.map(({ horse }) => ({
      id: horse.id,
      x: 0,
      direction: Math.random() < 0.5 ? -1 : 1,
      motion: "idle",
      remainingMs: 0,
      speed: 0,
    }));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frameId: number | null = null;
    let lastFrameTime = 0;
    let running = false;
    let inViewport = false;

    const setMotion = (agent: HorseAgent, node: HTMLButtonElement) => {
      node.dataset.motion = agent.motion;
      node.dataset.direction = agent.direction < 0 ? "left" : "right";
      const figure = node.querySelector<SVGSVGElement>(".stable-yard-figure");
      if (figure) figure.style.transform = agent.direction < 0 ? "scaleX(-1)" : "scaleX(1)";
    };

    const initialize = () => {
      const maxX = Math.max(0, scene.clientWidth - HORSE_WIDTH - 8);
      const perLane = Math.ceil(horses.length / laneCount);
      agents.forEach((agent, index) => {
        const node = horseNodesRef.current.get(agent.id);
        if (!node) return;
        const laneIndex = Math.floor(index / laneCount);
        const laneWidth = maxX / Math.max(perLane, 1);
        agent.x = Math.min(maxX, laneIndex * laneWidth + randomBetween(0, Math.max(0, laneWidth - 8)));
        agent.direction = Math.random() < 0.5 ? -1 : 1;
        agent.motion = reducedMotion.matches ? "idle" : randomMotion();
        agent.remainingMs = motionDuration(agent.motion);
        agent.speed = motionSpeed(agent.motion);
        node.style.transform = `translate3d(${agent.x}px, 0, 0)`;
        setMotion(agent, node);
      });
    };

    const tick = (now: number) => {
      if (!running) return;
      const deltaFrames = lastFrameTime ? Math.min((now - lastFrameTime) / FRAME_MS, 3) : 1;
      lastFrameTime = now;
      const maxX = Math.max(0, scene.clientWidth - HORSE_WIDTH - 8);
      const elapsedMs = deltaFrames * FRAME_MS;

      agents.forEach((agent) => {
        const node = horseNodesRef.current.get(agent.id);
        if (!node) return;
        agent.x = Math.max(0, Math.min(agent.x, maxX));
        agent.remainingMs -= elapsedMs;
        if (agent.remainingMs <= 0) {
          agent.motion = nextMotion(agent.motion);
          agent.speed = motionSpeed(agent.motion);
          agent.remainingMs = motionDuration(agent.motion);
          if (Math.random() < 0.2) agent.direction = agent.direction === 1 ? -1 : 1;
          setMotion(agent, node);
        }

        if (agent.speed > 0) agent.x += agent.direction * agent.speed * deltaFrames;
        if (agent.x <= 0) {
          agent.x = 0;
          if (agent.direction < 0) {
            agent.direction = 1;
            setMotion(agent, node);
          }
        } else if (agent.x >= maxX) {
          agent.x = maxX;
          if (agent.direction > 0) {
            agent.direction = -1;
            setMotion(agent, node);
          }
        }
        node.style.transform = `translate3d(${agent.x}px, 0, 0)`;
      });
      frameId = window.requestAnimationFrame(tick);
    };

    const pause = () => {
      running = false;
      lastFrameTime = 0;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
    };
    const resume = () => {
      if (running || document.hidden || !inViewport || reducedMotion.matches) return;
      running = true;
      frameId = window.requestAnimationFrame(tick);
    };
    const handleVisibility = () => (document.hidden ? pause() : resume());
    const handleMotionPreference = () => {
      pause();
      initialize();
      resume();
    };
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        inViewport = entry.isIntersecting;
        if (inViewport) resume();
        else pause();
      },
      { rootMargin: "120px" },
    );

    initialize();
    resume();
    visibilityObserver.observe(scene);
    document.addEventListener("visibilitychange", handleVisibility);
    reducedMotion.addEventListener("change", handleMotionPreference);
    return () => {
      pause();
      visibilityObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, [horses, laneCount]);

  return (
    <div ref={sceneRef} className="stable-yard-scene" style={{ height: `${sceneHeight}px` }} aria-label={`Khu vực ${label}`}>
      <div className="stable-yard-architecture" aria-hidden="true">
        <div className="stable-yard-ceiling">
          <span />
          <span />
          <span />
        </div>
        <div className="stable-yard-planks" />
        <div className="stable-yard-window">
          <i />
          <i />
        </div>
        <div className="stable-yard-pillar stable-yard-pillar--left" />
        <div className="stable-yard-pillar stable-yard-pillar--right" />
        <div className="stable-yard-led-lights">
          <i />
          <i />
          <i />
        </div>
        <div className="stable-yard-straw" />
      </div>
      <div className="stable-yard-hay" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      {horses.map((item, index) => {
        const lane = index % laneCount;
        const depth = laneCount === 1 || lane === laneCount - 1 ? "near" : "far";
        const bottom = laneCount === 1 || lane === laneCount - 1 ? 4 : 28;
        const coats: HorseCoat[] = ["bay", "chestnut", "black", "gray", "palomino"];
        return (
          <button
            key={item.horse.id}
            ref={(node) => registerHorseNode(item.horse.id, node)}
            type="button"
            role="button"
            tabIndex={0}
            aria-label={item.horse.horse_name}
            title={`${item.horse.horse_name} - Bấm để vào bàn khám hoặc chuyển chuồng`}
            className="stable-yard-horse group cursor-pointer"
            data-motion="idle"
            data-depth={depth}
            style={{ bottom: `${bottom}px` }}
            onClick={() => onSelectHorse(item.horse)}
          >
            <span className="stable-yard-horse__visual">
              <span className="stable-yard-horse__name-pill group-hover:scale-105 transition shadow-md" title={item.horse.horse_name}>
                <i className={`stable-yard-horse__health-dot ${healthDotClass(item.horse.current_status)}`} aria-hidden="true" />
                <span className="font-bold">{item.horse.horse_name}</span>
                <span className="ml-1 text-[9px] text-indigo-600 bg-indigo-50 px-1 rounded font-bold">🩺</span>
              </span>
              <span className="stable-yard-figure-wrap">
                <HorseIllustration className="stable-yard-figure" coatColor={coats[item.colorIndex % coats.length]} hasStar={item.colorIndex % 3 === 0} socks={item.colorIndex % 2 === 0 ? ["frontLeft", "hindRight"] : []} size={142} />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
