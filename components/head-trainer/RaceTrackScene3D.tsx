"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

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

const trackLoads = new Map<string, Promise<THREE.Group>>();
const laneRadii = [4.4, 5.225, 6.025, 6.825, 7.6765];

function modelForSurface(surface?: string | null) {
  const value = surface?.trim().toLowerCase() ?? "";
  if (value.includes("grass") || value.includes("turf") || value.includes("cỏ") || value.includes("co")) return trackModels.grass;
  if (value.includes("dirt") || value.includes("sand") || value.includes("soil") || value.includes("đất") || value.includes("dat")) return trackModels.dirt;
  return trackModels.synthetic;
}

function loadTrack(path: string) {
  let load = trackLoads.get(path);
  if (!load) {
    load = new GLTFLoader().loadAsync(path).then((gltf) => gltf.scene).catch((error: unknown) => {
      trackLoads.delete(path);
      throw error;
    });
    trackLoads.set(path, load);
  }
  return load;
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
}: {
  surface?: string | null;
  runners: RaceTrackRunner[];
  targetDistanceMeters: number;
  isRunning: boolean;
  runStartTime?: number | null;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const runnersRef = useRef(runners);
  const runnerUpdateTimesRef = useRef(new Map<string, { progress: number; speedKmh: number; at: number }>());
  const displayedProgressRef = useRef(new Map<string, { progress: number; sourceProgress: number; at: number }>());
  const previousRunStartRef = useRef(runStartTime);
  const runningRef = useRef(isRunning);
  const runStartRef = useRef(runStartTime);
  const distanceRef = useRef(targetDistanceMeters);
  const drawRef = useRef<() => void>(() => {});
  const startLoopRef = useRef<() => void>(() => {});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const modelPath = modelForSurface(surface);

  runnersRef.current = runners;
  runningRef.current = isRunning;
  runStartRef.current = runStartTime;
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
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#dce6e2");
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 250);
    const racers: THREE.Group[] = [];
    let baseHorseY = 0.95;
    let finishLineX = 7.31;
    let worldBoundsSize = new THREE.Vector3(60, 4, 40);

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
    renderer.toneMappingExposure = 0.9;
    renderer.domElement.className = "race-track-scene__canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x657361, 0.9));
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));
    const sunlight = new THREE.DirectionalLight(0xfff2dd, 1.8);
    sunlight.position.set(-18, 32, 24);
    scene.add(sunlight);
    const fillLight = new THREE.DirectionalLight(0xdce9ff, 0.45);
    fillLight.position.set(18, 15, -20);
    scene.add(fillLight);

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

    function updateRacers(now: number) {
      const byLane = new Map(runnersRef.current.slice(0, 5).map((runner) => [runner.lane, runner]));
      racers.forEach((racer, index) => {
        const lane = index + 1;
        const runner = byLane.get(lane);
        if (!runner) {
          racer.visible = runnersRef.current.length === 0 && index === 2;
          if (racer.visible) {
            const pose = lanePosition(0, 3, baseHorseY, finishLineX);
            racer.position.set(pose.x, pose.y, pose.z);
            racer.rotation.set(0, pose.heading, 0);
          }
          return;
        }
        racer.visible = true;
        const snapshot = runnerUpdateTimesRef.current.get(runner.id);
        let targetProgress = clampProgress(runner.progress);
        if (runningRef.current && runner.speedKmh > 0) {
          const startAt = runStartRef.current ?? snapshot?.at ?? now;
          const elapsedSeconds = Math.max(0, (now - startAt) / 1000);
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
        const bob = runningRef.current ? Math.sin(now * 0.016 + lane * 1.3) * 0.035 : 0;
        racer.position.set(pose.x, pose.y + bob, pose.z);
        racer.rotation.set(0, pose.heading, runningRef.current ? Math.sin(now * 0.012 + lane) * 0.012 : 0);
      });
    }

    function draw() {
      if (disposed || !renderer || !controls) return;
      updateCamera();
      updateRacers(Date.now());
      renderer.render(scene, camera);
    }
    drawRef.current = () => draw();

    function animate() {
      if (disposed || !runningRef.current) {
        frameId = 0;
        return;
      }
      frameId = window.requestAnimationFrame(animate);
      draw();
    }
    startLoopRef.current = () => {
      if (!disposed && runningRef.current && !frameId) frameId = window.requestAnimationFrame(animate);
    };

    void loadTrack(modelPath).then((source) => {
      if (disposed || !renderer) return;
      const track = source.clone(true);
      track.updateMatrixWorld(true);
      const finishMarker = track.getObjectByName("FINISH_checker_0_00");
      if (finishMarker) finishLineX = finishMarker.getWorldPosition(new THREE.Vector3()).x;
      const heroTemplate = track.getObjectByName("HERO_racehorse") as THREE.Group | undefined;
      if (!heroTemplate) throw new Error("This track model does not contain HERO_racehorse.");
      baseHorseY = heroTemplate.position.y;
      const horseScale = heroTemplate.scale.clone();
      const horseParts = new Set<THREE.Object3D>();
      heroTemplate.traverse((part) => horseParts.add(part));
      for (let lane = 1; lane <= 5; lane += 1) {
        const racer = heroTemplate.clone(true);
        racer.name = `Racing horse in lane ${lane}`;
        racer.visible = false;
        racer.scale.copy(horseScale);
        racer.traverse((part) => horseParts.add(part));
        racers.push(racer);
        track.add(racer);
      }
      heroTemplate.visible = false;

      const worldBounds = new THREE.Box3().setFromObject(track);
      worldBoundsSize = worldBounds.getSize(new THREE.Vector3());
      const worldCenter = worldBounds.getCenter(new THREE.Vector3());
      optimizeRepeatedMeshes(track, horseParts);
      scene.add(track);
      const target = new THREE.Vector3(worldCenter.x, Math.max(0.45, worldCenter.y * 0.65), worldCenter.z);
      controls = new OrbitControls(camera, renderer.domElement);
      controls.target.copy(target);
      controls.enableDamping = false;
      controls.enablePan = false;
      controls.minPolarAngle = 0.2;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.minDistance = 18;
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
      if (runningRef.current) startLoopRef.current();

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
