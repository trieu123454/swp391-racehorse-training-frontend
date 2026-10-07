"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinnedModel } from "three/addons/utils/SkeletonUtils.js";
import type { InjuryMarker } from "@/api/veterinarian/api";

type Coordinates = { coordinate_x: number | null; coordinate_y: number | null; coordinate_z: number | null };
type CoordinateInput = { coordinate_x: number | string | null; coordinate_y: number | string | null; coordinate_z: number | string | null };
type Axis = "x" | "z";
type ModelAxes = { longAxis: Axis; sideAxis: Axis; headDirection: 1 | -1; halfLength: number; halfHeight: number; halfWidth: number };
type ViewerSide = "near" | "far";
type InteractionState = {
  markers: InjuryMarker[];
  placementMode: boolean;
  selectedCoordinates: Coordinates | null;
  selectedId: string | null;
  onSelectLocation?: (coordinates: Coordinates) => void;
};

let horseModelPromise: Promise<THREE.Group> | null = null;

function loadHorseModel() {
  if (!horseModelPromise) {
    horseModelPromise = new GLTFLoader().loadAsync("/models/injury-horse.glb")
      .then((model) => model.scene)
      .catch((error: unknown) => {
        horseModelPromise = null;
        throw error;
      });
  }
  const promise = horseModelPromise;
  return promise.then((model) => cloneSkinnedModel(model) as THREE.Group);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function markerColor(marker: InjuryMarker) {
  if (marker.recovery_status === "Recovered") return "#13956c";
  if (marker.severity === "Severe") return "#d94655";
  if (marker.severity === "Moderate") return "#d38a32";
  return "#3d83b6";
}

function coordinatesToPoint(coordinates: CoordinateInput, axes: ModelAxes) {
  const point = new THREE.Vector3();
  const x = clamp(Number(coordinates.coordinate_x ?? 0), -1.2, 1.2);
  const y = clamp(Number(coordinates.coordinate_y ?? 0), -1.05, 1.2);
  const z = clamp(Number(coordinates.coordinate_z ?? 0), -0.38, 0.38);
  point.setComponent(axes.longAxis === "x" ? 0 : 2, x / 1.2 * axes.halfLength * axes.headDirection);
  point.y = y / 1.2 * axes.halfHeight;
  point.setComponent(axes.sideAxis === "x" ? 0 : 2, z / 0.38 * axes.halfWidth);
  return point;
}

function pointToCoordinates(point: THREE.Vector3, axes: ModelAxes): Coordinates {
  const longValue = point.getComponent(axes.longAxis === "x" ? 0 : 2);
  const sideValue = point.getComponent(axes.sideAxis === "x" ? 0 : 2);
  return {
    coordinate_x: Number(clamp(longValue * axes.headDirection / axes.halfLength * 1.2, -1.2, 1.2).toFixed(3)),
    coordinate_y: Number(clamp(point.y / axes.halfHeight * 1.2, -1.05, 1.2).toFixed(3)),
    coordinate_z: Number(clamp(sideValue / axes.halfWidth * 0.38, -0.38, 0.38).toFixed(3)),
  };
}

function hasCoordinates(marker: InjuryMarker) {
  return marker.coordinate_x != null && marker.coordinate_y != null;
}

function markerSignature(markers: InjuryMarker[], selectedId: string | null) {
  return `${selectedId ?? ""}|${markers.map((marker) => `${marker.id}:${marker.coordinate_x}:${marker.coordinate_y}:${marker.coordinate_z}:${marker.severity}:${marker.recovery_status}`).join("|")}`;
}

function pin(color: THREE.ColorRepresentation, haloGeometry: THREE.SphereGeometry, coreGeometry: THREE.SphereGeometry) {
  const group = new THREE.Group();
  const halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false }));
  const core = new THREE.Mesh(coreGeometry, new THREE.MeshBasicMaterial({ color, depthWrite: false }));
  halo.userData.isPin = true;
  core.userData.isPin = true;
  group.add(halo, core);
  return group;
}

