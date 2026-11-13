"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader, type GLTFParser } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinnedModel } from "three/addons/utils/SkeletonUtils.js";
import { enhanceTrackEnvironment, getSkyBackgroundTexture } from "./racetrack-environment";

export type RaceTrackRunner = {
  id: string;
  name: string;
  lane: number;
  progress: number;
  speedKmh: number;
};

const trackModels = {
  grass: "/models/racetrack-grass.glb",
  dirt: "/models/racetrack-dirt.glb",
  synthetic: "/models/racetrack-synthetic.glb",
} as const;

const DETAILED_HORSE_MODEL_PATH = "/models/injury-horse.glb";

type DetailedHorseAsset = {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
};

const trackLoads = new Map<string, Promise<THREE.Group>>();
let detailedHorsePromise: Promise<DetailedHorseAsset> | null = null;
const laneRadii = [4.4, 5.225, 6.025, 6.825, 7.6765];

const LANE_COAT_TINTS = [
  { body: "#ffffff", saddle: "#c89b3c", badgeBg: "#1e3a8a" }, // Làn 1: Nâu đỏ thuần chủng (Bay)
  { body: "#ffe2c8", saddle: "#059669", badgeBg: "#065f46" }, // Làn 2: Hồng mã ánh vàng (Chestnut)
  { body: "#d4b29c", saddle: "#e11d48", badgeBg: "#9f1239" }, // Làn 3: Nâu sẫm (Dark Bay)
  { body: "#fff1dc", saddle: "#7c3aed", badgeBg: "#5b21b6" }, // Làn 4: Hoàng kim (Palomino)
  { body: "#b59886", saddle: "#ea580c", badgeBg: "#9a3412" }, // Làn 5: Hắc tía (Sable/Seal Brown)
] as const;

function createSpecGlossLoader(): GLTFLoader {
  const loader = new GLTFLoader();
  loader.register((parser: GLTFParser) => ({
    name: "KHR_materials_pbrSpecularGlossiness",
    extendMaterialParams(materialIndex: number, materialParams: Record<string, unknown>) {
      const json = parser.json as {
        materials?: Array<{
          name?: string;
          extensions?: {
            KHR_materials_pbrSpecularGlossiness?: {
              diffuseFactor?: number[];
              diffuseTexture?: { index: number; texCoord?: number; extensions?: unknown };
              glossinessFactor?: number;
            };
          };
        }>;
      };
      const matDef = json.materials?.[materialIndex];
      const ext = matDef?.extensions?.KHR_materials_pbrSpecularGlossiness;
      if (!ext) return Promise.resolve();
      const pending: Promise<unknown>[] = [];
      if (Array.isArray(ext.diffuseFactor)) {
        materialParams.color = new THREE.Color(ext.diffuseFactor[0] ?? 1, ext.diffuseFactor[1] ?? 1, ext.diffuseFactor[2] ?? 1);
        materialParams.opacity = ext.diffuseFactor[3] ?? 1;
      }
      const isEye = /eye/i.test(matDef?.name ?? "");
      const isHair = /hair|mane/i.test(matDef?.name ?? "");
      const isSaddle = /saddle/i.test(matDef?.name ?? "");
      materialParams.metalness = isSaddle ? 0.08 : 0.03;
      materialParams.roughness = isEye
        ? 0.14
        : isHair
        ? 0.78
        : isSaddle
        ? 0.52
        : typeof ext.glossinessFactor === "number" && ext.glossinessFactor > 0
        ? Math.max(0.2, 1 - ext.glossinessFactor)
        : 0.58;
      if (ext.diffuseTexture !== undefined) {
        pending.push(parser.assignTexture(materialParams, "map", ext.diffuseTexture, THREE.SRGBColorSpace));
      }
      return Promise.all(pending);
    },
  }));
  return loader;
}

function modelForSurface(surface?: string | null) {
  const value = surface?.trim().toLowerCase() ?? "";
  if (value.includes("grass") || value.includes("turf") || value.includes("cỏ") || value.includes("co")) return trackModels.grass;
  if (value.includes("dirt") || value.includes("sand") || value.includes("soil") || value.includes("đất") || value.includes("dat")) return trackModels.dirt;
  return trackModels.synthetic;
}

function loadTrack(path: string) {
  let load = trackLoads.get(path);
  if (!load) {
    load = createSpecGlossLoader().loadAsync(path).then((gltf) => gltf.scene).catch((error: unknown) => {
      trackLoads.delete(path);
      throw error;
    });
    trackLoads.set(path, load);
  }
  return load;
}

