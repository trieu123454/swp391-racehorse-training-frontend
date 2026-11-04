"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { Routes } from "@/routes/Routes";
import type { VetHorse } from "@/api/veterinarian/api";

type MotionState = "walk" | "trot" | "graze" | "idle";
type HorseAgent = { id: string; x: number; direction: -1 | 1; motion: MotionState; remainingMs: number; speed: number };
type HorseColor = { coat: string; mane: string; shade: string };
type StableHorse = { horse: VetHorse; colorIndex: number };
type StableGroup = { id: string; name: string; section: string; horses: StableHorse[] };

const HORSE_WIDTH = 150;
const FRAME_MS = 1000 / 60;
const horseColors: HorseColor[] = [
  { coat: "#8b5838", mane: "#40271b", shade: "#70472f" }, // nâu
  { coat: "#bd875d", mane: "#805235", shade: "#9c6848" }, // nâu sáng
  { coat: "#4e3024", mane: "#21140e", shade: "#382219" }, // nâu đậm
  { coat: "#c8cbce", mane: "#666b70", shade: "#9da2a6" }, // xám nhạt
  { coat: "#292827", mane: "#151414", shade: "#201e1d" }, // đen
  { coat: "#98442e", mane: "#53271c", shade: "#753321" }, // nâu đỏ
];

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
  if (status === "Healthy") return "bg-emerald-500";
  if (status === "Monitoring" || status === "Under Observation") return "bg-amber-500";
  return "bg-rose-600";
}

const horseStatusLabels: Record<string, string> = {
  Healthy: "Khỏe mạnh",
  Injured: "Chấn thương",
  Quarantine: "Cách ly",
  Monitoring: "Đang theo dõi",
  "Under Observation": "Cần theo dõi",
  Sick: "Đang bệnh",
};

export default function HorseStableYard({ horses, onSelectHorse }: { horses: VetHorse[]; onSelectHorse: (id: string) => void }) {
  const selectedTimerRef = useRef<number | null>(null);
  const [selectedHorse, setSelectedHorse] = useState<VetHorse | null>(null);

  const groups = useMemo(() => {
    const byStable = new Map<string, StableGroup>();
    horses.forEach((horse, colorIndex) => {
      const box = horse.stable_box;
      const id = box?.id ?? "unassigned";
      const existing = byStable.get(id);
      if (existing) {
        existing.horses.push({ horse, colorIndex });
      } else {
        byStable.set(id, {
          id,
          name: box?.box_code ? `Chuồng ${box.box_code}` : "Chưa xếp chuồng",
          section: box?.section ? `Khu ${box.section}` : "Chưa có khu",
          horses: [{ horse, colorIndex }],
        });
      }
    });
    return [...byStable.values()].sort((left, right) => {
      if (left.id === "unassigned") return 1;
      if (right.id === "unassigned") return -1;
      return left.section.localeCompare(right.section, "vi") || left.name.localeCompare(right.name, "vi");
    });
  }, [horses]);
  const sceneHeight = Math.max(260, ...groups.map((group) => sceneHeightForHorseCount(group.horses.length)));

  const selectHorse = useCallback((horse: VetHorse) => {
    onSelectHorse(horse.id);
    setSelectedHorse(horse);
    if (selectedTimerRef.current !== null) window.clearTimeout(selectedTimerRef.current);
    selectedTimerRef.current = window.setTimeout(() => {
      setSelectedHorse((current) => current?.id === horse.id ? null : current);
      selectedTimerRef.current = null;
    }, 3000);
  }, [onSelectHorse]);

  useEffect(() => () => {
    if (selectedTimerRef.current !== null) window.clearTimeout(selectedTimerRef.current);
  }, []);

  return <>
    <section className="overflow-hidden rounded-lg border border-equine-line bg-white shadow-sm" aria-label="Khu chuồng ngựa">
      <div className="flex items-center justify-between gap-3 border-b border-equine-line px-4 py-3">
        <div>
          <h2 className="font-sans text-sm font-semibold text-equine-navy">Khu chuồng ngựa</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">{horses.length} ngựa · {groups.length} chuồng</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-800">Tự do di chuyển</span>
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-2">
        {groups.map((group) => <section key={group.id} className="stable-yard-stall" aria-label={`${group.name}, ${group.horses.length} ngựa`}>
          <div className="stable-yard-stall__header">
            <div className="min-w-0">
              <h3 className="stable-yard-stall__title"><i aria-hidden="true" />{group.name}</h3>
              <p className="mt-0.5 text-[10px] text-slate-500">{group.section}</p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{group.horses.length} ngựa</span>
          </div>
          <StablePen horses={group.horses} label={group.name} sceneHeight={sceneHeight} onSelectHorse={selectHorse} />
        </section>)}
        {groups.length === 0 && <p className="rounded-md bg-equine-mist px-3 py-4 text-center text-xs text-slate-500 xl:col-span-2">Chưa có ngựa trong chuồng.</p>}
      </div>
      <p className="px-4 pb-3 text-xs text-slate-500">Ngựa đi bộ, chạy nước kiệu ngắn hoặc cúi đầu ăn cỏ. Hoạt ảnh dừng khi tab ẩn.</p>
    </section>

    {selectedHorse && <aside className="fixed inset-x-3 bottom-3 z-[75] rounded-lg border border-equine-line bg-white p-4 shadow-xl sm:left-auto sm:right-5 sm:w-[340px]" role="region" aria-label={`Thông tin ngựa ${selectedHorse.horse_name}`} aria-live="polite">
      <button type="button" aria-label="Đóng thông tin ngựa" className="absolute right-2 top-2 rounded p-1 text-slate-500 hover:bg-slate-100" onClick={() => setSelectedHorse(null)}><X size={15} /></button>
      <p className="pr-7 font-semibold text-equine-navy">{selectedHorse.horse_name}</p>
      <p className="mt-1 text-sm text-slate-600">Chuồng {selectedHorse.stable_box?.box_code ?? "Chưa xếp"} · {horseStatusLabels[selectedHorse.current_status] ?? selectedHorse.current_status}</p>
      <Link href={Routes.horse(selectedHorse.id)} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-equine-navy underline underline-offset-2">Xem hồ sơ <ArrowUpRight size={14} /></Link>
    </aside>}
  </>;
}