export default function InjuryModel3D({
  markers,
  placementMode = false,
  selectedCoordinates = null,
  onSelectLocation,
}: {
  markers: InjuryMarker[];
  placementMode?: boolean;
  selectedCoordinates?: Coordinates | null;
  onSelectLocation?: (coordinates: Coordinates) => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<{ setSide: (side: ViewerSide) => void; zoom: (factor: number) => void; reset: () => void }>({ setSide: () => {}, zoom: () => {}, reset: () => {} });
  const interactionRef = useRef<InteractionState>({ markers, placementMode, selectedCoordinates, selectedId: null, onSelectLocation });
  const [side, setSide] = useState<ViewerSide>("near");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  interactionRef.current = { markers, placementMode, selectedCoordinates, selectedId, onSelectLocation };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let modelAxes: ModelAxes | null = null;
    let modelMeshes: THREE.Object3D[] = [];
    let markerGroup: THREE.Group | null = null;
    let floorSurface: THREE.Mesh | null = null;
    let lastMarkerSignature = "";
    let lastDraftSignature = "";
    let frameId = 0;
    let startPoint: { x: number; y: number } | null = null;
    const markerObjects = new Map<string, THREE.Group>();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8faf9");

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = "block h-full w-full touch-none";
    renderer.domElement.setAttribute("aria-label", "Mô hình ngựa 3D tương tác để xem và đánh dấu vị trí chấn thương");
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xa8aaa0, 2.1));
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const keyLight = new THREE.DirectionalLight(0xfff4e4, 3.2);
    keyLight.position.set(-4, 7, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xdceeff, 1.15);
    fillLight.position.set(5, 2, -5);
    scene.add(fillLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 2.4;
    controls.maxDistance = 11;
    controls.minPolarAngle = 0.16;
    controls.maxPolarAngle = Math.PI * 0.49;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const haloGeometry = new THREE.SphereGeometry(0.115, 20, 14);
    const coreGeometry = new THREE.SphereGeometry(0.061, 20, 14);
    const draftHaloGeometry = new THREE.SphereGeometry(0.145, 20, 14);
    const draftCoreGeometry = new THREE.SphereGeometry(0.069, 20, 14);
    const draftMarker = pin("#d74d4d", draftHaloGeometry, draftCoreGeometry);
    draftMarker.visible = false;

    function resize() {
      if (!mount || disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    function cameraForSide(nextSide: ViewerSide) {
      if (!modelAxes) return;
      const sign = nextSide === "near" ? 1 : -1;
      const distance = 6.3;
      const position = new THREE.Vector3();
      position.setComponent(modelAxes.sideAxis === "x" ? 0 : 2, sign * distance);
      position.setComponent(modelAxes.longAxis === "x" ? 0 : 2, modelAxes.headDirection * distance * 0.12);
      position.y = distance * 0.19;
      controls.target.set(0, 0, 0);
      camera.position.copy(position);
      camera.lookAt(controls.target);
      controls.update();
    }

    actionsRef.current = {
      setSide: (nextSide) => cameraForSide(nextSide),
      zoom: (factor) => {
        const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      },
      reset: () => cameraForSide("near"),
    };

    function syncPins() {
      if (!modelAxes || !markerGroup) return;
      const current = interactionRef.current;
      const nextSignature = markerSignature(current.markers, current.selectedId);
      if (nextSignature !== lastMarkerSignature) {
        const activeIds = new Set<string>();
        current.markers.filter(hasCoordinates).forEach((marker) => {
          activeIds.add(marker.id);
          let markerPin = markerObjects.get(marker.id);
          if (!markerPin) {
            markerPin = pin(markerColor(marker), haloGeometry, coreGeometry);
            markerPin.userData.markerId = marker.id;
            markerPin.traverse((child) => { child.userData.markerId = marker.id; });
            markerGroup?.add(markerPin);
            markerObjects.set(marker.id, markerPin);
          }
          markerPin.position.copy(coordinatesToPoint(marker, modelAxes!));
          markerPin.scale.setScalar(marker.id === current.selectedId ? 1.22 : 1);
          markerPin.children.forEach((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) child.material.color.set(markerColor(marker));
          });
        });
        markerObjects.forEach((markerPin, id) => {
          if (activeIds.has(id)) return;
          markerGroup?.remove(markerPin);
          markerPin.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) child.material.dispose();
          });
          markerObjects.delete(id);
        });
        lastMarkerSignature = nextSignature;
      }

      const draft = current.selectedCoordinates;
      const draftSignature = draft ? `${draft.coordinate_x}:${draft.coordinate_y}:${draft.coordinate_z}` : "none";
      if (draftSignature !== lastDraftSignature) {
        draftMarker.visible = Boolean(draft && draft.coordinate_x != null && draft.coordinate_y != null);
        if (draftMarker.visible && draft) draftMarker.position.copy(coordinatesToPoint(draft, modelAxes));
        lastDraftSignature = draftSignature;
      }
    }

    function handlePointerDown(event: PointerEvent) {
      startPoint = { x: event.clientX, y: event.clientY };
    }

    function handlePointerUp(event: PointerEvent) {
      if (!startPoint || Math.hypot(event.clientX - startPoint.x, event.clientY - startPoint.y) > 6) {
        startPoint = null;
        return;
      }
      startPoint = null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const current = interactionRef.current;
      const markerHit = raycaster.intersectObjects([...markerObjects.values()], true)[0];
      const markerId = markerHit?.object.userData.markerId as string | undefined;
      if (!current.placementMode && markerId) {
        setSelectedId(markerId);
        return;
      }
      if (current.placementMode && current.onSelectLocation && modelAxes) {
        const hit = raycaster.intersectObjects(modelMeshes, true)[0];
        if (hit) current.onSelectLocation(pointToCoordinates(hit.point, modelAxes));
        return;
      }
      if (!current.placementMode) setSelectedId(null);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);

    function render() {
      if (disposed) return;
      frameId = window.requestAnimationFrame(render);
      syncPins();
      controls.update();
      renderer.render(scene, camera);
    }
    frameId = window.requestAnimationFrame(render);

    void loadHorseModel().then((horse) => {
      if (disposed) return;
      horse.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(horse);
      const center = bounds.getCenter(new THREE.Vector3());
      const rawSize = bounds.getSize(new THREE.Vector3());
      const longAxis: Axis = rawSize.x >= rawSize.z ? "x" : "z";
      const sideAxis: Axis = longAxis === "x" ? "z" : "x";
      const head = horse.getObjectByName("head_019");
      const headPosition = head?.getWorldPosition(new THREE.Vector3());
      const headDirection: 1 | -1 = headPosition && headPosition.getComponent(longAxis === "x" ? 0 : 2) < center.getComponent(longAxis === "x" ? 0 : 2) ? -1 : 1;
      const scale = 3.35 / Math.max(rawSize.x, rawSize.y, rawSize.z);
      horse.scale.setScalar(scale);
      horse.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      horse.updateMatrixWorld(true);

      const normalizedBounds = new THREE.Box3().setFromObject(horse);
      const size = normalizedBounds.getSize(new THREE.Vector3());
      modelAxes = {
        longAxis,
        sideAxis,
        headDirection,
        halfLength: Math.max(size.getComponent(longAxis === "x" ? 0 : 2) / 2, 0.01),
        halfHeight: Math.max(size.y / 2, 0.01),
        halfWidth: Math.max(size.getComponent(sideAxis === "x" ? 0 : 2) / 2, 0.01),
      };

      modelMeshes = [];
      horse.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.frustumCulled = true;
          modelMeshes.push(child);
        }
      });
      scene.add(horse);
      markerGroup = new THREE.Group();
      scene.add(markerGroup);
      markerGroup.add(draftMarker);

      floorSurface = new THREE.Mesh(
        new THREE.CircleGeometry(Math.max(size.x, size.z) * 0.42, 64),
        new THREE.MeshBasicMaterial({ color: "#dde5e2", transparent: true, opacity: 0.26, depthWrite: false }),
      );
      floorSurface.rotation.x = -Math.PI / 2;
      floorSurface.position.y = normalizedBounds.min.y - 0.035;
      floorSurface.scale.set(1.5, 0.72, 1);
      scene.add(floorSurface);

      cameraForSide("near");
      syncPins();
      setLoading(false);
    }).catch((reason: unknown) => {
      if (disposed) return;
      setLoadError(reason instanceof Error ? reason.message : "Không thể tải mô hình ngựa 3D.");
      setLoading(false);
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      controls.dispose();
      renderer.dispose();
      haloGeometry.dispose();
      coreGeometry.dispose();
      draftHaloGeometry.dispose();
      draftCoreGeometry.dispose();
      draftMarker.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) child.material.dispose();
      });
      if (floorSurface) {
        floorSurface.geometry.dispose();
        if (Array.isArray(floorSurface.material)) floorSurface.material.forEach((material) => material.dispose());
        else floorSurface.material.dispose();
      }
      markerObjects.forEach((markerPin) => markerPin.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) child.material.dispose();
      }));
      actionsRef.current = { setSide: () => {}, zoom: () => {}, reset: () => {} };
      renderer.domElement.remove();
    };
  }, []);

  const selectedMarker = markers.find((marker) => marker.id === selectedId);
  const locatedCount = markers.filter(hasCoordinates).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-[#dce6eb] bg-[linear-gradient(145deg,#fbfcfc,#f0f5f5_58%,#f7f8f5)] p-3 shadow-sm sm:p-5" aria-label="Mô hình 3D theo dõi chấn thương ngựa">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#c27664]" />
            <h4 className="font-semibold tracking-tight text-[#36566a]">Mô hình ngựa 3D</h4>
            <span className="rounded-full border border-[#d8e4e8] bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{locatedCount} điểm đã đánh dấu</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Kéo để xoay, cuộn để phóng to. Chọn mặt gần hoặc mặt xa để xem vị trí chấn thương.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" aria-pressed={side === "near"} className={`rounded-lg px-2.5 py-1.5 text-xs ${side === "near" ? "bg-[#e8eff1] font-semibold text-[#35596b]" : "text-slate-500"}`} onClick={() => { setSide("near"); actionsRef.current.setSide("near"); }}>Mặt gần</button>
          <button type="button" aria-pressed={side === "far"} className={`rounded-lg px-2.5 py-1.5 text-xs ${side === "far" ? "bg-[#e8eff1] font-semibold text-[#35596b]" : "text-slate-500"}`} onClick={() => { setSide("far"); actionsRef.current.setSide("far"); }}>Mặt xa</button>
          <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-lg text-slate-700 shadow-sm" aria-label="Thu nhỏ mô hình" onClick={() => actionsRef.current.zoom(1.12)}>−</button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-lg text-slate-700 shadow-sm" aria-label="Phóng to mô hình" onClick={() => actionsRef.current.zoom(0.88)}>+</button>
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 shadow-sm" onClick={() => { setSide("near"); actionsRef.current.reset(); }}>Đặt lại góc</button>
        </div>
      </div>

      <div className={`relative mt-3 overflow-hidden rounded-xl border border-white/90 bg-[#f8faf9] shadow-[inset_0_0_0_1px_rgba(190,208,214,.28)] ${placementMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}>
        <div ref={mountRef} className="h-[285px] w-full sm:h-[410px]" />
        {loading && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/60 text-sm font-medium text-slate-600">Đang tải mô hình ngựa 3D…</div>}
        {loadError && <div role="alert" className="absolute inset-0 grid place-items-center bg-white/90 p-6 text-center text-sm text-rose-700">Không tải được mô hình 3D. {loadError}</div>}
        {placementMode && <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-[#c8dfd8] bg-[#eff7f5]/95 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#376c61]"><span className="h-2 w-2 rounded-full bg-[#299477]" /> Chọn vị trí trên ngựa</div>}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/90 bg-white/80 px-2.5 py-1.5 text-[10px] text-slate-500 shadow-sm">{placementMode ? "Bấm lên thân ngựa để lấy tọa độ" : "Kéo mô hình để xoay 360°"}</div>
      </div>

      {selectedMarker && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600">
        <span className="font-semibold text-[#36566a]">{selectedMarker.body_part}</span>
        <span>{selectedMarker.severity}</span>
        <span>{selectedMarker.recovery_status}</span>
        {selectedMarker.description && <span className="basis-full text-slate-500">{selectedMarker.description}</span>}
      </div>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#3d83b6]" />Nhẹ</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#d38a32]" />Vừa</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#d94655]" />Nặng</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#13956c]" />Đã hồi phục</span>
      </div>
    </section>
  );
}
