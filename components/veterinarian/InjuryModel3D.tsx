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
type AnatomyLayer = "skin" | "muscle" | "skeleton" | "organs";
const anatomyLayers: { id: AnatomyLayer; label: string }[] = [
  { id: "skin", label: "Da / lông" },
  { id: "muscle", label: "Hệ cơ" },
  { id: "skeleton", label: "Hệ xương" },
  { id: "organs", label: "Nội tạng" },
];
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
  const [anatomyLayer, setAnatomyLayer] = useState<AnatomyLayer>("skin");
  const anatomyLayerRef = useRef<AnatomyLayer>("skin");
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
    let layerMeshes: { mesh: THREE.Mesh; skinMaterial: THREE.Material | THREE.Material[]; ghostMaterial: THREE.MeshStandardMaterial }[] = [];
    let anatomyGroups: THREE.Group[] = [];
    let muscleLayer: THREE.Group | null = null;
    let skeletonLayer: THREE.Group | null = null;
    let organLayer: THREE.Group | null = null;
    let activeAnatomyLayer: AnatomyLayer | null = null;
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
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
    } catch {
      setLoadError("Trình duyệt không cấp được WebGL cho mô hình 3D. Hãy tải lại trang hoặc đóng bớt tab đang dùng đồ họa 3D.");
      setLoading(false);
      return () => { disposed = true; };
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = "block h-full w-full touch-none";
    renderer.domElement.setAttribute("aria-label", "Mô hình ngựa 3D tương tác để xem và đánh dấu vị trí chấn thương");
    const handleContextLost = () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      actionsRef.current = { setSide: () => {}, zoom: () => {}, reset: () => {} };
      setLoadError("WebGL đã bị trình duyệt dừng. Hãy tải lại trang để mở lại mô hình 3D.");
      setLoading(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
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

    function syncAnatomyLayer() {
      if (!layerMeshes.length) return;
      const nextLayer = anatomyLayerRef.current;
      if (activeAnatomyLayer === nextLayer) return;
      for (const entry of layerMeshes) {
        entry.mesh.material = nextLayer === "skin" ? entry.skinMaterial : entry.ghostMaterial;
        entry.mesh.renderOrder = nextLayer === "skin" ? 0 : 1;
        entry.ghostMaterial.opacity = nextLayer === "skeleton" ? 0.07 : 0.2;
      }
      if (muscleLayer) muscleLayer.visible = nextLayer === "muscle";
      if (skeletonLayer) skeletonLayer.visible = nextLayer === "skeleton";
      if (organLayer) organLayer.visible = nextLayer === "organs";
      activeAnatomyLayer = nextLayer;
    }

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
      const referenceSide = modelAxes.longAxis === "x" ? -modelAxes.headDirection : modelAxes.headDirection;
      const sign = nextSide === "near" ? referenceSide : -referenceSide;
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
      syncAnatomyLayer();
      syncPins();
      controls.update();
      renderer.render(scene, camera);
    }
    frameId = window.requestAnimationFrame(render);

    void loadHorseModel().then((horse) => {
      if (disposed) return;
      horse.updateMatrixWorld(true);
      horse.traverse((object) => {
        if (object instanceof THREE.Mesh && /saddle|tack/i.test(`${object.name} ${object.geometry.name}`)) object.visible = false;
      });
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
        if (child instanceof THREE.Mesh && child.visible) {
          child.frustumCulled = true;
          modelMeshes.push(child);
        }
      });
      layerMeshes = modelMeshes.map((object) => {
        const mesh = object as THREE.Mesh;
        return {
          mesh,
          skinMaterial: mesh.material,
          ghostMaterial: new THREE.MeshStandardMaterial({
            color: "#aab3b4",
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            roughness: 0.92,
            side: THREE.DoubleSide,
          }),
        };
      });

      const axes = modelAxes;
      if (!axes) throw new Error("Could not determine horse model axes.");
      const boneNodes = new Map<string, THREE.Bone>();
      horse.traverse((object) => {
        if (object instanceof THREE.Bone) boneNodes.set(object.name, object);
      });
      const bonePosition = (name: string) => boneNodes.get(name)?.getWorldPosition(new THREE.Vector3()) ?? null;
      const muscleGroup = new THREE.Group();
      muscleGroup.name = "Equine muscle layer";
      const skeletonGroup = new THREE.Group();
      skeletonGroup.name = "Equine skeleton layer";
      const organGroup = new THREE.Group();
      organGroup.name = "Equine organ layer";
      muscleLayer = muscleGroup;
      skeletonLayer = skeletonGroup;
      organLayer = organGroup;
      anatomyGroups = [muscleGroup, skeletonGroup, organGroup];

      const boneMaterial = new THREE.MeshStandardMaterial({ color: "#e8dfcf", roughness: 0.78, metalness: 0.02 });
      const boneCylinder = new THREE.CylinderGeometry(0.72, 1, 1, 14, 1);
      const boneSphere = new THREE.SphereGeometry(1, 18, 14);
      const up = new THREE.Vector3(0, 1, 0);
      const addBoneSegment = (start: THREE.Vector3, end: THREE.Vector3, radius: number) => {
        const direction = end.clone().sub(start);
        const length = direction.length();
        if (length < 0.012) return;
        const segment = new THREE.Mesh(boneCylinder, boneMaterial);
        segment.position.copy(start).add(end).multiplyScalar(0.5);
        segment.scale.set(radius, length, radius);
        segment.quaternion.setFromUnitVectors(up, direction.normalize());
        segment.renderOrder = 3;
        skeletonGroup.add(segment);
      };
      const addBoneJoint = (point: THREE.Vector3, radius: number, verticalScale = 1.1) => {
        const joint = new THREE.Mesh(boneSphere, boneMaterial);
        joint.position.copy(point);
        joint.scale.set(radius * 1.35, radius * verticalScale, radius * 1.35);
        joint.renderOrder = 3;
        skeletonGroup.add(joint);
      };
      const addEllipsoidBone = (point: THREE.Vector3, longitudinal: number, vertical: number, lateral: number) => {
        const bone = new THREE.Mesh(boneSphere, boneMaterial);
        bone.position.copy(point);
        bone.scale.setComponent(axes.longAxis === "x" ? 0 : 2, longitudinal);
        bone.scale.y = vertical;
        bone.scale.setComponent(axes.sideAxis === "x" ? 0 : 2, lateral);
        bone.renderOrder = 3;
        skeletonGroup.add(bone);
      };
      const addOrientedEllipsoid = (start: THREE.Vector3, end: THREE.Vector3, width: number, depth: number) => {
        const direction = end.clone().sub(start);
        const length = direction.length();
        if (length < 0.025) return;
        const bone = new THREE.Mesh(boneSphere, boneMaterial);
        bone.position.copy(start).add(end).multiplyScalar(0.5);
        bone.scale.set(width, length * 0.56, depth);
        bone.quaternion.setFromUnitVectors(up, direction.normalize());
        bone.renderOrder = 3;
        skeletonGroup.add(bone);
      };
      const sideVector = new THREE.Vector3();
      sideVector.setComponent(axes.sideAxis === "x" ? 0 : 2, 1);
      const longitudinalVector = new THREE.Vector3();
      longitudinalVector.setComponent(axes.longAxis === "x" ? 0 : 2, -axes.headDirection);
      const heightVector = new THREE.Vector3(0, 1, 0);

      const boneChains: { names: string[]; radii: number[] }[] = [
        {
          names: ["pelvis_08", "spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012", "neck_01_014", "neck_02_015", "neck_03_016", "neck_04_017", "neck_05_018", "head_019"],
          radii: [0.052, 0.044, 0.042, 0.04, 0.038, 0.035, 0.032, 0.03, 0.028, 0.027],
        },
        { names: ["clavicle_l_0203", "upperarm_l_0204", "lowerarm_l_0205", "hand_l_0206"], radii: [0.05, 0.043, 0.034] },
        { names: ["clavicle_r_0269", "upperarm_r_0270", "lowerarm_r_0271", "hand_r_0272"], radii: [0.05, 0.043, 0.034] },
        { names: ["hips_0366", "upperleg_l_0405", "lowerleg_l_0406", "foot_l_0407", "toes_01_l_0408", "toes_02_l_0409"], radii: [0.055, 0.052, 0.038, 0.03, 0.02] },
        { names: ["hips_0366", "upperleg_r_0474", "lowerleg_r_0475", "foot_r_0476", "toes_01_r_0477", "toes_02_r_0478"], radii: [0.055, 0.052, 0.038, 0.03, 0.02] },
        { names: ["tail_01_0367", "tail_02_0368", "tail_03_0369", "tail_04_0370", "tail_05_0371"], radii: [0.025, 0.022, 0.018, 0.014] },
      ];
      for (const chain of boneChains) {
        for (let index = 0; index < chain.names.length - 1; index += 1) {
          const start = bonePosition(chain.names[index]);
          const end = bonePosition(chain.names[index + 1]);
          if (!start || !end) continue;
          const radius = chain.radii[index] ?? 0.025;
          addBoneSegment(start, end, radius);
          addBoneJoint(start, radius, index < 2 ? 1.25 : 1.05);
        }
        const tip = bonePosition(chain.names[chain.names.length - 1]);
        const tipRadius = chain.radii[chain.radii.length - 1] ?? 0.025;
        if (tip) addBoneJoint(tip, tipRadius * 0.82, 1.05);
      }

      const thoracicPoints = ["spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012"]
        .map(bonePosition)
        .filter((point): point is THREE.Vector3 => Boolean(point));
      const vertebraeAlong = (anchors: THREE.Vector3[], count: number) => {
        if (anchors.length < 2) return [] as THREE.Vector3[];
        const curve = new THREE.CatmullRomCurve3(anchors);
        return Array.from({ length: count }, (_, index) => curve.getPoint((index + 0.35) / (count + 0.7)));
      };
      const addVertebralRow = (points: THREE.Vector3[], width: number, processHeight: number) => {
        for (const point of points) {
          addEllipsoidBone(point, width * 0.68, width * 0.72, width * 0.82);
          const spinousTip = point.clone().addScaledVector(heightVector, processHeight);
          addBoneSegment(point, spinousTip, width * 0.2);
          for (const sign of [-1, 1]) {
            const transverseTip = point.clone().addScaledVector(sideVector, sign * axes.halfWidth * 0.055);
            addBoneSegment(point, transverseTip, width * 0.16);
          }
        }
      };

      const thoracicVertebrae = vertebraeAlong(thoracicPoints, 18);
      addVertebralRow(thoracicVertebrae, 0.042, axes.halfHeight * 0.13);
      const lumbarStart = bonePosition("pelvis_08");
      const lumbarEnd = bonePosition("spine_01_09");
      if (lumbarStart && lumbarEnd) addVertebralRow(vertebraeAlong([lumbarStart, lumbarEnd], 6), 0.047, axes.halfHeight * 0.11);
      const cervicalPoints = ["neck_01_014", "neck_02_015", "neck_03_016", "neck_04_017", "neck_05_018"]
        .map(bonePosition)
        .filter((point): point is THREE.Vector3 => Boolean(point));
      addVertebralRow(vertebraeAlong(cervicalPoints, 7), 0.035, axes.halfHeight * 0.075);

      if (thoracicVertebrae.length > 1) {
        const sternalPoints: THREE.Vector3[] = [];
        const ribCount = 18;
        for (let rib = 0; rib < ribCount; rib += 1) {
          const root = thoracicVertebrae[rib];
          const progress = rib / (ribCount - 1);
          const ribWidth = axes.halfWidth * (0.56 + Math.sin(progress * Math.PI) * 0.1);
          const caudalOffset = axes.halfLength * (0.018 + progress * 0.022);
          const sternum = root.clone()
            .addScaledVector(longitudinalVector, caudalOffset)
            .addScaledVector(heightVector, -axes.halfHeight * (0.36 + Math.sin(progress * Math.PI) * 0.055));
          sternalPoints.push(sternum);
          for (const sign of [-1, 1]) {
            const curve = new THREE.CatmullRomCurve3([
              root.clone().addScaledVector(heightVector, -axes.halfHeight * 0.012),
              root.clone().addScaledVector(longitudinalVector, caudalOffset * 0.25).addScaledVector(sideVector, sign * ribWidth * 0.3).addScaledVector(heightVector, -axes.halfHeight * 0.09),
              root.clone().addScaledVector(longitudinalVector, caudalOffset * 0.7).addScaledVector(sideVector, sign * ribWidth * 0.68).addScaledVector(heightVector, -axes.halfHeight * 0.24),
              sternum.clone().addScaledVector(sideVector, sign * axes.halfWidth * 0.025),
            ]);
            const ribBone = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.013, 8, false), boneMaterial);
            ribBone.renderOrder = 3;
            skeletonGroup.add(ribBone);
          }
        }
        const sternumCurve = new THREE.CatmullRomCurve3(sternalPoints);
        const sternumBone = new THREE.Mesh(new THREE.TubeGeometry(sternumCurve, 36, 0.023, 10, false), boneMaterial);
        sternumBone.renderOrder = 3;
        skeletonGroup.add(sternumBone);
      }

      const pelvisPoint = bonePosition("hips_0366") ?? bonePosition("pelvis_08");
      if (pelvisPoint) {
        addEllipsoidBone(pelvisPoint, axes.halfLength * 0.105, axes.halfHeight * 0.09, axes.halfWidth * 0.16);
        for (const name of ["upperleg_l_0405", "upperleg_r_0474"]) {
          const legRoot = bonePosition(name);
          if (legRoot) addOrientedEllipsoid(pelvisPoint, legRoot, axes.halfWidth * 0.13, axes.halfWidth * 0.075);
        }
      }
      for (const name of ["clavicle_l_0203", "clavicle_r_0269"]) {
        const scapula = bonePosition(name);
        const shoulder = bonePosition(name.includes("_l_") ? "upperarm_l_0204" : "upperarm_r_0270");
        if (scapula && shoulder) addOrientedEllipsoid(scapula, shoulder, axes.halfWidth * 0.15, axes.halfWidth * 0.065);
      }

      const headPoint = bonePosition("head_019");
      const jawPoint = bonePosition("jaw_020");
      const muzzlePoint = bonePosition("jaw_end_021");
      if (headPoint) {
        addEllipsoidBone(headPoint, 0.085, 0.09, 0.065);
        if (muzzlePoint) {
          addOrientedEllipsoid(headPoint, muzzlePoint, 0.052, 0.047);
          if (jawPoint) addOrientedEllipsoid(jawPoint, muzzlePoint, 0.026, 0.03);
        } else if (jawPoint) {
          addBoneSegment(headPoint.clone().addScaledVector(heightVector, -0.035), jawPoint, 0.019);
        }
        if (jawPoint) addBoneJoint(jawPoint, 0.021);
      }

      const tailAnchors = ["tail_01_0367", "tail_02_0368", "tail_03_0369", "tail_04_0370", "tail_05_0371"]
        .map(bonePosition)
        .filter((point): point is THREE.Vector3 => Boolean(point));
      if (tailAnchors.length > 1) {
        addVertebralRow(vertebraeAlong(tailAnchors, 15), 0.022, axes.halfHeight * 0.025);
      }

      const muscleGeometry = new THREE.SphereGeometry(1, 20, 14);
      const muscleColors = ["#a9434f", "#c75a55", "#9e3b49", "#d27a63"];
      let muscleIndex = 0;
      const addMuscle = (from: string, to: string, width: number, sideOffset = 0, heightOffset = 0) => {
        const start = bonePosition(from);
        const end = bonePosition(to);
        if (!start || !end) return;
        start.addScaledVector(sideVector, sideOffset * axes.halfWidth);
        end.addScaledVector(sideVector, sideOffset * axes.halfWidth);
        start.y += heightOffset * axes.halfHeight;
        end.y += heightOffset * axes.halfHeight;
        const direction = end.clone().sub(start);
        const length = direction.length();
        if (length < 0.025) return;
        const radius = Math.max(axes.halfWidth * width, 0.035);
        const muscle = new THREE.Mesh(
          muscleGeometry,
          new THREE.MeshStandardMaterial({ color: muscleColors[muscleIndex++ % muscleColors.length], roughness: 0.68 }),
        );
        muscle.position.copy(start).add(end).multiplyScalar(0.5);
        muscle.scale.set(radius, length * 0.62 + radius * 0.3, radius * 0.86);
        muscle.quaternion.setFromUnitVectors(up, direction.normalize());
        muscle.renderOrder = 3;
        muscleGroup.add(muscle);
      };
      for (const sign of [-1, 1]) {
        addMuscle("spine_01_09", "spine_02_010", 0.18, sign * 0.28, 0.05);
        addMuscle("spine_02_010", "spine_03_011", 0.2, sign * 0.28, 0.05);
        addMuscle("spine_03_011", "spine_04_012", 0.18, sign * 0.28, 0.05);
        addMuscle("neck_01_014", "neck_03_016", 0.13, sign * 0.2, 0.01);
        addMuscle("neck_03_016", "neck_05_018", 0.1, sign * 0.18, -0.035);
      }
      for (const [shoulder, upper, lower, foot] of [
        ["clavicle_l_0203", "upperarm_l_0204", "lowerarm_l_0205", "hand_l_0206"],
        ["clavicle_r_0269", "upperarm_r_0270", "lowerarm_r_0271", "hand_r_0272"],
        ["hips_0366", "upperleg_l_0405", "lowerleg_l_0406", "foot_l_0407"],
        ["hips_0366", "upperleg_r_0474", "lowerleg_r_0475", "foot_r_0476"],
      ]) {
        addMuscle(shoulder, upper, 0.2);
        addMuscle(upper, lower, 0.15);
        addMuscle(lower, foot, 0.1);
      }

      const bodyPoint = (longitudinal: number, height: number, lateral: number) => {
        const point = new THREE.Vector3();
        point.setComponent(axes.longAxis === "x" ? 0 : 2, longitudinal * axes.halfLength * axes.headDirection);
        point.y = height * axes.halfHeight;
        point.setComponent(axes.sideAxis === "x" ? 0 : 2, lateral * axes.halfWidth);
        return point;
      };
      const addOrgan = (
        name: string,
        color: string,
        location: [number, number, number],
        proportions: [number, number, number],
        rotation = 0,
      ) => {
        const organ = new THREE.Mesh(
          new THREE.SphereGeometry(1, 24, 18),
          new THREE.MeshStandardMaterial({ color, roughness: 0.72, transparent: true, opacity: 0.92, depthWrite: false, depthTest: false }),
        );
        organ.name = name;
        organ.position.copy(bodyPoint(...location));
        organ.scale.setComponent(axes.longAxis === "x" ? 0 : 2, axes.halfLength * proportions[0]);
        organ.scale.y = axes.halfHeight * proportions[1];
        organ.scale.setComponent(axes.sideAxis === "x" ? 0 : 2, axes.halfWidth * proportions[2]);
        organ.rotation.y = rotation;
        organ.renderOrder = 4;
        organGroup.add(organ);
      };
      addOrgan("Lung left", "#ba6470", [0.13, 0.02, -0.31], [0.27, 0.2, 0.29], -0.12);
      addOrgan("Lung right", "#a94e60", [0.13, 0.02, 0.31], [0.27, 0.2, 0.29], 0.12);
      addOrgan("Heart", "#a72e43", [0.08, -0.12, 0.04], [0.12, 0.15, 0.14]);
      addOrgan("Liver", "#87503d", [-0.08, -0.01, -0.09], [0.18, 0.15, 0.23], -0.18);
      addOrgan("Stomach", "#d08b70", [-0.2, -0.13, 0.16], [0.16, 0.13, 0.2], 0.24);
      addOrgan("Kidney left", "#8f4651", [-0.23, 0.05, -0.24], [0.075, 0.08, 0.08], -0.24);
      addOrgan("Kidney right", "#9f4f58", [-0.23, 0.05, 0.24], [0.075, 0.08, 0.08], 0.24);
      for (let loop = 0; loop < 4; loop += 1) {
        const points = Array.from({ length: 9 }, (_, index) => {
          const t = index / 8;
          const wave = Math.sin(t * Math.PI * 2 + loop * 0.78);
          return bodyPoint(-0.13 - t * 0.25, -0.25 + wave * 0.035, wave * 0.22);
        });
        const intestine = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, axes.halfWidth * 0.045, 8, false),
          new THREE.MeshStandardMaterial({ color: loop % 2 ? "#d99b78" : "#e5ac85", roughness: 0.75, transparent: true, opacity: 0.92, depthWrite: false, depthTest: false }),
        );
        intestine.name = "Intestinal loop";
        intestine.renderOrder = 4;
        organGroup.add(intestine);
      }

      scene.add(horse);
      scene.add(muscleGroup, skeletonGroup, organGroup);
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
      activeAnatomyLayer = null;
      syncAnatomyLayer();
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
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      controls.dispose();
      renderer.forceContextLoss();
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

      <div className="mt-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Chọn lớp giải phẫu">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Lớp giải phẫu</span>
        {anatomyLayers.map((layer) => (
          <button
            key={layer.id}
            type="button"
            aria-pressed={anatomyLayer === layer.id}
            onClick={() => { anatomyLayerRef.current = layer.id; setAnatomyLayer(layer.id); }}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${anatomyLayer === layer.id ? "border-[#446b72] bg-[#446b72] font-semibold text-white shadow-sm" : "border-slate-200 bg-white/85 text-slate-600 hover:border-[#9eb8b8] hover:text-[#36566a]"}`}
          >
            {layer.label}
          </button>
        ))}
      </div>
      {anatomyLayer !== "skin" && (
        <p className="mt-1 text-[10px] text-slate-500">
          {anatomyLayer === "muscle"
            ? "Lớp cơ mô phỏng theo rig: cổ, lưng, vai và các chi."
            : anatomyLayer === "skeleton"
              ? "Lớp xương bám theo rig 3D, gồm đốt sống, 18 đôi xương sườn và các xương chi; đây là mô phỏng tham khảo."
              : "Lớp nội tạng hiển thị nổi trên lớp thân để dễ quan sát: phổi, tim, gan, dạ dày, thận và ruột."}
        </p>
      )}
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