function StablePen({ horses, label, sceneHeight, onSelectHorse }: { horses: StableHorse[]; label: string; sceneHeight: number; onSelectHorse: (horse: VetHorse) => void }) {
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
    const handleVisibility = () => document.hidden ? pause() : resume();
    const handleMotionPreference = () => {
      pause();
      initialize();
      resume();
    };
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      if (inViewport) resume();
      else pause();
    }, { rootMargin: "120px" });

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

  return <div ref={sceneRef} className="stable-yard-scene" style={{ height: `${sceneHeight}px` }} aria-label={`Khu vực ${label}`}>
    <div className="stable-yard-architecture" aria-hidden="true">
      <div className="stable-yard-ceiling"><span /><span /><span /></div>
      <div className="stable-yard-planks" />
      <div className="stable-yard-window"><i /><i /></div>
      <div className="stable-yard-pillar stable-yard-pillar--left" />
      <div className="stable-yard-pillar stable-yard-pillar--right" />
      <div className="stable-yard-led-lights"><i /><i /><i /></div>
      <div className="stable-yard-straw" />
    </div>
    <div className="stable-yard-hay" aria-hidden="true"><span /><span /><span /></div>
    {horses.map((item, index) => {
      const lane = index % laneCount;
      const depth = laneCount === 1 || lane === laneCount - 1 ? "near" : "far";
      const bottom = laneCount === 1 || lane === laneCount - 1 ? 4 : 28;
      const color = horseColors[item.colorIndex % horseColors.length];
      return <button
        key={item.horse.id}
        ref={(node) => registerHorseNode(item.horse.id, node)}
        type="button"
        role="button"
        tabIndex={0}
        aria-label={item.horse.horse_name}
        title={item.horse.horse_name}
        className="stable-yard-horse"
        data-motion="idle"
        data-depth={depth}
        style={{ bottom: `${bottom}px` }}
        onClick={() => onSelectHorse(item.horse)}
      >
        <span className="stable-yard-horse__visual">
          <span className="stable-yard-horse__name-pill" title={item.horse.horse_name}>
            <i className={`stable-yard-horse__health-dot ${healthDotClass(item.horse.current_status)}`} aria-hidden="true" />
            <span>{item.horse.horse_name}</span>
          </span>
          <span className="stable-yard-figure-wrap"><HorseFigure colors={color} /></span>
        </span>
      </button>;
    })}
  </div>;
}