function loadDetailedHorse(): Promise<DetailedHorseAsset> {
  if (!detailedHorsePromise) {
    detailedHorsePromise = createSpecGlossLoader()
      .loadAsync(DETAILED_HORSE_MODEL_PATH)
      .then((gltf) => ({
        scene: gltf.scene,
        animations: gltf.animations ?? [],
      }))
      .catch((error: unknown) => {
        detailedHorsePromise = null;
        throw error;
      });
  }
  return detailedHorsePromise;
}

function drawBadgeCanvas(canvas: HTMLCanvasElement, lane: number, horseName: string, bgHex: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(15, 23, 42, 0.86)";
  ctx.beginPath();
  ctx.roundRect(6, 8, 244, 48, 24);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.stroke();

  ctx.fillStyle = bgHex;
  ctx.beginPath();
  ctx.arc(32, 32, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(lane), 32, 33);

  ctx.textAlign = "left";
  ctx.font = "800 20px system-ui, -apple-system, sans-serif";
  const label = (horseName || `Làn ${lane}`).slice(0, 14);
  ctx.fillText(label, 58, 33);
}

function createLaneBadgeSprite(lane: number, horseName: string, bgHex: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  drawBadgeCanvas(canvas, lane, horseName, bgHex);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.42, 0.36, 1);
  sprite.position.set(0, 1.16, -0.25);
  sprite.renderOrder = 10;
  sprite.name = `LaneBadge_${lane}`;
  sprite.userData = { canvas, texture, lane, bgHex };
  return sprite;
}

function updateLaneBadgeSprite(sprite: THREE.Sprite, horseName: string) {
  const { canvas, texture, lane, bgHex } = sprite.userData as {
    canvas?: HTMLCanvasElement;
    texture?: THREE.CanvasTexture;
    lane?: number;
    bgHex?: string;
  };
  if (!canvas || !texture || !lane || !bgHex) return;
  drawBadgeCanvas(canvas, lane, horseName, bgHex);
  texture.needsUpdate = true;
}

function createContactShadow(): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, "rgba(15, 23, 42, 0.42)");
    grad.addColorStop(0.6, "rgba(15, 23, 42, 0.18)");
    grad.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const texture = new THREE.CanvasTexture(canvas);
  const geometry = new THREE.PlaneGeometry(0.95, 2.15);
  geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "HorseContactShadow";
  return mesh;
}

