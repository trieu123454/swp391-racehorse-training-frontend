import * as THREE from "three";
import muscleJson from "@/data/muscles.json";

export type MuscleGroupId = "head-neck" | "trunk" | "forelimb" | "hindlimb" | "tendon-ligament";
export type MuscleLayerId = "superficial" | "deep";
export type MuscleKind = "muscle" | "tendon" | "ligament" | "fascia";
export type MuscleShape = "bundle" | "sheet" | "fan" | "tendon";
export type MuscleSide = "bilateral" | "midline";
export type MuscleGroupFilter = MuscleGroupId | "all";
export type MuscleFilters = { group: MuscleGroupFilter; superficial: boolean; deep: boolean; search: string };

export type MuscleAnchor = {
  bone: string;
  label: string;
  offset: [number, number, number];
};

export type EquineMuscleRecord = {
  id: string;
  vi: string;
  latin: string;
  group: MuscleGroupId;
  layer: MuscleLayerId;
  kind: MuscleKind;
  shape: MuscleShape;
  side: MuscleSide;
  repeat?: "ribs";
  origin: MuscleAnchor;
  insertion: MuscleAnchor;
  radius: number;
  color: string;
  function: string;
  commonInjuries?: string;
  synergists: string[];
  antagonists: string[];
  note?: string;
};

export type MuscleAxes = {
  longAxis: "x" | "z";
  sideAxis: "x" | "z";
  headDirection: 1 | -1;
  halfLength: number;
  halfHeight: number;
  halfWidth: number;
};

export const equineMuscles = muscleJson as EquineMuscleRecord[];

const sideBones: Record<string, { left: string; right: string }> = {
  scapula: { left: "clavicle_l_0203", right: "clavicle_r_0269" },
  humerus: { left: "upperarm_l_0204", right: "upperarm_r_0270" },
  radius: { left: "lowerarm_l_0205", right: "lowerarm_r_0271" },
  carpus: { left: "hand_l_0206", right: "hand_r_0272" },
  foreFetlock: { left: "fingers_01_l_0187", right: "fingers_01_r_0273" },
  forePastern: { left: "fingers_02_l_0208", right: "fingers_02_r_0274" },
  foreHoof: { left: "fingers_end_l_0209", right: "fingers_end_r_0275" },
  femur: { left: "upperleg_l_0405", right: "upperleg_r_0474" },
  tibia: { left: "lowerleg_l_0406", right: "lowerleg_r_0475" },
  hock: { left: "foot_l_0407", right: "foot_r_0476" },
  hindFetlock: { left: "toes_01_l_0408", right: "toes_01_r_0477" },
  hindPastern: { left: "toes_02_l_0409", right: "toes_02_r_0478" },
  hindHoof: { left: "toes_end_l_0410", right: "toes_end_r_0479" },
  eye: { left: "eye_l_059", right: "eye_r_063" },
  ear: { left: "ear_01_l_051", right: "ear_01_r_055" },
};

const fixedBones: Record<string, string> = {
  poll: "head_019",
  mandible: "jaw_020",
  muzzle: "jaw_end_021",
  atlas: "neck_01_014",
  cervical2: "neck_02_015",
  cervical4: "neck_04_017",
  cervical5: "neck_05_018",
  withers: "spine_04_012",
  thoracic2: "spine_02_010",
  thoracic3: "spine_03_011",
  lumbar: "spine_01_09",
  pelvis: "pelvis_08",
  hip: "hips_0366",
  sternum: "spine_04_012",
};

const longAxisIndex = (axes: MuscleAxes) => axes.longAxis === "x" ? 0 : 2;
const sideAxisIndex = (axes: MuscleAxes) => axes.sideAxis === "x" ? 0 : 2;

