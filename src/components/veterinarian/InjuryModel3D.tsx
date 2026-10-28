"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinnedModel } from "three/addons/utils/SkeletonUtils.js";
import type { InjuryMarker } from "@/api/veterinarian/api";
import MuscleAnatomyPanel from "./MuscleAnatomyPanel";
import OrganAnatomyPanel from "./OrganAnatomyPanel";
import SkeletonAnatomyPanel from "./SkeletonAnatomyPanel";
import { buildEquineSkeletonLayer, type SkeletonRecord } from "./skeleton-builder";
import {
  buildEquineMuscleLayer,
  equineMuscles,
  type EquineMuscleRecord,
  type MuscleFilters,
} from "./muscle-builder";
import {
  buildEquineOrganLayer,
  type OrganRecord,
  type OrganSystems,
} from "./organ-builder";

type Coordinates = { coordinate_x: number | null; coordinate_y: number | null; coordinate_z: number | null };
type CoordinateInput = { coordinate_x: number | string | null; coordinate_y: number | string | null; coordinate_z: number | string | null };
type Axis = "x" | "z";
type ModelAxes = { longAxis: Axis; sideAxis: Axis; headDirection: 1 | -1; halfLength: number; halfHeight: number; halfWidth: number };
type ViewerView = "left" | "right" | "top" | "front" | "back";
type AnatomyLayer = "skin" | "muscle" | "skeleton" | "organs";
type AnatomyVisibility = Record<AnatomyLayer, boolean>;
const viewPresetLabels: Record<ViewerView, string> = {
  left: "Bên trái",
  right: "Bên phải",
  front: "Trước",
  back: "Sau",
  top: "Trên",
};
const anatomyLayers: { id: AnatomyLayer; label: string }[] = [
  { id: "skin", label: "Da" },
  { id: "skeleton", label: "Xương" },
  { id: "organs", label: "Nội tạng" },
  { id: "muscle", label: "Cơ" },
];
type InteractionState = {
  markers: InjuryMarker[];
  placementMode: boolean;
  selectedCoordinates: Coordinates | null;
  selectedId: string | null;
  selectedMuscleId: string | null;
  hoveredMuscleId: string | null;
  selectedOrganId: string | null;
  hoveredOrganId: string | null;
  selectedSkeletonId: string | null;
  hoveredSkeletonId: string | null;
  muscleFilters: MuscleFilters;
  organSystems: OrganSystems;
  explodeView: boolean;
  showSkeletonLabels: boolean;
  jawOpen: boolean;
  onSelectLocation?: (coordinates: Coordinates) => void;
};
type HoveredMuscle = string | null;
type HoveredOrgan = string | null;
type HoveredSkeleton = string | null;
type HoveredSkeletonTooltip = { id: string; x: number; y: number } | null;
type ViewerActions = {
  setView: (view: ViewerView) => void;
  zoom: (factor: number) => void;
  reset: () => void;
  focusMuscle: (id: string) => void;
  focusOrgan: (id: string) => void;
  focusSkeleton: (id: string) => void;
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

function createStudioBackdrop() {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#211e1b");
    gradient.addColorStop(0.52, "#2e2a26");
    gradient.addColorStop(1, "#171513");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const softLight = context.createRadialGradient(0, 0, 0, 0, 0, canvas.height * 0.9);
    softLight.addColorStop(0, "rgba(255,255,255,0.08)");
    softLight.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = softLight;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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
  const actionsRef = useRef<ViewerActions>({ setView: () => {}, zoom: () => {}, reset: () => {}, focusMuscle: () => {}, focusOrgan: () => {}, focusSkeleton: () => {} });
  const interactionRef = useRef<InteractionState>({
    markers,
    placementMode,
    selectedCoordinates,
    selectedId: null,
    selectedMuscleId: null,
    hoveredMuscleId: null,
    selectedOrganId: null,
    hoveredOrganId: null,
    selectedSkeletonId: null,
    hoveredSkeletonId: null,
    muscleFilters: { group: "all", superficial: true, deep: true, search: "" },
    organSystems: { respiratory: true, circulatory: true, digestive: true, urinary: true, nervous: true },
    explodeView: false,
    showSkeletonLabels: false,
    jawOpen: false,
    onSelectLocation,
  });
  const [view, setViewState] = useState<ViewerView>("left");
  const [anatomyVisibility, setAnatomyVisibility] = useState<AnatomyVisibility>({ skin: true, skeleton: true, organs: false, muscle: false });
  const anatomyVisibilityRef = useRef<AnatomyVisibility>(anatomyVisibility);
  const [muscleFilters, setMuscleFilters] = useState<MuscleFilters>({ group: "all", superficial: true, deep: true, search: "" });
  const [selectedMuscleId, setSelectedMuscleId] = useState<string | null>(null);
  const [hoveredMuscle, setHoveredMuscle] = useState<HoveredMuscle>(null);
  const [organSystems, setOrganSystems] = useState<OrganSystems>({ respiratory: true, circulatory: true, digestive: true, urinary: true, nervous: true });
  const [organRecords, setOrganRecords] = useState<OrganRecord[]>([]);
  const [selectedOrganId, setSelectedOrganId] = useState<string | null>(null);
  const [hoveredOrgan, setHoveredOrgan] = useState<HoveredOrgan>(null);
  const [skeletonRecords, setSkeletonRecords] = useState<SkeletonRecord[]>([]);
  const [selectedSkeletonId, setSelectedSkeletonId] = useState<string | null>(null);
  const [hoveredSkeleton, setHoveredSkeleton] = useState<HoveredSkeleton>(null);
  const [hoveredSkeletonTooltip, setHoveredSkeletonTooltip] = useState<HoveredSkeletonTooltip>(null);
  const [explodeView, setExplodeView] = useState(false);
  const [showSkeletonLabels, setShowSkeletonLabels] = useState(false);
  const [jawOpen, setJawOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"muscle" | "organs" | "skeleton">("skeleton");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  interactionRef.current = {
    markers, placementMode, selectedCoordinates, selectedId, selectedMuscleId,
    hoveredMuscleId: hoveredMuscle, selectedOrganId, hoveredOrganId: hoveredOrgan,
    selectedSkeletonId, hoveredSkeletonId: hoveredSkeleton,
    muscleFilters, organSystems, explodeView, showSkeletonLabels, jawOpen, onSelectLocation,
  };
  anatomyVisibilityRef.current = anatomyVisibility;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let horseRoot: THREE.Group | null = null;
    let modelAxes: ModelAxes | null = null;
    let boneNodes = new Map<string, THREE.Bone>();
    let modelMeshes: THREE.Object3D[] = [];
    let layerMeshes: { mesh: THREE.Mesh; skinMaterial: THREE.Material | THREE.Material[]; ghostMaterial: THREE.MeshPhysicalMaterial }[] = [];
    let anatomyGroups: THREE.Group[] = [];
    let muscleLayer: THREE.Group | null = null;
    let skeletonLayer: THREE.Group | null = null;
    let organLayer: THREE.Group | null = null;
    let nerveLayer: THREE.Group | null = null;
    let builtSkeletonRecords: SkeletonRecord[] = [];
    let skeletonDisplayMaterials: {
      dimBone: THREE.MeshStandardMaterial;
      dimCartilage: THREE.MeshStandardMaterial;
      dimCostalCartilage: THREE.MeshStandardMaterial;
      dimTooth: THREE.MeshStandardMaterial;
      focusBone: Record<string, THREE.MeshStandardMaterial>;
    } | null = null;
    let builtOrganRecords: OrganRecord[] = [];
    const accessoryMeshes: THREE.Mesh[] = [];
    let activeAnatomySignature = "";
    let activeMuscleDisplaySignature = "";
    let activeOrganDisplaySignature = "";
    let activeSkeletonDisplaySignature = "";
    let activeExplodeState = false;
    let markerGroup: THREE.Group | null = null;
    let lastMarkerSignature = "";
    let lastDraftSignature = "";
    let frameId = 0;
    let fittedDistance = 6.3;
    let modelRadius = 0;
    const modelCenter = new THREE.Vector3();
    let contactShadow: THREE.Mesh | null = null;
    let currentView: ViewerView = "left";
    let cameraReady = false;
    let startPoint: { x: number; y: number } | null = null;
    const markerObjects = new Map<string, THREE.Group>();
    const scene = new THREE.Scene();
    const backdropTexture = createStudioBackdrop();
    scene.background = backdropTexture;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      backdropTexture.dispose();
      setLoadError("Trình duyệt không cấp được WebGL cho mô hình 3D. Hãy tải lại trang hoặc đóng bớt tab đang dùng đồ họa 3D.");
      setLoading(false);
      return () => { disposed = true; };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "block h-full w-full touch-none";
    renderer.domElement.setAttribute("aria-label", "Mô hình ngựa 3D tương tác để xem và đánh dấu vị trí chấn thương");
    const handleContextLost = () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      actionsRef.current = { setView: () => {}, zoom: () => {}, reset: () => {}, focusMuscle: () => {}, focusOrgan: () => {}, focusSkeleton: () => {} };
      setLoadError("WebGL đã bị trình duyệt dừng. Hãy tải lại trang để mở lại mô hình 3D.");
      setLoading(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x858b93, 1.55));
    scene.add(new THREE.AmbientLight(0xffffff, 0.38));
    const keyLight = new THREE.DirectionalLight(0xfff4e4, 2.8);
    keyLight.position.set(-4, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 18;
    keyLight.shadow.camera.updateProjectionMatrix();
    keyLight.shadow.bias = -0.00025;
    keyLight.shadow.normalBias = 0.02;
    keyLight.shadow.radius = 3;
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xdceeff, 0.82);
    fillLight.position.set(5, 2, -5);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0xf5dfc6, 1.25);
    rimLight.position.set(0, 4, -7);
    scene.add(rimLight);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 0.55;
    controls.maxDistance = 18;
    controls.minPolarAngle = 0.005;
    controls.maxPolarAngle = Math.PI - 0.005;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const haloGeometry = new THREE.SphereGeometry(0.115, 20, 14);
    const coreGeometry = new THREE.SphereGeometry(0.061, 20, 14);
    const draftHaloGeometry = new THREE.SphereGeometry(0.145, 20, 14);
    const draftCoreGeometry = new THREE.SphereGeometry(0.069, 20, 14);
    const draftMarker = pin("#d74d4d", draftHaloGeometry, draftCoreGeometry);
    draftMarker.visible = false;

    function syncAnatomyLayers() {
      if (!layerMeshes.length) return;
      const nextLayers = anatomyVisibilityRef.current;
      const signature = `${Number(nextLayers.skin)}${Number(nextLayers.skeleton)}${Number(nextLayers.organs)}${Number(nextLayers.muscle)}`;
      if (activeAnatomySignature === signature) return;
      const showAnatomy = nextLayers.skeleton || nextLayers.organs || nextLayers.muscle;
      if (horseRoot) horseRoot.visible = nextLayers.skin;
      for (const entry of layerMeshes) {
        const showGhost = nextLayers.skin && showAnatomy;
        entry.mesh.material = showGhost ? entry.ghostMaterial : entry.skinMaterial;
        entry.mesh.renderOrder = showGhost ? 1 : 0;
        entry.ghostMaterial.opacity = nextLayers.skeleton ? 0.16 : 0.23;
      }
      accessoryMeshes.forEach((mesh) => { mesh.visible = !nextLayers.skeleton; });
      if (muscleLayer) muscleLayer.visible = nextLayers.muscle;
      if (skeletonLayer) skeletonLayer.visible = nextLayers.skeleton;
      if (organLayer) organLayer.visible = nextLayers.organs;
      if (nerveLayer) nerveLayer.visible = nextLayers.organs && interactionRef.current.organSystems.nervous;
      activeAnatomySignature = signature;
    }

    function syncMuscleDisplay() {
      if (!muscleLayer) return;
      const current = interactionRef.current;
      const { group, superficial, deep, search } = current.muscleFilters;
      const normalizedSearch = search.trim().toLocaleLowerCase("vi");
      const signature = `${group}|${Number(superficial)}${Number(deep)}|${normalizedSearch}|${current.selectedMuscleId ?? ""}|${current.hoveredMuscleId ?? ""}`;
      if (signature === activeMuscleDisplaySignature) return;

      for (const muscleRoot of muscleLayer.children) {
        const record = muscleRoot.userData.muscleInfo as EquineMuscleRecord | undefined;
        if (!record) continue;
        const searchable = `${record.vi} ${record.latin} ${record.origin.label} ${record.insertion.label}`.toLocaleLowerCase("vi");
        const matches = (group === "all" || record.group === group)
          && (record.layer === "superficial" ? superficial : deep)
          && (!normalizedSearch || searchable.includes(normalizedSearch));
        muscleRoot.visible = matches;
        const highlighted = record.id === current.selectedMuscleId || record.id === current.hoveredMuscleId;
        const selected = record.id === current.selectedMuscleId;
        muscleRoot.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => {
            if (!(material instanceof THREE.MeshStandardMaterial)) return;
            material.emissive.setHex(highlighted ? 0x5a2520 : Number(material.userData.baseEmissive ?? 0));
            material.emissiveIntensity = selected ? 0.7 : highlighted ? 0.38 : 0;
          });
        });
      }
      activeMuscleDisplaySignature = signature;
    }

    function syncOrganDisplay() {
      if (!organLayer) return;
      const current = interactionRef.current;
      const focusId = current.hoveredOrganId ?? current.selectedOrganId;
      const signature = `${Number(current.organSystems.respiratory)}${Number(current.organSystems.circulatory)}${Number(current.organSystems.digestive)}${Number(current.organSystems.urinary)}${Number(current.organSystems.nervous)}|${focusId ?? ""}`;
      if (signature !== activeOrganDisplaySignature) {
        for (const record of builtOrganRecords) {
          const visible = current.organSystems[record.system];
          record.object.visible = visible;
          const dimFactor = focusId && focusId !== record.id ? 0.22 : 1;
          record.object.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.forEach((material) => {
              if (!(material instanceof THREE.MeshStandardMaterial)) return;
              const baseOpacity = Number(material.userData.baseOpacity ?? 0.94);
              material.opacity = baseOpacity * dimFactor;
              material.emissive.setHex(focusId === record.id ? 0x412326 : Number(material.userData.baseEmissive ?? 0));
              material.emissiveIntensity = focusId === record.id ? 0.42 : 0;
            });
          });
        }
        if (nerveLayer) nerveLayer.visible = anatomyVisibilityRef.current.organs && current.organSystems.nervous;
        activeOrganDisplaySignature = signature;
      }

    }

    function syncSkeletonDisplay() {
      if (!skeletonLayer) return;
      const current = interactionRef.current;
      const focusId = current.hoveredSkeletonId ?? current.selectedSkeletonId;
      const signature = `${focusId ?? ""}|${Number(current.explodeView)}|${Number(current.showSkeletonLabels)}|${Number(current.jawOpen)}`;
      if (signature !== activeSkeletonDisplaySignature) {
        const jawPivot = skeletonLayer.getObjectByName("mandible-pivot");
        if (jawPivot) {
          const sideIndex = modelAxes?.sideAxis === "x" ? 0 : 2;
          const forward = new THREE.Vector3().setComponent(modelAxes?.longAxis === "x" ? 0 : 2, modelAxes?.headDirection ?? 1);
          const side = new THREE.Vector3().setComponent(sideIndex, 1);
          const rotationDirection = Math.sign(new THREE.Vector3().crossVectors(side, forward).y) || 1;
          jawPivot.rotation.set(0, 0, 0);
          const angle = current.jawOpen ? -rotationDirection * 0.24 : 0;
          if (sideIndex === 0) jawPivot.rotation.x = angle;
          else jawPivot.rotation.z = angle;
        }
        if (current.explodeView !== activeExplodeState) {
          const sideAxis = modelAxes?.sideAxis === "x" ? "x" : "z";
          const longAxis = modelAxes?.longAxis === "x" ? "x" : "z";
          for (const category of skeletonLayer.children) {
            const kind = category.userData.skeletonGroup as string;
            category.position.set(0, 0, 0);
            if (current.explodeView) {
              if (kind === "axial") category.position.y = 0.024;
              if (kind === "forelimb") category.position.setComponent(sideAxis === "x" ? 0 : 2, 0.035);
              if (kind === "hindlimb") category.position.setComponent(sideAxis === "x" ? 0 : 2, -0.035);
              if (kind === "head") category.position.setComponent(longAxis === "x" ? 0 : 2, (modelAxes?.headDirection ?? 1) * 0.025);
            }
          }
          activeExplodeState = current.explodeView;
        }
        for (const record of builtSkeletonRecords) {
          const highlighted = focusId === record.id;
          const dimmed = Boolean(focusId && !highlighted);
          record.object.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            const isCartilage = Boolean(object.userData.isCartilage);
            const isCostalCartilage = Boolean(object.userData.isCostalCartilage);
            const isTooth = Boolean(object.userData.isTooth);
            if (dimmed) object.material = isTooth
              ? skeletonDisplayMaterials?.dimTooth ?? object.material
              : isCostalCartilage ? skeletonDisplayMaterials?.dimCostalCartilage ?? object.material
                : isCartilage ? skeletonDisplayMaterials?.dimCartilage ?? object.material : skeletonDisplayMaterials?.dimBone ?? object.material;
            else if (highlighted && skeletonDisplayMaterials) {
              const materials = skeletonLayer?.userData.skeletonMaterials as { bone: THREE.MeshStandardMaterial; cartilage: THREE.MeshStandardMaterial; costalCartilage?: THREE.MeshStandardMaterial; tooth: THREE.MeshStandardMaterial } | undefined;
              object.material = isTooth ? materials?.tooth ?? object.material
                : isCostalCartilage ? materials?.costalCartilage ?? object.material
                  : isCartilage ? materials?.cartilage ?? object.material
                  : skeletonDisplayMaterials.focusBone[record.group] ?? object.material;
            } else {
              const materials = skeletonLayer?.userData.skeletonMaterials as { bone: THREE.MeshStandardMaterial; cartilage: THREE.MeshStandardMaterial; costalCartilage?: THREE.MeshStandardMaterial; tooth: THREE.MeshStandardMaterial } | undefined;
              if (materials) object.material = isTooth ? materials.tooth : isCostalCartilage ? materials.costalCartilage ?? materials.cartilage : isCartilage ? materials.cartilage : materials.bone;
            }
          });
        }
        for (const category of skeletonLayer.children) {
          const labels = category.getObjectByName("skeleton-labels");
          if (labels) labels.visible = current.showSkeletonLabels;
        }
        activeSkeletonDisplaySignature = signature;
      }

    }

    function resize() {
      if (!mount || disposed) return;
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      if (cameraReady) cameraForView(currentView);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    function cameraForView(nextView: ViewerView) {
      if (!modelAxes) return;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const limitingFov = Math.min(verticalFov, horizontalFov);
      fittedDistance = Math.max(2.4, modelRadius / Math.sin(limitingFov / 2) * 1.2);
      controls.minDistance = Math.max(0.55, Math.min(1.25, modelRadius * 0.38));
      controls.maxDistance = Math.max(11, fittedDistance * 2.2);
      const direction = new THREE.Vector3();
      camera.up.set(0, 1, 0);
      if (nextView === "top") {
        direction.y = 1;
        camera.up.setComponent(modelAxes.longAxis === "x" ? 0 : 2, modelAxes.headDirection);
      } else if (nextView === "left" || nextView === "right") {
        const sideIndex = modelAxes.sideAxis === "x" ? 0 : 2;
        const leftPosition = boneNodes.get("clavicle_l_0203")?.getWorldPosition(new THREE.Vector3());
        const leftSign = leftPosition ? Math.sign(leftPosition.getComponent(sideIndex)) || -1 : -1;
        direction.setComponent(sideIndex, nextView === "left" ? leftSign : -leftSign);
        direction.addScaledVector(new THREE.Vector3().setComponent(modelAxes.longAxis === "x" ? 0 : 2, modelAxes.headDirection), 0.06);
        direction.y = 0.08;
      } else {
        direction.setComponent(modelAxes.longAxis === "x" ? 0 : 2, modelAxes.headDirection * (nextView === "front" ? 1 : -1));
        direction.y = 0.08;
      }
      direction.normalize();
      controls.target.copy(modelCenter);
      camera.position.copy(controls.target).addScaledVector(direction, fittedDistance);
      camera.lookAt(controls.target);
      controls.update();
    }

    const focusMuscle = (id: string) => {
      const target = muscleLayer?.children.find((child) => child.userData.muscleId === id);
      if (!target) return;
      const bounds = new THREE.Box3().setFromObject(target);
      const center = bounds.getCenter(new THREE.Vector3());
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 0.001) offset.set(1, 0.25, 1);
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      const distance = clamp(Math.max(sphere.radius * 3.6, 2.6), 2.6, 5.5);
      controls.target.copy(center);
      camera.position.copy(center).add(offset.normalize().multiplyScalar(distance));
      camera.lookAt(center);
      controls.update();
    };

    const focusOrgan = (id: string) => {
      const target = builtOrganRecords.find((record) => record.id === id)?.object;
      if (!target) return;
      const bounds = new THREE.Box3().setFromObject(target);
      const center = bounds.getCenter(new THREE.Vector3());
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distance = clamp(sphere.radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 1.8, 0.85, 3.8);
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 0.001) offset.set(1, 0.25, 1);
      controls.target.copy(center);
      camera.position.copy(center).add(offset.normalize().multiplyScalar(distance));
      camera.lookAt(center);
      controls.update();
    };

    const focusSkeleton = (id: string) => {
      const target = builtSkeletonRecords.find((record) => record.id === id)?.object;
      if (!target) return;
      const bounds = new THREE.Box3().setFromObject(target);
      const center = bounds.getCenter(new THREE.Vector3());
      const sphere = bounds.getBoundingSphere(new THREE.Sphere());
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
      const distance = clamp(sphere.radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2) * 2.1, 0.8, 4.8);
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 0.001) offset.set(1, 0.25, 1);
      controls.target.copy(center);
      camera.position.copy(center).add(offset.normalize().multiplyScalar(distance));
      camera.lookAt(center);
      controls.update();
    };

    actionsRef.current = {
      setView: (nextView) => { currentView = nextView; setViewState(nextView); cameraForView(nextView); },
      zoom: (factor) => {
        const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      },
      reset: () => { currentView = "left"; setViewState("left"); cameraForView("left"); },
      focusMuscle,
      focusOrgan,
      focusSkeleton,
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
      markerObjects.forEach((markerPin, id) => {
        markerPin.visible = !anatomyVisibilityRef.current.skeleton || id === current.selectedId;
      });

      const draft = current.selectedCoordinates;
      const draftSignature = draft ? `${draft.coordinate_x}:${draft.coordinate_y}:${draft.coordinate_z}` : "none";
      if (draftSignature !== lastDraftSignature) {
        if (draft && draft.coordinate_x != null && draft.coordinate_y != null) draftMarker.position.copy(coordinatesToPoint(draft, modelAxes));
        lastDraftSignature = draftSignature;
      }
      draftMarker.visible = !anatomyVisibilityRef.current.skeleton
        && Boolean(draft && draft.coordinate_x != null && draft.coordinate_y != null);
    }

    function handlePointerDown(event: PointerEvent) {
      startPoint = { x: event.clientX, y: event.clientY };
    }

    function muscleHitAt(event: PointerEvent | MouseEvent) {
      if (!muscleLayer?.visible) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(muscleLayer.children, true)[0] ?? null;
    }

    function organHitAt(event: PointerEvent | MouseEvent) {
      if (!organLayer?.visible) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const roots = builtOrganRecords
        .filter((record) => interactionRef.current.organSystems[record.system]
          && (record.system !== "nervous" || Boolean(nerveLayer?.visible)))
        .map((record) => record.object);
      return raycaster.intersectObjects(roots, true).find((hit) => hit.object.userData.organId) ?? null;
    }

    function skeletonHitAt(event: PointerEvent | MouseEvent) {
      if (!skeletonLayer?.visible) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(skeletonLayer.children, true).find((hit) => hit.object.userData.boneId) ?? null;
    }

    function handlePointerMove(event: PointerEvent) {
      const current = interactionRef.current;
      if (current.placementMode) {
        if (current.hoveredMuscleId) setHoveredMuscle(null);
        if (current.hoveredOrganId) setHoveredOrgan(null);
        if (current.hoveredSkeletonId) setHoveredSkeleton(null);
        setHoveredSkeletonTooltip(null);
        renderer.domElement.style.cursor = "crosshair";
        return;
      }
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const markerHit = raycaster.intersectObjects([...markerObjects.values()], true)[0];
      const markerId = markerHit?.object.userData.markerId as string | undefined;
      if (markerId) {
        setHoveredOrgan(null);
        setHoveredSkeleton(null);
        setHoveredSkeletonTooltip(null);
        setHoveredMuscle(null);
        renderer.domElement.style.cursor = "pointer";
        return;
      }
      const organHit = organHitAt(event);
      const organId = organHit?.object.userData.organId as string | undefined;
      if (organId) {
        setHoveredSkeleton(null);
        setHoveredSkeletonTooltip(null);
        setHoveredOrgan(organId);
        setHoveredMuscle(null);
        renderer.domElement.style.cursor = "pointer";
        return;
      }
      setHoveredOrgan(null);
      const skeletonHit = skeletonHitAt(event);
      const skeletonId = skeletonHit?.object.userData.boneId as string | undefined;
      if (skeletonId) {
        setHoveredSkeleton((previous) => previous === skeletonId ? previous : skeletonId);
        setHoveredSkeletonTooltip((previous) => {
          if (previous?.id === skeletonId) return previous;
          const tooltipWidth = 220;
          return {
            id: skeletonId,
            x: Math.max(8, Math.min(event.clientX - rect.left + 12, rect.width - tooltipWidth - 8)),
            y: Math.max(8, event.clientY - rect.top - 36),
          };
        });
        setHoveredMuscle(null);
        renderer.domElement.style.cursor = "pointer";
        return;
      }
      setHoveredSkeleton(null);
      setHoveredSkeletonTooltip(null);
      const hit = muscleHitAt(event);
      const id = hit?.object.userData.muscleId as string | undefined;
      if (id) {
        setHoveredMuscle((previous) => previous === id ? previous : id);
        renderer.domElement.style.cursor = "pointer";
      } else {
        setHoveredMuscle(null);
        renderer.domElement.style.cursor = startPoint ? "grabbing" : "grab";
      }
    }

    function handlePointerLeave() {
      setHoveredSkeleton(null);
      setHoveredSkeletonTooltip(null);
      setHoveredOrgan(null);
      setHoveredMuscle(null);
      renderer.domElement.style.cursor = "grab";
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
        setSelectedOrganId(null);
        setSelectedMuscleId(null);
        setSelectedSkeletonId(null);
        return;
      }
      if (!current.placementMode) {
        const organHit = organHitAt(event);
        const organId = organHit?.object.userData.organId as string | undefined;
        if (organId) {
          setSelectedOrganId(organId);
          setSelectedMuscleId(null);
          setSelectedSkeletonId(null);
          setSelectedId(null);
          setInspectorTab("organs");
          return;
        }
        const skeletonHit = skeletonHitAt(event);
        const skeletonId = skeletonHit?.object.userData.boneId as string | undefined;
        if (skeletonId) {
          if (skeletonId === "mandible") setJawOpen((open) => !open);
          setSelectedSkeletonId(skeletonId);
          setSelectedOrganId(null);
          setSelectedMuscleId(null);
          setSelectedId(null);
          setInspectorTab("skeleton");
          setAnatomyVisibility((currentLayers) => ({ ...currentLayers, skeleton: true }));
          focusSkeleton(skeletonId);
          return;
        }
        const muscleHit = muscleHitAt(event);
        const muscleId = muscleHit?.object.userData.muscleId as string | undefined;
        if (muscleId) {
          setSelectedMuscleId(muscleId);
          setSelectedOrganId(null);
          setSelectedSkeletonId(null);
          setSelectedId(null);
          setInspectorTab("muscle");
          return;
        }
      }
      if (current.placementMode && current.onSelectLocation && modelAxes) {
        const hit = raycaster.intersectObjects(modelMeshes, true)[0];
        if (hit) current.onSelectLocation(pointToCoordinates(hit.point, modelAxes));
        return;
      }
      if (!current.placementMode) {
        setSelectedId(null);
        setSelectedOrganId(null);
        setSelectedMuscleId(null);
        setSelectedSkeletonId(null);
      }
    }

    function handleDoubleClick(event: MouseEvent) {
      if (interactionRef.current.placementMode) return;
      const organHit = organHitAt(event);
      const organId = organHit?.object.userData.organId as string | undefined;
      if (organId) {
        setSelectedOrganId(organId);
        setSelectedMuscleId(null);
        setSelectedSkeletonId(null);
        setInspectorTab("organs");
        focusOrgan(organId);
        return;
      }
      const skeletonHit = skeletonHitAt(event);
      const skeletonId = skeletonHit?.object.userData.boneId as string | undefined;
      if (skeletonId) {
        setSelectedSkeletonId(skeletonId);
        setSelectedOrganId(null);
        setInspectorTab("skeleton");
        focusSkeleton(skeletonId);
        return;
      }
      const hit = muscleHitAt(event);
      const muscleId = hit?.object.userData.muscleId as string | undefined;
      if (!muscleId) return;
      setSelectedMuscleId(muscleId);
      setSelectedOrganId(null);
      setSelectedSkeletonId(null);
      setInspectorTab("muscle");
      focusMuscle(muscleId);
    }

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("dblclick", handleDoubleClick);

    function render() {
      if (disposed) return;
      frameId = window.requestAnimationFrame(render);
      syncAnatomyLayers();
      syncMuscleDisplay();
      syncOrganDisplay();
      syncSkeletonDisplay();
      syncPins();
      controls.update();
      if (skeletonLayer) {
        const labelScale = clamp(camera.position.distanceTo(controls.target) / Math.max(fittedDistance, 0.1), 0.14, 1);
        skeletonLayer.traverse((object) => {
          if (!(object instanceof THREE.Sprite) || !object.name.startsWith("label-")) return;
          const baseScale = object.userData.baseLabelScale as [number, number] | undefined;
          if (baseScale) object.scale.set(baseScale[0] * labelScale, baseScale[1] * labelScale, 1);
        });
      }
      renderer.render(scene, camera);
    }
    frameId = window.requestAnimationFrame(render);

    void loadHorseModel().then((horse) => {
      if (disposed) return;
      horseRoot = horse;
      horse.updateMatrixWorld(true);
      horse.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materialNames = (Array.isArray(object.material) ? object.material : [object.material]).map((material) => material.name).join(" ");
        const meshDescription = `${object.name} ${object.geometry.name} ${materialNames}`;
        let belongsToHair = /mane|forelock|hair/i.test(meshDescription);
        let belongsToTack = /saddle|tack|bridle|reins?|halter|stirrups?/i.test(meshDescription);
        let ancestor: THREE.Object3D | null = object.parent;
        while (ancestor && ancestor !== horse) {
          belongsToHair ||= /mane|forelock|hair/i.test(ancestor.name);
          belongsToTack ||= /saddle|tack|bridle|reins?|halter|stirrups?/i.test(ancestor.name);
          ancestor = ancestor.parent;
        }
        if (belongsToTack && !belongsToHair) accessoryMeshes.push(object);
      });
      const bounds = new THREE.Box3().setFromObject(horse);
      const center = bounds.getCenter(new THREE.Vector3());
      const rawSize = bounds.getSize(new THREE.Vector3());
      const longAxis: Axis = rawSize.x >= rawSize.z ? "x" : "z";
      const sideAxis: Axis = longAxis === "x" ? "z" : "x";
      const head = horse.getObjectByName("head_019");
      const headPosition = head?.getWorldPosition(new THREE.Vector3());
      const headDirection: 1 | -1 = headPosition && headPosition.getComponent(longAxis === "x" ? 0 : 2) < center.getComponent(longAxis === "x" ? 0 : 2) ? -1 : 1;
      const withersPosition = horse.getObjectByName("spine_04_012")?.getWorldPosition(new THREE.Vector3());
      const hoofPosition = horse.getObjectByName("fingers_end_l_0209")?.getWorldPosition(new THREE.Vector3());
      const measuredWithersHeight = withersPosition && hoofPosition ? Math.abs(withersPosition.y - hoofPosition.y) : 0;
      const estimatedWithersHeight = rawSize.y * 0.72;
      const scale = 1.6 / Math.max(0.01, measuredWithersHeight || estimatedWithersHeight);
      horse.scale.setScalar(scale);
      horse.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      horse.updateMatrixWorld(true);

      const normalizedBounds = new THREE.Box3().setFromObject(horse);
      normalizedBounds.getCenter(modelCenter);
      const size = normalizedBounds.getSize(new THREE.Vector3());
      const shadowCanvas = document.createElement("canvas");
      shadowCanvas.width = 128;
      shadowCanvas.height = 128;
      const shadowContext = shadowCanvas.getContext("2d");
      if (shadowContext) {
        const gradient = shadowContext.createRadialGradient(64, 64, 6, 64, 64, 62);
        gradient.addColorStop(0, "rgba(40,52,54,0.24)");
        gradient.addColorStop(0.45, "rgba(40,52,54,0.12)");
        gradient.addColorStop(1, "rgba(40,52,54,0)");
        shadowContext.fillStyle = gradient;
        shadowContext.fillRect(0, 0, 128, 128);
      }
      const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
      const shadowGeometry = new THREE.PlaneGeometry(size.x * 0.84, size.z * 0.84);
      const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false });
      contactShadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
      contactShadow.name = "Soft contact shadow";
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = normalizedBounds.min.y + 0.003;
      contactShadow.renderOrder = 0;
      scene.add(contactShadow);
      modelRadius = normalizedBounds.getBoundingSphere(new THREE.Sphere()).radius;
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
        if (child instanceof THREE.Mesh && child.visible) {
          child.frustumCulled = true;
          modelMeshes.push(child);
        }
      });
      layerMeshes = modelMeshes.map((object) => {
        const mesh = object as THREE.Mesh;
        const ghostMaterial = new THREE.MeshPhysicalMaterial({
          color: "#b9d8e1",
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          side: THREE.FrontSide,
          roughness: 0.2,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          emissive: "#17313a",
          emissiveIntensity: 0.1,
        });
        ghostMaterial.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <output_fragment>",
            `#include <output_fragment>
            float shellRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 3.4);
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.72, 0.87, 0.93), shellRim * 0.92);
            gl_FragColor.a = max(gl_FragColor.a, shellRim * 0.38);`,
          );
        };
        ghostMaterial.customProgramCacheKey = () => "equine-glass-shell-rim-v1";
        return {
          mesh,
          skinMaterial: mesh.material,
          ghostMaterial,
        };
      });

      const axes = modelAxes;
      if (!axes) throw new Error("Could not determine horse model axes.");
      boneNodes = new Map<string, THREE.Bone>();
      horse.traverse((object) => {
        if (object instanceof THREE.Bone) boneNodes.set(object.name, object);
      });
      const muscleGroup = buildEquineMuscleLayer(boneNodes, axes);
      const skeletonAnatomy = buildEquineSkeletonLayer(boneNodes, axes);
      const skeletonGroup = skeletonAnatomy.group;
      builtSkeletonRecords = skeletonAnatomy.records;
      setSkeletonRecords(skeletonAnatomy.records);
      const dimBone = skeletonAnatomy.materials.bone.clone();
      dimBone.transparent = true;
      dimBone.opacity = 0.16;
      dimBone.depthWrite = false;
      const dimCartilage = skeletonAnatomy.materials.cartilage.clone();
      dimCartilage.opacity = 0.12;
      dimCartilage.depthWrite = false;
      const dimCostalCartilage = skeletonAnatomy.materials.costalCartilage.clone();
      dimCostalCartilage.opacity = 0.16;
      dimCostalCartilage.depthWrite = false;
      const dimTooth = skeletonAnatomy.materials.tooth.clone();
      dimTooth.transparent = true;
      dimTooth.opacity = 0.14;
      dimTooth.depthWrite = false;
      const focusBone = Object.fromEntries([
        ["axial", "#719b8e"],
        ["forelimb", "#d29450"],
        ["hindlimb", "#a57493"],
        ["head", "#6688a5"],
      ].map(([group, color]) => {
        const material = skeletonAnatomy.materials.bone.clone();
        material.color.set(color);
        return [group, material];
      })) as Record<string, THREE.MeshStandardMaterial>;
      skeletonDisplayMaterials = { dimBone, dimCartilage, dimCostalCartilage, dimTooth, focusBone };
      skeletonGroup.userData.displayMaterials = [dimBone, dimCartilage, dimCostalCartilage, dimTooth, ...Object.values(focusBone)];
      muscleLayer = muscleGroup;
      skeletonLayer = skeletonGroup;
      const organAnatomy = buildEquineOrganLayer(boneNodes, axes);
      organLayer = organAnatomy.organGroup;
      nerveLayer = organAnatomy.nerveGroup;
      builtOrganRecords = organAnatomy.records;
      setOrganRecords(organAnatomy.records);
      skeletonLayer = skeletonGroup;
      anatomyGroups = [muscleGroup, skeletonGroup, organAnatomy.organGroup, organAnatomy.nerveGroup];
      scene.add(horse);
      scene.add(muscleGroup, skeletonGroup, organAnatomy.organGroup, organAnatomy.nerveGroup);
      markerGroup = new THREE.Group();
      scene.add(markerGroup);
      markerGroup.add(draftMarker);

      cameraReady = true;
      cameraForView(currentView);
      activeAnatomySignature = "";
      activeOrganDisplaySignature = "";
      activeSkeletonDisplaySignature = "";
      syncAnatomyLayers();
      syncOrganDisplay();
      syncSkeletonDisplay();
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
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      controls.dispose();
      renderer.forceContextLoss();
      renderer.dispose();
      backdropTexture.dispose();
      haloGeometry.dispose();
      coreGeometry.dispose();
      draftHaloGeometry.dispose();
      draftCoreGeometry.dispose();
      contactShadow?.geometry.dispose();
      if (contactShadow?.material instanceof THREE.MeshBasicMaterial) {
        contactShadow.material.map?.dispose();
        contactShadow.material.dispose();
      }
      draftMarker.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) child.material.dispose();
      });
      markerObjects.forEach((markerPin) => markerPin.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.Material) child.material.dispose();
      }));
      const disposedGeometries = new Set<THREE.BufferGeometry>();
      const disposedMaterials = new Set<THREE.Material>();
      anatomyGroups.forEach((group) => group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (!disposedGeometries.has(child.geometry)) {
          child.geometry.dispose();
          disposedGeometries.add(child.geometry);
        }
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (disposedMaterials.has(material)) return;
          material.dispose();
          disposedMaterials.add(material);
        });
      }));
      layerMeshes.forEach((entry) => entry.ghostMaterial.dispose());
      const skeletonDisplayAssets = skeletonLayer?.userData.displayMaterials as THREE.Material[] | undefined;
      skeletonDisplayAssets?.forEach((material) => material.dispose());
      const skeletonBaseMaterials = skeletonLayer?.userData.skeletonMaterials as { bone: THREE.Material; cartilage: THREE.Material; costalCartilage?: THREE.Material; tooth: THREE.Material } | undefined;
      if (skeletonBaseMaterials) {
        Object.values(skeletonBaseMaterials).forEach((material) => material.dispose());
      }
      const skeletonLabelMaterials = skeletonLayer?.userData.ownedLabelMaterials as THREE.Material[] | undefined;
      skeletonLabelMaterials?.forEach((material) => material.dispose());
      const skeletonTextures = skeletonLayer?.userData.ownedTextures as THREE.Texture[] | undefined;
      skeletonTextures?.forEach((texture) => texture.dispose());
      const muscleTextures = muscleLayer?.userData.ownedTextures as THREE.Texture[] | undefined;
      muscleTextures?.forEach((texture) => texture.dispose());
      actionsRef.current = { setView: () => {}, zoom: () => {}, reset: () => {}, focusMuscle: () => {}, focusOrgan: () => {}, focusSkeleton: () => {} };
      renderer.domElement.remove();
    };
  }, []);

  const selectedMarker = markers.find((marker) => marker.id === selectedId);
  const selectedMuscle = equineMuscles.find((muscle) => muscle.id === selectedMuscleId);
  const hoveredSkeletonRecord = hoveredSkeletonTooltip
    ? skeletonRecords.find((record) => record.id === hoveredSkeletonTooltip.id) ?? null
    : null;
  const hoveredSkeletonName = hoveredSkeletonRecord && /^c[1-7]$/.test(hoveredSkeletonRecord.id)
    ? `Đốt sống cổ ${hoveredSkeletonRecord.name}`
    : hoveredSkeletonRecord?.name;
  const hoveredSkeletonLatin = hoveredSkeletonRecord && /^c[1-7]$/.test(hoveredSkeletonRecord.id)
    ? `Cervical vertebrae · ${hoveredSkeletonRecord.latin}`
    : hoveredSkeletonRecord?.latin;
  const normalizedMuscleSearch = muscleFilters.search.trim().toLocaleLowerCase("vi");
  const filteredMuscles = equineMuscles.filter((muscle) => {
    const matchesGroup = muscleFilters.group === "all" || muscle.group === muscleFilters.group;
    const matchesLayer = muscle.layer === "superficial" ? muscleFilters.superficial : muscleFilters.deep;
    const searchable = `${muscle.vi} ${muscle.latin} ${muscle.origin.label} ${muscle.insertion.label}`.toLocaleLowerCase("vi");
    return matchesGroup && matchesLayer && (!normalizedMuscleSearch || searchable.includes(normalizedMuscleSearch));
  });
  const locatedCount = markers.filter(hasCoordinates).length;
  const enabledAnatomyLayers = anatomyLayers.filter((layer) => layer.id !== "skin" && anatomyVisibility[layer.id]);
  const allAnatomyVisible = enabledAnatomyLayers.length === anatomyLayers.length - 1;

  return (
    <section className="overflow-hidden rounded-lg border border-equine-line bg-white p-3 shadow-sm sm:p-5" aria-label="Mô hình 3D theo dõi chấn thương ngựa">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-equine-teal" />
            <h4 className="font-semibold tracking-tight text-equine-navy">Mô hình ngựa 3D</h4>
            <span className="rounded-full border border-equine-line bg-equine-paper px-2 py-0.5 text-[10px] font-semibold text-equine-muted">{locatedCount} điểm đã đánh dấu</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["left", "right", "front", "back", "top"] as const).map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={view === preset}
              aria-label={`Góc nhìn ${viewPresetLabels[preset]}`}
              title={`Góc nhìn ${viewPresetLabels[preset]}`}
              className={`rounded-lg px-2.5 py-1.5 text-xs transition ${view === preset ? "bg-equine-mist font-semibold text-equine-navy" : "text-equine-muted hover:bg-equine-paper"}`}
              onClick={() => actionsRef.current.setView(preset)}
            >
              {viewPresetLabels[preset]}
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-equine-line sm:block" />
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-equine-line bg-white text-lg text-equine-navy hover:bg-equine-mist" aria-label="Thu nhỏ mô hình" onClick={() => actionsRef.current.zoom(1.12)}>−</button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-equine-line bg-white text-lg text-equine-navy hover:bg-equine-mist" aria-label="Phóng to mô hình" onClick={() => actionsRef.current.zoom(0.88)}>+</button>
          <button type="button" className="rounded-lg border border-equine-line bg-white px-2.5 py-1.5 text-xs text-equine-muted hover:bg-equine-mist" onClick={() => actionsRef.current.reset()}>Đặt lại góc</button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Chọn lớp giải phẫu">
        <span className="mr-1 text-xs font-semibold text-equine-muted">Lớp</span>
        <button
          type="button"
          aria-pressed={allAnatomyVisible}
          title="Bật hoặc tắt đồng thời xương, cơ và nội tạng"
          onClick={() => {
            const visible = !allAnatomyVisible;
            setAnatomyVisibility((current) => ({ ...current, skeleton: visible, organs: visible, muscle: visible }));
          }}
          className={`rounded-lg border px-3 py-1.5 text-xs transition ${allAnatomyVisible ? "border-primary bg-primary font-semibold text-white" : "border-equine-line bg-white font-semibold text-slate-700 hover:border-primary/50 hover:bg-slate-50"}`}
        >
          Tổng thể
        </button>
        {anatomyLayers.map((layer) => (
          <button
            key={layer.id}
            type="button"
            aria-pressed={anatomyVisibility[layer.id]}
            onClick={() => {
              const nextVisible = !anatomyVisibility[layer.id];
              setAnatomyVisibility((current) => ({ ...current, [layer.id]: nextVisible }));
              if (nextVisible && layer.id === "organs") setInspectorTab("organs");
              if (nextVisible && layer.id === "muscle") setInspectorTab("muscle");
              if (nextVisible && layer.id === "skeleton") setInspectorTab("skeleton");
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${anatomyVisibility[layer.id] ? "border-primary bg-primary font-semibold text-white" : "border-equine-line bg-white text-slate-600 hover:border-primary/50 hover:bg-slate-50 hover:text-slate-900"}`}
          >
            {layer.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className={`relative min-w-0 overflow-hidden rounded-xl border border-equine-line bg-equine-paper shadow-sm ${placementMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}>
          <div ref={mountRef} className="h-[285px] w-full sm:h-[410px]" />
          {anatomyVisibility.skeleton && skeletonRecords.length === 0 && !loading && !loadError && (
            <div className="pointer-events-none absolute inset-x-3 top-3 z-[4] rounded-lg border border-equine-line bg-white/90 px-3 py-2 text-center text-xs font-medium text-slate-600">
              Không tìm thấy các điểm rig cần thiết để dựng cột sống minh họa.
            </div>
          )}
          {hoveredSkeletonRecord && hoveredSkeletonTooltip && anatomyVisibility.skeleton && !placementMode && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-[6] max-w-[220px] rounded-md border border-equine-line bg-white px-2.5 py-1.5 text-[11px] text-equine-navy shadow-md"
              style={{ left: hoveredSkeletonTooltip.x, top: hoveredSkeletonTooltip.y }}
            >
              <span className="block font-semibold">{hoveredSkeletonName}</span>
              <span className="block italic text-slate-500">{hoveredSkeletonLatin}</span>
            </div>
          )}
          {loading && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/60 text-sm font-medium text-slate-600">Đang tải mô hình ngựa 3D…</div>}
          {loadError && <div role="alert" className="absolute inset-0 grid place-items-center bg-white/90 p-6 text-center text-sm text-rose-700">Không tải được mô hình 3D. {loadError}</div>}
          {placementMode && <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-full border border-primary/30 bg-blue-50 px-3 py-2 text-[11px] font-bold text-equine-navy"><span className="h-2 w-2 rounded-full bg-primary" /> Chọn vị trí trên ngựa</div>}
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 flex gap-1 rounded-lg border border-equine-line bg-white p-1" role="tablist" aria-label="Bảng giải phẫu">
            <button type="button" role="tab" aria-selected={inspectorTab === "skeleton"} onClick={() => { setInspectorTab("skeleton"); setAnatomyVisibility((current) => ({ ...current, skeleton: true })); }} className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${inspectorTab === "skeleton" ? "!bg-primary !text-white" : "text-slate-600 hover:bg-slate-100"}`}>X&#x01B0;&#x01A1;ng</button>
            <button type="button" role="tab" aria-selected={inspectorTab === "muscle"} onClick={() => { setInspectorTab("muscle"); setAnatomyVisibility((current) => ({ ...current, muscle: true })); }} className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${inspectorTab === "muscle" ? "!bg-primary !text-white" : "text-slate-600 hover:bg-slate-100"}`}>Cơ</button>
            <button type="button" role="tab" aria-selected={inspectorTab === "organs"} onClick={() => { setInspectorTab("organs"); setAnatomyVisibility((current) => ({ ...current, organs: true })); }} className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold ${inspectorTab === "organs" ? "!bg-primary !text-white" : "text-slate-600 hover:bg-slate-100"}`}>Nội tạng</button>
          </div>
          {inspectorTab === "skeleton" ? (
            <SkeletonAnatomyPanel
              records={skeletonRecords}
              selectedId={selectedSkeletonId}
              onSelect={(id) => {
                setSelectedSkeletonId(id);
                setSelectedOrganId(null);
                setSelectedMuscleId(null);
                setAnatomyVisibility((current) => ({ ...current, skeleton: true }));
                actionsRef.current.focusSkeleton(id);
              }}
              explodeView={explodeView}
              setExplodeView={setExplodeView}
              showLabels={showSkeletonLabels}
              setShowLabels={setShowSkeletonLabels}
              jawOpen={jawOpen}
              setJawOpen={setJawOpen}
            />
          ) : inspectorTab === "organs" ? (
            <OrganAnatomyPanel
              records={organRecords}
              systems={organSystems}
              setSystems={setOrganSystems}
              selectedId={selectedOrganId}
              onSelect={(id) => setSelectedOrganId(id)}
            />
          ) : (
            <MuscleAnatomyPanel
              filters={muscleFilters}
              setFilters={setMuscleFilters}
              muscles={filteredMuscles}
              selectedMuscle={selectedMuscle}
              selectedId={selectedMuscleId}
              onSelect={(id) => {
                setSelectedMuscleId(id);
                setSelectedOrganId(null);
                setAnatomyVisibility((current) => ({ ...current, muscle: true }));
                actionsRef.current.focusMuscle(id);
              }}
            />
          )}
        </div>
      </div>

      {selectedMarker && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-equine-line bg-white px-3 py-2 text-xs text-equine-muted">
        <span className="font-semibold text-equine-navy">{selectedMarker.body_part}</span>
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