function optimizeRepeatedMeshes(scene: THREE.Group, excluded: Set<THREE.Object3D>) {
  scene.updateMatrixWorld(true);
  const repeated = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[]; meshes: THREE.Mesh[] }>();
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || excluded.has(node)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    if (materials.some((material) => material.transparent || material.opacity < 0.999 || material.blending !== THREE.NormalBlending)) return;
    const key = `${node.geometry.uuid}|${materials.map((material) => material.uuid).join(",")}`;
    const entry = repeated.get(key) ?? { geometry: node.geometry, material: node.material, meshes: [] as THREE.Mesh[] };
    entry.meshes.push(node);
    repeated.set(key, entry);
  });

  const sceneInverse = scene.matrixWorld.clone().invert();
  repeated.forEach(({ geometry, material, meshes }) => {
    if (meshes.length < 2) return;
    const instances = new THREE.InstancedMesh(geometry, material, meshes.length);
    instances.name = `Optimized ${meshes[0].name || "track mesh"}`;
    instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    meshes.forEach((mesh, index) => {
      const localMatrix = new THREE.Matrix4().multiplyMatrices(sceneInverse, mesh.matrixWorld);
      instances.setMatrixAt(index, localMatrix);
      mesh.visible = false;
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.computeBoundingSphere();
    scene.add(instances);
  });
}

function lanePosition(progress: number, lane: number, groundY: number, finishLineX: number) {
  const radius = laneRadii[Math.min(laneRadii.length - 1, Math.max(0, Math.round(lane) - 1))];
  const totalLength = 40 + Math.PI * 2 * radius;
  let distance = Math.max(0, Math.min(1, progress)) * totalLength;
  const firstStraightLength = 10 - finishLineX;
  const finalStraightLength = 10 + finishLineX;

  if (distance < firstStraightLength) return { x: finishLineX + distance, y: groundY, z: radius, heading: Math.PI / 2 };
  distance -= firstStraightLength;

  const curveLength = Math.PI * radius;
  if (distance < curveLength) {
    const angle = Math.PI / 2 - distance / radius;
    return {
      x: 10 + radius * Math.cos(angle), y: groundY, z: radius * Math.sin(angle),
      heading: Math.atan2(Math.sin(angle), -Math.cos(angle)),
    };
  }
  distance -= curveLength;

  if (distance < 20) return { x: 10 - distance, y: groundY, z: -radius, heading: -Math.PI / 2 };
  distance -= 20;

  if (distance < curveLength) {
    const angle = -Math.PI / 2 - distance / radius;
    return {
      x: -10 + radius * Math.cos(angle), y: groundY, z: radius * Math.sin(angle),
      heading: Math.atan2(Math.sin(angle), -Math.cos(angle)),
    };
  }
  distance -= curveLength;

  return { x: -10 + Math.min(finalStraightLength, distance), y: groundY, z: radius, heading: Math.PI / 2 };
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

export default function RaceTrackScene3D({
  surface,
  runners,
  targetDistanceMeters,
  isRunning,
  runStartTime = null,
  speedMultiplier = 1,
}: {
  surface?: string | null;
  runners: RaceTrackRunner[];
  targetDistanceMeters: number;
  isRunning: boolean;
  runStartTime?: number | null;
  speedMultiplier?: number;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const runnersRef = useRef(runners);
  const runnerUpdateTimesRef = useRef(new Map<string, { progress: number; speedKmh: number; at: number }>());
  const displayedProgressRef = useRef(new Map<string, { progress: number; sourceProgress: number; at: number }>());
  const previousRunStartRef = useRef(runStartTime);
  const runningRef = useRef(isRunning);
  const runStartRef = useRef(runStartTime);
  const speedMultiplierRef = useRef(speedMultiplier);
  const distanceRef = useRef(targetDistanceMeters);
  const drawRef = useRef<() => void>(() => {});
  const startLoopRef = useRef<() => void>(() => {});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const modelPath = modelForSurface(surface);

  runnersRef.current = runners;
  runningRef.current = isRunning;
  runStartRef.current = runStartTime;
  speedMultiplierRef.current = Math.max(0.25, speedMultiplier);
  distanceRef.current = Math.max(1, targetDistanceMeters);
  const updateAt = Date.now();
  const nextIds = new Set(runners.map((runner) => runner.id));
  runnerUpdateTimesRef.current.forEach((_, id) => { if (!nextIds.has(id)) runnerUpdateTimesRef.current.delete(id); });
  displayedProgressRef.current.forEach((_, id) => { if (!nextIds.has(id)) displayedProgressRef.current.delete(id); });
  if (previousRunStartRef.current !== runStartTime) {
    displayedProgressRef.current.clear();
    previousRunStartRef.current = runStartTime;
  }
  runners.forEach((runner) => {
    const previous = runnerUpdateTimesRef.current.get(runner.id);
    if (!previous || previous.progress !== runner.progress || previous.speedKmh !== runner.speedKmh) {
      runnerUpdateTimesRef.current.set(runner.id, { progress: runner.progress, speedKmh: runner.speedKmh, at: updateAt });
    }
    const displayed = displayedProgressRef.current.get(runner.id);
    if (displayed && runner.progress + 0.002 < displayed.sourceProgress) displayedProgressRef.current.delete(runner.id);
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    setLoading(true);
    setLoadError("");
    let disposed = false;
    let frameId = 0;
    let rendererWidth = 0;
    let rendererHeight = 0;
    let renderer: THREE.WebGLRenderer | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    type RacerController = {
      group: THREE.Group;
      horseRoot: THREE.Object3D;
      mixer: THREE.AnimationMixer | null;
      idleAction: THREE.AnimationAction | null;
      walkAction: THREE.AnimationAction | null;
      badgeSprite: THREE.Sprite;
      lastBadgeLabel: string;
      activeMode: "idle" | "walk";
    };

    const scene = new THREE.Scene();
    scene.background = getSkyBackgroundTexture();
    scene.fog = new THREE.FogExp2("#d8e8d4", 0.0045);
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 250);
    const racers: RacerController[] = [];
    let baseHorseY = 0.95;
    let finishLineX = 7.31;
    let worldBoundsSize = new THREE.Vector3(60, 4, 40);
    let lastAnimTick = performance.now();

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setLoadError("WebGL no longer available in this browser.");
      setLoading(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = "race-track-scene__canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7c65, 1.05));
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const sunlight = new THREE.DirectionalLight(0xfff4e0, 2.1);
    sunlight.position.set(-18, 32, 24);
    scene.add(sunlight);
    const fillLight = new THREE.DirectionalLight(0xe0ecff, 0.65);
    fillLight.position.set(18, 16, -20);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xfff8eb, 0.45);
    rimLight.position.set(0, 14, -28);
    scene.add(rimLight);

    function updateCamera() {
      if (!mount || !renderer || !controls) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (width !== rendererWidth || height !== rendererHeight) {
        renderer.setSize(width, height, false);
        rendererWidth = width;
        rendererHeight = height;
      }
    }

    function updateRacers(now: number, dtSeconds: number) {
      const byLane = new Map(runnersRef.current.slice(0, 5).map((runner) => [runner.lane, runner]));
      racers.forEach((controller, index) => {
        const { group: racer, horseRoot, mixer, idleAction, walkAction, badgeSprite } = controller;
        const lane = index + 1;
        const runner = byLane.get(lane);
        if (!runner) {
          racer.visible = runnersRef.current.length === 0 && index === 2;
          if (racer.visible) {
            const pose = lanePosition(0, 3, baseHorseY, finishLineX);
            racer.position.set(pose.x, pose.y, pose.z);
            racer.rotation.set(0, pose.heading, 0);
            horseRoot.position.y = -baseHorseY;
            horseRoot.rotation.x = 0;
            if (controller.activeMode !== "idle" && idleAction) {
              idleAction.reset().fadeIn(0.25).play();
              walkAction?.fadeOut(0.25);
              controller.activeMode = "idle";
            }
            if (mixer && dtSeconds > 0) mixer.update(dtSeconds);
          }
          return;
        }
        racer.visible = true;
        const nextLabel = (runner.name || `Làn ${lane}`).slice(0, 14);
        if (controller.lastBadgeLabel !== nextLabel) {
          updateLaneBadgeSprite(badgeSprite, nextLabel);
          controller.lastBadgeLabel = nextLabel;
        }

        const snapshot = runnerUpdateTimesRef.current.get(runner.id);
        let targetProgress = clampProgress(runner.progress);
        if (runningRef.current && runner.speedKmh > 0) {
          const startAt = runStartRef.current ?? snapshot?.at ?? now;
          const elapsedSeconds = Math.max(0, (now - startAt) / 1000) * speedMultiplierRef.current;
          targetProgress = clampProgress(targetProgress + (runner.speedKmh / 3.6) * elapsedSeconds / distanceRef.current);
        }
        let progress = targetProgress;
        const previousDisplay = displayedProgressRef.current.get(runner.id);
        if (previousDisplay && runningRef.current) {
          const elapsed = Math.max(0, (now - previousDisplay.at) / 1000);
          const smoothing = 1 - Math.exp(-elapsed / 0.12);
          progress = Math.max(previousDisplay.progress, previousDisplay.progress + (targetProgress - previousDisplay.progress) * smoothing);
        }
        displayedProgressRef.current.set(runner.id, { progress, sourceProgress: runner.progress, at: now });
        const pose = lanePosition(progress, lane, baseHorseY, finishLineX);

        const isActivelyRunning = runningRef.current && runner.speedKmh > 0 && progress < 0.999;
        if (isActivelyRunning) {
          if (controller.activeMode !== "walk" && walkAction) {
            walkAction.reset().fadeIn(0.18).play();
            idleAction?.fadeOut(0.18);
            controller.activeMode = "walk";
          }
          if (walkAction) {
            walkAction.timeScale = THREE.MathUtils.clamp(
              (runner.speedKmh / 14.5) * Math.sqrt(speedMultiplierRef.current),
              1.85,
              4.2,
            );
          }
          const stridePhase = now * 0.015 * Math.sqrt(speedMultiplierRef.current) + lane * 1.25;
          const bob = Math.abs(Math.sin(stridePhase)) * 0.052;
          const pitch = Math.cos(stridePhase) * 0.042;
          racer.position.set(pose.x, pose.y, pose.z);
          racer.rotation.set(0, pose.heading, Math.sin(stridePhase * 0.5) * 0.012);
          horseRoot.position.y = -baseHorseY + bob;
          horseRoot.rotation.x = pitch;
        } else {
          if (controller.activeMode !== "idle" && idleAction) {
            idleAction.reset().fadeIn(0.25).play();
            walkAction?.fadeOut(0.25);
            controller.activeMode = "idle";
          }
          if (idleAction) {
            idleAction.timeScale = 0.92 + (lane % 3) * 0.07;
          }
          racer.position.set(pose.x, pose.y, pose.z);
          racer.rotation.set(0, pose.heading, 0);
          horseRoot.position.y = -baseHorseY;
          horseRoot.rotation.x = 0;
        }

        if (mixer && dtSeconds > 0) {
          mixer.update(dtSeconds);
        }
      });
    }

    function draw() {
      if (disposed || !renderer || !controls) return;
      const perfNow = performance.now();
      const dtSeconds = Math.min(0.1, Math.max(0, (perfNow - lastAnimTick) / 1000));
      lastAnimTick = perfNow;
      updateCamera();
      updateRacers(Date.now(), dtSeconds);
      renderer.render(scene, camera);
    }
    drawRef.current = () => draw();

    function animate() {
      if (disposed) {
        frameId = 0;
        return;
      }
      frameId = window.requestAnimationFrame(animate);
      draw();
    }
    startLoopRef.current = () => {
      if (!disposed && !frameId) {
        lastAnimTick = performance.now();
        frameId = window.requestAnimationFrame(animate);
      }
    };

    void Promise.all([
      loadTrack(modelPath),
      loadDetailedHorse().catch(() => null),
    ]).then(([source, detailedHorseAsset]) => {
      if (disposed || !renderer) return;
      const track = source.clone(true);
      track.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry = node.geometry.clone();
          node.material = Array.isArray(node.material)
            ? node.material.map((material) => material.clone())
            : node.material.clone();
        }
      });
      track.updateMatrixWorld(true);
      const finishMarker = track.getObjectByName("FINISH_checker_0_00");
      if (finishMarker) finishLineX = finishMarker.getWorldPosition(new THREE.Vector3()).x;
      const heroTemplate = track.getObjectByName("HERO_racehorse") as THREE.Group | undefined;
      if (!heroTemplate) throw new Error("This track model does not contain HERO_racehorse.");
      baseHorseY = heroTemplate.position.y;
      const horseScale = heroTemplate.scale.clone();
      const horseParts = new Set<THREE.Object3D>();
      heroTemplate.traverse((part) => horseParts.add(part));
      heroTemplate.visible = false;

      const worldBounds = new THREE.Box3().setFromObject(track);
      worldBoundsSize = worldBounds.getSize(new THREE.Vector3());
      const worldCenter = worldBounds.getCenter(new THREE.Vector3());
      enhanceTrackEnvironment(track, surface, finishLineX, horseParts);
      optimizeRepeatedMeshes(track, horseParts);

      const idleClip = detailedHorseAsset?.animations.find((clip) => /idle/i.test(clip.name)) ?? detailedHorseAsset?.animations[0] ?? null;
      const walkClip = detailedHorseAsset?.animations.find((clip) => /walk|run|gallop/i.test(clip.name)) ?? detailedHorseAsset?.animations[1] ?? idleClip;
      const initialByLane = new Map(runnersRef.current.slice(0, 5).map((runner) => [runner.lane, runner]));

      for (let lane = 1; lane <= 5; lane += 1) {
        const tint = LANE_COAT_TINTS[(lane - 1) % LANE_COAT_TINTS.length];
        const racer = new THREE.Group();
        racer.name = `Racing horse in lane ${lane}`;
        racer.visible = false;

        const horsePivot = new THREE.Group();
        horsePivot.position.set(0, -baseHorseY, 0);
        let mixer: THREE.AnimationMixer | null = null;
        let idleAction: THREE.AnimationAction | null = null;
        let walkAction: THREE.AnimationAction | null = null;

        if (detailedHorseAsset) {
          const clonedHorse = cloneSkinnedModel(detailedHorseAsset.scene) as THREE.Group;
          clonedHorse.scale.multiplyScalar(0.86);
          // Align front hooves right onto the checkered starting line (z = +0.35) and rear hooves behind it (z = -1.02)
          clonedHorse.position.set(0, 0, -1.65);
          clonedHorse.traverse((node) => {
            if (node instanceof THREE.SkinnedMesh || node instanceof THREE.Mesh) {
              node.frustumCulled = false;
              const cloneAndTint = (mat: THREE.Material) => {
                const clonedMat = mat.clone() as THREE.MeshStandardMaterial;
                const matName = clonedMat.name || "";
                if (/body/i.test(matName) && clonedMat.color) {
                  clonedMat.color.multiply(new THREE.Color(tint.body));
                  clonedMat.roughness = 0.52;
                } else if (/hair|mane/i.test(matName)) {
                  clonedMat.transparent = true;
                  clonedMat.alphaTest = 0.22;
                  clonedMat.side = THREE.DoubleSide;
                } else if (/saddle2/i.test(matName) && clonedMat.color) {
                  clonedMat.color.lerp(new THREE.Color(tint.saddle), 0.55);
                } else if (/eye/i.test(matName)) {
                  clonedMat.roughness = 0.12;
                }
                return clonedMat;
              };
              node.material = Array.isArray(node.material)
                ? node.material.map(cloneAndTint)
                : cloneAndTint(node.material);
            }
          });
          horsePivot.add(clonedHorse);
          mixer = new THREE.AnimationMixer(clonedHorse);
          if (idleClip) {
            idleAction = mixer.clipAction(idleClip);
            idleAction.play();
          }
          if (walkClip) {
            walkAction = mixer.clipAction(walkClip);
          }
          mixer.update(lane * 0.65);
        } else {
          const fallbackHorse = heroTemplate.clone(true);
          fallbackHorse.visible = true;
          fallbackHorse.position.set(0, 0, 0);
          fallbackHorse.scale.copy(horseScale);
          horsePivot.add(fallbackHorse);
        }

        const shadow = createContactShadow();
        shadow.position.set(0, -baseHorseY + 0.015, -0.32);
        racer.add(shadow);

        const initialName = (initialByLane.get(lane)?.name || `Làn ${lane}`).slice(0, 14);
        const badgeSprite = createLaneBadgeSprite(lane, initialName, tint.badgeBg);
        racer.add(badgeSprite);
        racer.add(horsePivot);

        racers.push({
          group: racer,
          horseRoot: horsePivot,
          mixer,
          idleAction,
          walkAction,
          badgeSprite,
          lastBadgeLabel: initialName,
          activeMode: "idle",
        });
        track.add(racer);
      }

      scene.add(track);
      const target = new THREE.Vector3(worldCenter.x, Math.max(0.45, worldCenter.y * 0.65), worldCenter.z);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target);
      controls.enableDamping = false;
      controls.enablePan = false;
      controls.minPolarAngle = 0.2;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.minDistance = 14;
      controls.maxDistance = 120;
      controls.addEventListener("change", () => draw());

      resizeObserver = new ResizeObserver(() => draw());
      resizeObserver.observe(mount);
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const aspect = Math.max(1, mount.clientWidth / Math.max(1, mount.clientHeight));
      const verticalExtent = worldBoundsSize.z * 0.54 + worldBoundsSize.y * 0.84 + 2;
      const horizontalExtent = worldBoundsSize.x + 3;
      const initialDistance = Math.max(
        horizontalExtent / (2 * Math.tan(verticalFov / 2) * aspect),
        verticalExtent / (2 * Math.tan(verticalFov / 2)),
      ) * 1.25;
      camera.position.set(target.x, target.y + initialDistance * 0.84, target.z + initialDistance * 0.54);
      controls.update();
      draw();
      setLoading(false);
      startLoopRef.current();

    }).catch((reason: unknown) => {
      if (!disposed) {
        setLoadError(reason instanceof Error ? reason.message : "Không tải được mô hình sân đua 3D.");
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      controls?.dispose();
      scene.traverse((node) => {
        if (node instanceof THREE.InstancedMesh) {
          node.dispose();
        }
        if (node instanceof THREE.Mesh) {
          node.geometry?.dispose();
          if (Array.isArray(node.material)) {
            node.material.forEach((material) => material.dispose());
          } else {
            node.material?.dispose();
          }
        }
      });
      renderer?.dispose();
      renderer?.domElement.remove();
      drawRef.current = () => {};
      startLoopRef.current = () => {};
    };
  }, [modelPath]);

  useEffect(() => {
    if (isRunning) startLoopRef.current();
    else drawRef.current();
  }, [isRunning, runners, targetDistanceMeters, runStartTime]);

  return <div ref={mountRef} className="race-track-scene" role="img" aria-label="Mô hình sân đua ngựa 3D có năm làn">
    {loading && <div className="race-track-scene__status">Đang tải sân đua 3D…</div>}
    {loadError && <div className="race-track-scene__status race-track-scene__status--error" role="alert">Không tải được sân đua 3D: {loadError}</div>}
  </div>;
}