function HorseFigure({ colors }: { colors: HorseColor }) {
  return <svg viewBox="0 0 180 120" className="stable-yard-figure" aria-hidden="true">
    <g className="stable-yard-horse__tail">
      <path d="M47 53 C37 55 35 63 28 67 C24 70 20 71 16 69 C22 77 33 73 39 68 C43 64 47 62 51 61" fill={colors.mane} />
      <path d="M30 68 Q24 77 19 79 M35 66 Q31 75 28 78" fill="none" stroke={colors.mane} strokeWidth="2.5" strokeLinecap="round" />
    </g>
    <g className="stable-yard-horse__leg stable-yard-horse__leg--back-far">
      <path d="M57 65 C54 74 55 82 51 91 L47 103 L54 104 L62 93 L67 70Z" fill={colors.shade} stroke="#513322" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M47 101 L54 101 L58 106 L45 106Z" fill="#3d2a20" />
    </g>
    <g className="stable-yard-horse__leg stable-yard-horse__leg--front-far">
      <path d="M105 63 C108 73 106 82 109 92 L106 102 L113 104 L119 93 L116 79 L117 65Z" fill={colors.shade} stroke="#513322" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M106 101 L113 101 L117 106 L104 106Z" fill="#3d2a20" />
    </g>
    <g className="stable-yard-horse__body">
      <path d="M44 50 C48 37 63 31 81 32 C94 31 108 36 119 42 C127 47 130 57 125 65 C121 73 108 76 91 75 L66 71 C52 69 42 62 44 50Z" fill={colors.coat} stroke="#553622" strokeWidth="2.3" strokeLinejoin="round" />
      <path d="M106 46 C112 37 116 27 121 20 C126 13 135 13 143 20 L148 27 C145 32 139 35 134 39 L126 60 L116 59Z" fill={colors.coat} stroke="#553622" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M119 20 C121 12 128 8 132 10 C130 14 132 15 137 13 C141 12 146 17 147 21 C140 19 137 24 134 29 C131 36 127 42 121 46 L115 42 C119 34 121 27 119 20Z" fill={colors.mane} />
      <path d="M121 21 Q116 29 115 35 M126 17 Q122 27 120 33" fill="none" stroke={colors.shade} strokeWidth="2" strokeLinecap="round" />
      <g className="stable-yard-horse__head">
        <path d="M137 21 C142 15 150 17 155 23 C159 28 162 33 169 35 L174 38 L170 42 C164 44 158 41 153 39 L144 37 L137 31Z" fill={colors.coat} stroke="#553622" strokeWidth="2" strokeLinejoin="round" />
        <path d="M142 20 L142 10 Q147 13 148 20 M149 20 L154 12 Q158 17 156 24" fill={colors.shade} stroke="#553622" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M160 34 Q167 35 173 38 L170 41 Q164 42 159 38Z" fill={colors.shade} />
        <circle cx="153" cy="26" r="1.8" fill="#211711" />
        <circle cx="169" cy="37" r="1.2" fill="#40271b" />
        <path d="M158 39 Q164 42 169 40" fill="none" stroke="#553622" strokeWidth="1.2" strokeLinecap="round" />
      </g>
      <path d="M56 43 Q77 35 98 41" fill="none" stroke={colors.shade} strokeWidth="2" strokeLinecap="round" opacity=".75" />
    </g>
    <g className="stable-yard-horse__leg stable-yard-horse__leg--back-near">
      <path d="M67 66 C68 75 63 83 65 93 L64 102 L71 104 L78 96 L75 82 L78 68Z" fill={colors.coat} stroke="#553622" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M64 101 L71 101 L75 106 L62 106Z" fill="#3d2a20" />
    </g>
    <g className="stable-yard-horse__leg stable-yard-horse__leg--front-near">
      <path d="M116 64 C116 74 121 82 118 93 L120 102 L127 104 L132 99 L127 85 L126 65Z" fill={colors.coat} stroke="#553622" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M120 101 L127 101 L131 106 L118 106Z" fill="#3d2a20" />
    </g>
  </svg>;
}