function createFiberNormalMap() {
  const width = 64;
  const height = 32;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const ridge = Math.sin((x / width) * Math.PI * 2 * 12) * 13;
      data[offset] = 128 + ridge;
      data[offset + 1] = 128;
      data[offset + 2] = 250;
      data[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function resolveBoneName(name: string, side: "left" | "right") {
  return sideBones[name]?.[side] ?? fixedBones[name] ?? name;
}

function sideSignFor(side: "left" | "right", boneNodes: Map<string, THREE.Bone>, axes: MuscleAxes) {
  const reference = boneNodes.get(sideBones.scapula[side]);
  if (reference) {
    const lateral = reference.getWorldPosition(new THREE.Vector3()).getComponent(sideAxisIndex(axes));
    if (Math.abs(lateral) > 0.0001) return Math.sign(lateral);
  }
  return side === "left" ? -1 : 1;
}

function resolveAnchor(
  anchor: MuscleAnchor,
  side: "left" | "right",
  sign: number,
  boneNodes: Map<string, THREE.Bone>,
  axes: MuscleAxes,
) {
  const bone = boneNodes.get(resolveBoneName(anchor.bone, side));
  if (!bone) return null;
  const point = bone.getWorldPosition(new THREE.Vector3());
  point.setComponent(longAxisIndex(axes), point.getComponent(longAxisIndex(axes)) + anchor.offset[0] * axes.halfLength * axes.headDirection);
  point.y += anchor.offset[1] * axes.halfHeight;
  point.setComponent(sideAxisIndex(axes), point.getComponent(sideAxisIndex(axes)) + anchor.offset[2] * axes.halfWidth * sign);
  return point;
}

function createPath(start: THREE.Vector3, end: THREE.Vector3, sideSign: number, axes: MuscleAxes, bulge = 0.025) {
  const control = start.clone().lerp(end, 0.5);
  control.addScaledVector(new THREE.Vector3().setComponent(sideAxisIndex(axes), sideSign), axes.halfWidth * bulge);
  return new THREE.CatmullRomCurve3([start, control, end], false, "centripetal");
}

function sliceCurve(curve: THREE.CatmullRomCurve3, from: number, to: number, steps = 7) {
  const points = Array.from({ length: steps }, (_, index) => curve.getPoint(from + (to - from) * index / (steps - 1)));
  return new THREE.CatmullRomCurve3(points, false, "centripetal");
}

function smoothStep(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function createTaperedGeometry(
  curve: THREE.CatmullRomCurve3,
  radius: number,
  shape: MuscleShape,
  sideSign: number,
  axes: MuscleAxes,
  tendonTransitions = false,
) {
  const longitudinalSegments = 18;
  const radialSegments = 10;
  const frames = curve.computeFrenetFrames(longitudinalSegments, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const tendonRings = Math.round(longitudinalSegments / 6);
  for (let ring = 0; ring <= longitudinalSegments; ring += 1) {
    const t = ring / longitudinalSegments;
    const center = curve.getPointAt(t);
    const taper = tendonTransitions
      ? 0.12 + 0.88 * Math.min(smoothStep(t / (tendonRings / longitudinalSegments)), smoothStep((1 - t) / (tendonRings / longitudinalSegments)))
      : Math.max(0.035, Math.pow(Math.sin(Math.PI * t), shape === "bundle" ? 0.8 : 0.66));
    const fanWidth = shape === "fan" ? 0.55 + Math.sin(Math.PI * t) * 0.72 : 1;
    const sheet = shape === "sheet" || shape === "fan";
    const radiusNormal = radius * (sheet ? 1.75 : 1) * taper * fanWidth;
    const radiusBinormal = radius * (sheet ? 0.2 : 0.78) * taper;
    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const angle = segment / radialSegments * Math.PI * 2;
      const normalWeight = Math.cos(angle) * radiusNormal;
      const binormalWeight = Math.sin(angle) * radiusBinormal;
      const point = center.clone()
        .addScaledVector(frames.normals[ring], normalWeight)
        .addScaledVector(frames.binormals[ring], binormalWeight);
      positions.push(point.x, point.y, point.z);
      uvs.push(segment / radialSegments, t);
      if (ring < longitudinalSegments && segment < radialSegments) {
        const a = ring * (radialSegments + 1) + segment;
        const b = a + radialSegments + 1;
        // The tube frame uses tangent × normal = binormal, so winding
        // circumferentially before moving along the curve keeps normals outward.
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  if (tendonTransitions) {
    const indicesPerRing = radialSegments * 6;
    geometry.addGroup(0, tendonRings * indicesPerRing, 1);
    geometry.addGroup(tendonRings * indicesPerRing, (longitudinalSegments - tendonRings * 2) * indicesPerRing, 0);
    geometry.addGroup((longitudinalSegments - tendonRings) * indicesPerRing, tendonRings * indicesPerRing, 1);
  }
  geometry.computeVertexNormals();
  geometry.userData.sideSign = sideSign;
  return geometry;
}

function makeMesh(
  group: THREE.Group,
  curve: THREE.CatmullRomCurve3,
  radius: number,
  shape: MuscleShape,
  sideSign: number,
  axes: MuscleAxes,
  material: THREE.MeshStandardMaterial,
  name: string,
  record: EquineMuscleRecord,
) {
  const mesh = new THREE.Mesh(createTaperedGeometry(curve, radius, shape, sideSign, axes), material);
  mesh.name = name;
  mesh.renderOrder = 2;
  mesh.userData.muscleId = record.id;
  mesh.userData.muscleInfo = record;
  mesh.userData.baseEmissive = material.emissive.getHex();
  group.add(mesh);
  return mesh;
}

function addStructure(
  layer: THREE.Group,
  record: EquineMuscleRecord,
  side: "left" | "right",
  sideSign: number,
  start: THREE.Vector3,
  end: THREE.Vector3,
  axes: MuscleAxes,
  fiberNormalMap: THREE.Texture,
  suffix = "",
) {
  const root = new THREE.Group();
  root.name = `${record.vi} ${side}${suffix}`;
  root.userData.muscleId = record.id;
  root.userData.muscleSide = side;
  root.userData.muscleGroup = record.group;
  root.userData.muscleLayer = record.layer;
  root.userData.muscleKind = record.kind;
  root.userData.muscleInfo = record;
  const curve = createPath(start, end, sideSign, axes, record.shape === "fan" ? 0.06 : 0.025);
  const radius = Math.max(axes.halfWidth * record.radius, record.kind === "muscle" ? 0.012 : 0.006);
  const material = new THREE.MeshStandardMaterial({
    color: record.color,
    roughness: record.kind === "muscle" ? 0.64 : record.kind === "fascia" ? 0.7 : 0.48,
    metalness: 0,
    side: record.kind === "fascia" ? THREE.DoubleSide : THREE.FrontSide,
    normalMap: record.kind === "muscle" ? fiberNormalMap : null,
    normalScale: new THREE.Vector2(0.17, 0.17),
    transparent: record.kind === "fascia",
    opacity: record.kind === "fascia" ? 0.78 : 1,
  });
  material.userData.baseEmissive = material.emissive.getHex();

  if (record.kind === "muscle") {
    const muscleGeometry = createTaperedGeometry(curve, radius, record.shape, sideSign, axes, true);
    const tendonMaterial = new THREE.MeshStandardMaterial({ color: "#e8dfc8", roughness: 0.48, metalness: 0.02 });
    tendonMaterial.userData.baseEmissive = tendonMaterial.emissive.getHex();
    const mesh = new THREE.Mesh(muscleGeometry, [material, tendonMaterial]);
    mesh.name = `${record.id}-muscle-tendon-unit`;
    mesh.renderOrder = 2;
    mesh.userData.muscleId = record.id;
    mesh.userData.muscleInfo = record;
    root.add(mesh);
  } else {
    makeMesh(root, curve, radius, record.shape, sideSign, axes, material, record.id, record);
  }
  layer.add(root);
}

function buildRibRepeat(
  layer: THREE.Group,
  record: EquineMuscleRecord,
  side: "left" | "right",
  sideSign: number,
  boneNodes: Map<string, THREE.Bone>,
  axes: MuscleAxes,
  fiberNormalMap: THREE.Texture,
) {
  const anchors = ["spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012"]
    .map((name) => boneNodes.get(name)?.getWorldPosition(new THREE.Vector3()))
    .filter((point): point is THREE.Vector3 => Boolean(point));
  if (anchors.length < 2) return;
  const spine = new THREE.CatmullRomCurve3(anchors);
  const longVector = new THREE.Vector3().setComponent(longAxisIndex(axes), -axes.headDirection);
  const sideVector = new THREE.Vector3().setComponent(sideAxisIndex(axes), 1);
  const heightVector = new THREE.Vector3(0, 1, 0);
  const count = 18;
  for (let index = 0; index < count; index += 1) {
    const t = (index + 0.5) / count;
    const root = spine.getPoint(t);
    const offset = axes.halfLength * (0.018 + t * 0.022);
    const width = axes.halfWidth * (0.56 + Math.sin(t * Math.PI) * 0.1);
    const start = root.clone()
      .addScaledVector(longVector, offset * 0.22)
      .addScaledVector(sideVector, width * 0.18 * sideSign)
      .addScaledVector(heightVector, -axes.halfHeight * 0.065);
    const end = root.clone()
      .addScaledVector(longVector, offset * 0.68)
      .addScaledVector(sideVector, width * 0.5 * sideSign)
      .addScaledVector(heightVector, -axes.halfHeight * 0.205);
    addStructure(layer, record, side, sideSign, start, end, axes, fiberNormalMap, ` · khoang ${index + 1}`);
  }
}

/** Build separately selectable, bilateral anatomy meshes against the loaded horse rig. */
export function buildEquineMuscleLayer(boneNodes: Map<string, THREE.Bone>, axes: MuscleAxes) {
  const group = new THREE.Group();
  group.name = "Equine muscle anatomy";
  const fiberNormalMap = createFiberNormalMap();
  group.userData.ownedTextures = [fiberNormalMap];

  for (const record of equineMuscles) {
    const sides: Array<"left" | "right"> = record.side === "bilateral" ? ["left", "right"] : ["left"];
    for (const side of sides) {
      const sign = sideSignFor(side, boneNodes, axes);
      if (record.repeat === "ribs") {
        buildRibRepeat(group, record, side, sign, boneNodes, axes, fiberNormalMap);
        continue;
      }
      const origin = resolveAnchor(record.origin, side, sign, boneNodes, axes);
      const insertion = resolveAnchor(record.insertion, side, sign, boneNodes, axes);
      if (!origin || !insertion) continue;
      addStructure(group, record, side, sign, origin, insertion, axes, fiberNormalMap);
    }
  }
  return group;
}

