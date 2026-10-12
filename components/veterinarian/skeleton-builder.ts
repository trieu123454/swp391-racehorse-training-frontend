import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export type SkeletonGroup = "axial" | "forelimb" | "hindlimb" | "head";
export type SkeletonAxes = {
  longAxis: "x" | "z";
  sideAxis: "x" | "z";
  headDirection: 1 | -1;
  halfLength: number;
  halfHeight: number;
  halfWidth: number;
};
export type SkeletonRecord = {
  id: string;
  name: string;
  latin: string;
  group: SkeletonGroup;
  description: string;
  estimated: boolean;
  label: boolean;
  anchor: THREE.Vector3;
  object: THREE.Group;
};

const groupLabels: Record<SkeletonGroup, string> = {
  axial: "Bộ xương trục",
  forelimb: "Chi trước",
  hindlimb: "Chi sau",
  head: "Đầu",
};

function boneGeometry() {
  const radialSegments = 12;
  const rings = [
    [0, 0.58], [0.055, 0.82], [0.13, 0.7], [0.25, 0.52],
    [0.75, 0.52], [0.87, 0.7], [0.945, 0.82], [1, 0.58],
  ];
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  rings.forEach(([y, radius]) => {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = segment / radialSegments * Math.PI * 2;
      vertices.push(Math.cos(angle) * radius, y - 0.5, Math.sin(angle) * radius);
      uvs.push(segment / radialSegments, y);
    }
  });
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const current = ring * radialSegments + segment;
      const next = ring * radialSegments + (segment + 1) % radialSegments;
      const below = current + radialSegments;
      const belowNext = next + radialSegments;
      indices.push(current, below, next, next, below, belowNext);
    }
  }
  const startCenter = vertices.length / 3;
  vertices.push(0, -0.5, 0);
  uvs.push(0.5, 0);
  const endCenter = vertices.length / 3;
  vertices.push(0, 0.5, 0);
  uvs.push(0.5, 1);
  const lastRingOffset = (rings.length - 1) * radialSegments;
  for (let segment = 0; segment < radialSegments; segment += 1) {
    const next = (segment + 1) % radialSegments;
    indices.push(startCenter, segment, next);
    indices.push(endCenter, lastRingOffset + next, lastRingOffset + segment);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeBoneTexture() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4;
      const wave = Math.sin(x * 0.41 + Math.cos(y * 0.29) * 2.2) * 5;
      const grain = ((x * 17 + y * 31 + x * y * 7) % 11) - 5;
      const value = Math.max(0, Math.min(255, 228 + wave + grain));
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.needsUpdate = true;
  return texture;
}

export function buildEquineSkeletonLayer(
  nodes: Map<string, THREE.Bone>,
  axes: SkeletonAxes,
) {
  const group = new THREE.Group();
  group.name = "Equine skeleton (procedural teaching illustration)";
  const categoryGroups = new Map<SkeletonGroup, THREE.Group>();
  (Object.keys(groupLabels) as SkeletonGroup[]).forEach((id) => {
    const category = new THREE.Group();
    category.name = groupLabels[id];
    category.userData.skeletonGroup = id;
    group.add(category);
    categoryGroups.set(id, category);
  });
  const surface = makeBoneTexture();
  const materials = {
    bone: new THREE.MeshStandardMaterial({ color: "#e4dac4", roughness: 0.63, metalness: 0, bumpMap: surface, bumpScale: 0.006 }),
    cartilage: new THREE.MeshStandardMaterial({ color: "#bfd3cf", roughness: 0.42, metalness: 0, transparent: true, opacity: 0.66, depthWrite: false }),
  };
  const shaftGeometry = boneGeometry();
  const ellipsoidGeometry = new THREE.SphereGeometry(1, 16, 12);
  const records: SkeletonRecord[] = [];
  const byId = new Map<string, SkeletonRecord>();
  const vUp = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3().setComponent(axes.sideAxis === "x" ? 0 : 2, 1);
  const longitudinal = new THREE.Vector3().setComponent(axes.longAxis === "x" ? 0 : 2, -axes.headDirection);
  const height = new THREE.Vector3(0, 1, 0);
  const worldPosition = (id: string) => nodes.get(id)?.getWorldPosition(new THREE.Vector3()) ?? null;
  const categoryFor = (type: SkeletonGroup) => categoryGroups.get(type)!;

  function addRecord(
    id: string,
    name: string,
    latin: string,
    type: SkeletonGroup,
    anchor: THREE.Vector3,
    description: string,
    label = false,
  ) {
    const root = new THREE.Group();
    root.name = `${name} – ${latin}`;
    root.position.set(0, 0, 0);
    root.userData.boneId = id;
    root.userData.skeletonGroup = type;
    const record: SkeletonRecord = { id, name, latin, group: type, description, estimated: true, label, anchor: anchor.clone(), object: root };
    root.userData.boneInfo = record;
    categoryFor(type).add(root);
    records.push(record);
    byId.set(id, record);
    return root;
  }

  function addPart(root: THREE.Group, name: string, geometry: THREE.BufferGeometry, material = materials.bone) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = 3;
    mesh.userData.boneId = root.userData.boneId;
    if (material === materials.cartilage) mesh.userData.isCartilage = true;
    root.add(mesh);
    return mesh;
  }

  function addShaft(root: THREE.Group, name: string, start: THREE.Vector3, end: THREE.Vector3, radius: number, widthScale = 1, depthScale = 1, material = materials.bone) {
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 0.008) return;
    const mesh = addPart(root, name, shaftGeometry, material);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.scale.set(radius * widthScale, length, radius * depthScale);
    mesh.quaternion.setFromUnitVectors(vUp, direction.normalize());
  }

  function addEllipsoid(root: THREE.Group, name: string, center: THREE.Vector3, size: THREE.Vector3, axis?: THREE.Vector3, material = materials.bone) {
    const mesh = addPart(root, name, ellipsoidGeometry, material);
    mesh.position.copy(center);
    mesh.scale.copy(size);
    if (axis && axis.lengthSq() > 1e-6) mesh.quaternion.setFromUnitVectors(vUp, axis.clone().normalize());
    return mesh;
  }

  function addLongBone(id: string, name: string, latin: string, type: SkeletonGroup, start: THREE.Vector3, end: THREE.Vector3, radius: number, description: string, label = false) {
    const middle = start.clone().lerp(end, 0.5);
    const root = addRecord(id, name, latin, type, middle, description, label);
    addShaft(root, `${name} · thân xương`, start, end, radius);
    const direction = end.clone().sub(start).normalize();
    const jointRadius = radius * 1.26;
    addEllipsoid(root, `${name} · đầu gần`, start, new THREE.Vector3(jointRadius, radius * 0.88, jointRadius), direction.clone().negate());
    addEllipsoid(root, `${name} · đầu xa`, end, new THREE.Vector3(jointRadius * 1.1, radius * 0.92, jointRadius * 1.1), direction);
    addEllipsoid(root, `${name} · sụn khớp gần`, start.clone().addScaledVector(direction, radius * 0.45), new THREE.Vector3(jointRadius * 0.72, radius * 0.2, jointRadius * 0.72), direction, materials.cartilage);
    addEllipsoid(root, `${name} · sụn khớp xa`, end.clone().addScaledVector(direction, -radius * 0.45), new THREE.Vector3(jointRadius * 0.72, radius * 0.2, jointRadius * 0.72), direction, materials.cartilage);
    return root;
  }

  function pointsAlong(anchors: THREE.Vector3[], count: number) {
    if (anchors.length < 2) return [] as THREE.Vector3[];
    const curve = new THREE.CatmullRomCurve3(anchors);
    return Array.from({ length: count }, (_, index) => curve.getPoint((index + 0.5) / count));
  }

  function addVertebra(id: string, name: string, latin: string, center: THREE.Vector3, size: number, processHeight: number, type: SkeletonGroup = "axial", special: "atlas" | "axis" | "sacral" | "tail" | null = null) {
    const root = addRecord(id, name, latin, type, center, `${groupLabels[type]}. Đốt sống và các mỏm được dựng theo vị trí rig, dùng cho minh họa học tập.`, ["C1", "C2", "T3", "T6", "T10", "L3", "Đốt đuôi 1"].includes(name));
    if (special !== "sacral") addEllipsoid(root, `${name} · thân đốt`, center, new THREE.Vector3(size * 0.83, size * 0.72, size * 0.9));
    const dorsal = center.clone().addScaledVector(height, processHeight);
    addShaft(root, `${name} · mỏm gai`, center, dorsal, size * 0.23, 1, 0.8);
    for (const sign of [-1, 1]) {
      const lateral = center.clone().addScaledVector(side, sign * size * (special === "sacral" ? 2.05 : 1.42));
      addShaft(root, `${name} · mỏm ngang`, center, lateral, size * 0.17, 1, 0.8);
    }
    if (special === "atlas") {
      const ringRadius = size * 1.2;
      for (const sign of [-1, 1]) {
        const lateral = center.clone().addScaledVector(side, sign * ringRadius);
        addShaft(root, "Atlas · cánh đốt đội", center.clone().addScaledVector(height, size * 0.4), lateral, size * 0.22, 1.2, 0.8);
      }
      addEllipsoid(root, "Atlas · cung đốt sống", center.clone().addScaledVector(height, size * 0.63), new THREE.Vector3(size * 0.76, size * 0.22, size * 0.88));
    }
    if (special === "axis") {
      addShaft(root, "Axis · mỏm nha", center.clone().addScaledVector(longitudinal, size * 0.35), center.clone().addScaledVector(longitudinal, size * 1.05), size * 0.28);
      addShaft(root, "Axis · gai trục", center.clone().addScaledVector(height, size * 0.25), dorsal.clone().addScaledVector(longitudinal, -size * 0.3), size * 0.31);
    }
    if (special === "sacral") {
      addEllipsoid(root, `${name} · cánh xương cùng`, center.clone().addScaledVector(side, size * 0.9), new THREE.Vector3(size * 0.5, size * 0.42, size * 1.5));
    }
    return root;
  }

  // Seven cervical vertebrae: C1/C2 have distinct atlas and axis landmarks.
  const neckAnchors = ["spine_04_012", "neck_01_014", "neck_02_015", "neck_03_016", "neck_04_017", "neck_05_018", "head_019"]
    .map(worldPosition).filter((point): point is THREE.Vector3 => Boolean(point));
  pointsAlong(neckAnchors, 7).forEach((point, index) => {
    const number = index + 1;
    addVertebra(`c${number}`, `C${number}`, number === 1 ? "Atlas" : number === 2 ? "Axis" : `Vertebra cervicalis ${number}`, point, axes.halfHeight * 0.023, axes.halfHeight * 0.045, "axial", number === 1 ? "atlas" : number === 2 ? "axis" : null);
  });

  const thoracicAnchors = ["spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012"]
    .map(worldPosition).filter((point): point is THREE.Vector3 => Boolean(point));
  const thoracic = pointsAlong(thoracicAnchors, 18);
  thoracic.forEach((point, index) => {
    const number = index + 1;
    const withersFactor = number >= 3 && number <= 10 ? 1.72 : number <= 2 ? 1.32 : 1;
    addVertebra(`t${number}`, `T${number}`, `Vertebra thoracica ${number}`, point, axes.halfHeight * 0.027, axes.halfHeight * 0.074 * withersFactor);
  });

  const lumbarStart = worldPosition("pelvis_08");
  const lumbarEnd = worldPosition("spine_01_09");
  if (lumbarStart && lumbarEnd) pointsAlong([lumbarStart, lumbarEnd], 6).forEach((point, index) => {
    const number = index + 1;
    addVertebra(`l${number}`, `L${number}`, `Vertebra lumbalis ${number}`, point, axes.halfHeight * 0.03, axes.halfHeight * 0.087);
  });
  const sacrum = worldPosition("pelvis_08") ?? worldPosition("hips_0366");
  if (sacrum) {
    const sacrumRoot = addRecord("sacrum", "Xương cùng", "Os sacrum", "axial", sacrum, "Khối xương cùng gồm năm đốt dính liền; bề mặt và diện khớp được giản lược.", true);
    addEllipsoid(sacrumRoot, "Corpus ossis sacri · khối thân dính", sacrum, new THREE.Vector3(axes.halfLength * 0.034, axes.halfHeight * 0.052, axes.halfWidth * 0.09));
    for (const sign of [-1, 1]) {
      const wing = sacrum.clone().addScaledVector(side, sign * axes.halfWidth * 0.075);
      addEllipsoid(sacrumRoot, "Ala ossis sacri · cánh xương cùng", wing, new THREE.Vector3(axes.halfLength * 0.014, axes.halfHeight * 0.027, axes.halfWidth * 0.025));
    }
    Array.from({ length: 5 }, (_, index) => {
    const point = sacrum.clone().addScaledVector(longitudinal, (index - 2) * axes.halfLength * 0.002);
    addVertebra(`s${index + 1}`, `S${index + 1}`, `Vertebra sacralis ${index + 1}`, point, axes.halfHeight * 0.031, axes.halfHeight * 0.07, "axial", "sacral");
    });
  }
  const tailAnchors = ["tail_01_0367", "tail_02_0368", "tail_03_0369", "tail_04_0370", "tail_05_0371"]
    .map(worldPosition).filter((point): point is THREE.Vector3 => Boolean(point));
  pointsAlong(tailAnchors, 15).forEach((point, index) => {
    const ratio = 1 - index / 18;
    addVertebra(`ca${index + 1}`, `Đốt đuôi ${index + 1}`, `Vertebra caudalis ${index + 1}`, point, axes.halfHeight * 0.02 * ratio, axes.halfHeight * 0.026 * ratio, "axial", "tail");
  });

  // Eighteen ribs per side with separate bone and costal cartilage meshes.
  if (thoracic.length === 18) {
    const ribTips: THREE.Vector3[][] = [[], []];
    thoracic.forEach((root, index) => {
      const number = index + 1;
      const progress = index / 17;
      const lengthFactor = 0.68 + 0.32 * Math.sin(progress * Math.PI);
      const span = axes.halfWidth * (0.47 + 0.11 * lengthFactor);
      for (const [sideIndex, sign] of [-1, 1].entries()) {
        const ribId = `rib-${number}-${sign < 0 ? "l" : "r"}`;
        const start = root.clone().addScaledVector(height, -axes.halfHeight * 0.012);
        const lower = root.clone()
          .addScaledVector(longitudinal, axes.halfLength * (0.012 + progress * 0.026))
          .addScaledVector(side, sign * span)
          .addScaledVector(height, -axes.halfHeight * (0.27 + 0.035 * lengthFactor));
        const tip = lower.clone().addScaledVector(longitudinal, axes.halfLength * 0.008);
        const isTrueRib = number <= 8;
        const record = addRecord(ribId, `Xương sườn ${number}${sign < 0 ? " trái" : " phải"}`, `Costa ${number}`, "axial", start.clone().lerp(tip, 0.5), `${isTrueRib ? "Sườn thật" : "Sườn giả"}; xương sườn riêng, sụn sườn dựng riêng.`, number === 1 || number === 8 || number === 18);
        const sideSign = sign;
        const curve = new THREE.CatmullRomCurve3([
          start,
          start.clone().lerp(lower, 0.28).addScaledVector(side, sideSign * axes.halfWidth * 0.035),
          start.clone().lerp(lower, 0.7).addScaledVector(longitudinal, axes.halfLength * 0.012),
          lower,
        ]);
        const rib = addPart(record, "Costa · thân cong", new THREE.TubeGeometry(curve, 20, axes.halfHeight * 0.009, 7, false));
        ribTips[sideIndex].push(tip);
        if (isTrueRib) {
          const sternum = root.clone()
            .addScaledVector(longitudinal, axes.halfLength * (0.016 + progress * 0.02))
            .addScaledVector(height, -axes.halfHeight * 0.33);
          const cartilageCurve = new THREE.CatmullRomCurve3([lower, lower.clone().lerp(sternum, 0.5), sternum]);
          addPart(record, "Cartilago costalis · sụn sườn", new THREE.TubeGeometry(cartilageCurve, 8, axes.halfHeight * 0.0075, 6, false), materials.cartilage);
        }
      }
    });
    // Eight true pairs meet segmented sternebrae; false ribs form the costal arch.
    for (let segment = 0; segment < 8; segment += 1) {
      const point = thoracic[segment].clone()
        .addScaledVector(longitudinal, axes.halfLength * (0.014 + segment * 0.002))
        .addScaledVector(height, -axes.halfHeight * 0.34);
      const next = thoracic[Math.min(segment + 1, 17)].clone()
        .addScaledVector(longitudinal, axes.halfLength * 0.034)
        .addScaledVector(height, -axes.halfHeight * 0.34);
      const sternum = addRecord(`sternum-${segment + 1}`, `Thân xương ức ${segment + 1}`, `Sternebra ${segment + 1}`, "axial", point.clone().lerp(next, 0.5), "Đoạn xương ức nối với sụn các xương sườn thật.", segment === 0);
      addShaft(sternum, "Sternebra · thân", point, next, axes.halfHeight * 0.016, 0.85, 0.72);
    }
    for (const [sideIndex, sign] of [-1, 1].entries()) {
      const falseTips = ribTips[sideIndex].slice(8);
      for (let index = 0; index < falseTips.length - 1; index += 1) {
        const start = falseTips[index];
        const end = falseTips[index + 1].clone().addScaledVector(longitudinal, axes.halfLength * 0.018);
        const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(end, 0.5).addScaledVector(longitudinal, axes.halfLength * 0.009), end]);
        const arch = addRecord(`costal-arch-${sideIndex}-${index}`, `Cung sườn ${index + 1}${sign < 0 ? " trái" : " phải"}`, "Arcus costalis", "axial", start.clone().lerp(end, 0.5), "Sụn nối các sườn giả thành cung sườn; vị trí minh họa.");
        addPart(arch, "Cartilago costalis · cung sườn", new THREE.TubeGeometry(curve, 8, axes.halfHeight * 0.0075, 6, false), materials.cartilage);
      }
    }
  }

  // Pelvis is represented as separate ilium, pubis and ischium plates.
  const pelvis = worldPosition("hips_0366") ?? worldPosition("pelvis_08");
  if (pelvis) for (const [sign, suffix] of [[-1, "trái"], [1, "phải"]] as const) {
    const hipSide = pelvis.clone().addScaledVector(side, sign * axes.halfWidth * 0.095);
    const iliumEnd = pelvis.clone().addScaledVector(longitudinal, -axes.halfLength * 0.065).addScaledVector(height, axes.halfHeight * 0.045).addScaledVector(side, sign * axes.halfWidth * 0.045);
    const pubisEnd = pelvis.clone().addScaledVector(longitudinal, axes.halfLength * 0.035).addScaledVector(height, -axes.halfHeight * 0.04).addScaledVector(side, sign * axes.halfWidth * 0.04);
    const ischiumEnd = pelvis.clone().addScaledVector(longitudinal, -axes.halfLength * 0.035).addScaledVector(height, -axes.halfHeight * 0.055).addScaledVector(side, sign * axes.halfWidth * 0.055);
    addLongBone(`ilium-${suffix}`, `Xương cánh chậu ${suffix}`, "Ilium", "hindlimb", hipSide, iliumEnd, axes.halfHeight * 0.044, "Mào chậu và mấu hông; vị trí ước lượng theo rig.", suffix === "trái");
    addLongBone(`pubis-${suffix}`, `Xương mu ${suffix}`, "Pubis", "hindlimb", hipSide, pubisEnd, axes.halfHeight * 0.028, "Phần bụng của xương chậu; mesh minh họa.");
    addLongBone(`ischium-${suffix}`, `Xương ngồi ${suffix}`, "Ischium", "hindlimb", hipSide, ischiumEnd, axes.halfHeight * 0.034, "Mấu ngồi và nhánh xương ngồi; mesh minh họa.");
  }

  // Skull, orbit rims, nasal opening and individual incisors/molars.
  const head = worldPosition("head_019");
  const jaw = worldPosition("jaw_020");
  const muzzle = worldPosition("jaw_end_021");
  const eyeLeft = worldPosition("eye_l_059");
  const eyeRight = worldPosition("eye_r_063");
  if (head) {
    const compact = (point: THREE.Vector3, factor: number) => {
      const result = point.clone();
      const index = axes.longAxis === "x" ? 0 : 2;
      result.setComponent(index, head.getComponent(index) + (result.getComponent(index) - head.getComponent(index)) * factor);
      return result;
    };
    const cranium = head.clone().addScaledVector(longitudinal, axes.halfLength * 0.016).addScaledVector(height, axes.halfHeight * 0.01);
    const skull = addRecord("skull", "Hộp sọ", "Cranium", "head", cranium, "Hộp sọ ngựa gồm phần sọ não và mặt; chi tiết xoang, cung gò má và răng được dựng dạng minh họa.", true);
    addEllipsoid(skull, "Neurocranium", cranium, new THREE.Vector3(axes.halfLength * 0.07, axes.halfHeight * 0.055, axes.halfWidth * 0.075));
    if (muzzle) {
      const tip = compact(muzzle, 0.72);
      const root = head.clone().lerp(tip, 0.12);
      const bridge = head.clone().lerp(tip, 0.58);
      const nose = head.clone().lerp(tip, 0.86);
      addShaft(skull, "Os nasale · xương mũi", root, bridge, axes.halfHeight * 0.022, 1.05, 0.85);
      addShaft(skull, "Os incisivum · xương cửa", bridge, nose, axes.halfHeight * 0.018, 1.1, 0.85);
      const maxilla = head.clone().lerp(tip, 0.48).addScaledVector(height, -axes.halfHeight * 0.021);
      addEllipsoid(skull, "Maxilla · xương hàm trên", maxilla, new THREE.Vector3(axes.halfLength * 0.045, axes.halfHeight * 0.024, axes.halfWidth * 0.036));
      // Paired bony rims hint at the large equine nasal cavity without filling it with a blob.
      for (const sign of [-1, 1]) {
        const nasalSide = nose.clone().addScaledVector(side, sign * axes.halfWidth * 0.025);
        const nasalCurve = new THREE.EllipseCurve(0, 0, axes.halfWidth * 0.028, axes.halfHeight * 0.025, 0, Math.PI * 2, false, 0);
        const points = nasalCurve.getPoints(28).map((point) => nasalSide.clone().addScaledVector(side, point.x).addScaledVector(height, point.y));
        const nasalRim = addRecord(`nasal-cavity-${sign}`, "Bờ xoang mũi", "Cavum nasi", "head", nasalSide, "Hốc mũi để trống, đường viền là phần minh họa.");
        addPart(nasalRim, "Bờ xương quanh lỗ mũi", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 28, axes.halfHeight * 0.004, 5, false));
      }
      for (const [sideIndex, eye] of [eyeLeft, eyeRight].entries()) {
        if (!eye) continue;
        const eyeCenter = compact(eye, 0.82);
        const ring = new THREE.TorusGeometry(axes.halfHeight * 0.027, axes.halfHeight * 0.004, 8, 28);
        const orbit = addRecord(`orbit-${sideIndex}`, `Hốc mắt ${sideIndex ? "phải" : "trái"}`, "Orbita", "head", eyeCenter, "Vành ổ mắt lớn đặc trưng đầu ngựa; vị trí theo node mắt.");
        const rim = addPart(orbit, "Arcus zygomaticus · cung gò má", ring);
        rim.position.copy(eyeCenter).addScaledVector(side, (sideIndex ? 1 : -1) * axes.halfWidth * 0.006);
        rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), side.clone().multiplyScalar(sideIndex ? 1 : -1));
        const cheekEnd = head.clone().lerp(tip, 0.72).addScaledVector(height, -axes.halfHeight * 0.035);
        addShaft(orbit, "Cung gò má", eyeCenter.clone().addScaledVector(height, -axes.halfHeight * 0.025), cheekEnd, axes.halfHeight * 0.008, 1, 0.8);
      }
      // Small upper incisors and cheek teeth, separately selectable as a set.
      for (const [kind, count, fraction, radius] of [["răng cửa", 6, 0.91, 0.006], ["răng hàm", 12, 0.62, 0.007]] as const) {
        for (let tooth = 0; tooth < count; tooth += 1) {
          const sideOffset = (tooth - (count - 1) / 2) * axes.halfWidth * (kind === "răng cửa" ? 0.006 : 0.0045);
          const point = head.clone().lerp(tip, fraction).addScaledVector(height, -axes.halfHeight * 0.035).addScaledVector(side, sideOffset);
          const root = addRecord(`${kind === "răng cửa" ? "incisor" : "molar"}-${tooth + 1}`, `${kind} ${tooth + 1}`, kind === "răng cửa" ? "Dens incisivus" : "Dens molaris", "head", point, "Răng được mô hình hóa đơn giản, không thể hiện tuổi hay giai đoạn mọc.");
          addEllipsoid(root, "Dens · thân răng", point, new THREE.Vector3(axes.halfLength * radius, axes.halfHeight * radius * 1.8, axes.halfWidth * radius), height);
        }
      }
      if (jaw) {
        const jawStart = compact(jaw, 0.77);
        const jawEnd = jawStart.clone().lerp(tip, 0.88).addScaledVector(height, -axes.halfHeight * 0.06);
        const mandible = addRecord("mandible", "Xương hàm dưới", "Mandibula", "head", jawStart.clone().lerp(jawEnd, 0.5), "Hàm dưới là mesh riêng; khớp thái dương hàm thể hiện bằng hai lồi cầu.", true);
        for (const sign of [-1, 1]) {
          const sideStart = jawStart.clone().addScaledVector(side, sign * axes.halfWidth * 0.035);
          const sideEnd = jawEnd.clone().addScaledVector(side, sign * axes.halfWidth * 0.018);
          addShaft(mandible, "Ramus mandibulae · ngành hàm", sideStart, sideEnd, axes.halfHeight * 0.012, 1.1, 0.9);
          addEllipsoid(mandible, "Condylus mandibulae · lồi cầu", sideStart, new THREE.Vector3(axes.halfHeight * 0.012, axes.halfHeight * 0.01, axes.halfHeight * 0.012));
        }
        const tmj = addRecord("tmj", "Khớp thái dương hàm", "Articulatio temporomandibularis", "head", jawStart, "Khớp hàm được đánh dấu riêng; khe khớp chỉ là minh họa.");
        addEllipsoid(tmj, "Lồi cầu khớp", jawStart, new THREE.Vector3(axes.halfHeight * 0.011, axes.halfHeight * 0.01, axes.halfHeight * 0.011));
      }
    }
  }

  // Paired thoracic limbs. Shoulder blades follow the skin envelope and remain
  // separated from the vertebral column (equine muscular synsarcosis).
  for (const sideName of ["l", "r"] as const) {
    const suffix = sideName === "l" ? "trái" : "phải";
    const sign = sideName === "l" ? -1 : 1;
    const scapulaPoint = worldPosition(`clavicle_${sideName}_${sideName === "l" ? "0203" : "0269"}`);
    const humerus = worldPosition(`upperarm_${sideName}_${sideName === "l" ? "0204" : "0270"}`);
    const radius = worldPosition(`lowerarm_${sideName}_${sideName === "l" ? "0205" : "0271"}`);
    const carpus = worldPosition(`hand_${sideName}_${sideName === "l" ? "0206" : "0272"}`);
    const fetlock = worldPosition(`fingers_01_${sideName}_${sideName === "l" ? "0187" : "0273"}`);
    const pastern = worldPosition(`fingers_02_${sideName}_${sideName === "l" ? "0208" : "0274"}`);
    const hoof = worldPosition(`fingers_end_${sideName}_${sideName === "l" ? "0209" : "0275"}`);
    if (scapulaPoint && humerus) {
      const bladeEnd = scapulaPoint.clone().addScaledVector(longitudinal, axes.halfLength * 0.07).addScaledVector(height, axes.halfHeight * 0.105);
      const scapula = addLongBone(`scapula-${suffix}`, `Xương vai ${suffix}`, "Scapula", "forelimb", bladeEnd, scapulaPoint, axes.halfHeight * 0.045, "Xương vai dẹt; vai nối với thân qua cơ, không có khớp xương cứng với cột sống.", sideName === "l");
      addShaft(scapula, "Spina scapulae · gai vai", bladeEnd.clone().lerp(scapulaPoint, 0.12), bladeEnd.clone().lerp(scapulaPoint, 0.83).addScaledVector(side, sign * axes.halfWidth * 0.014), axes.halfHeight * 0.006);
    }
    if (scapulaPoint && humerus) addLongBone(`humerus-${suffix}`, `Xương cánh tay ${suffix}`, "Humerus", "forelimb", scapulaPoint, humerus, axes.halfHeight * 0.034, "Xương cánh tay ngựa ngắn, hướng chéo sau và xuống; bám theo mốc rig.");
    if (humerus && radius) addLongBone(`radius-${suffix}`, `Xương quay ${suffix}`, "Radius", "forelimb", humerus, radius, axes.halfHeight * 0.027, "Thân xương quay chịu lực chính ở cẳng chân trước.");
    if (humerus && radius) {
      const ulnaEnd = humerus.clone().addScaledVector(height, axes.halfHeight * 0.026).addScaledVector(longitudinal, -axes.halfLength * 0.012);
      addLongBone(`ulna-${suffix}`, `Xương trụ ${suffix}`, "Ulna (rút gọn)", "forelimb", radius.clone().lerp(humerus, 0.6), ulnaEnd, axes.halfHeight * 0.012, "Xương trụ ngựa trưởng thành tiêu giảm và dính với xương quay; hình minh họa.");
    }
    if (radius && carpus) {
      const carpals = ["Xương cổ tay quay", "Xương cổ tay trung gian", "Xương cổ tay trụ", "Xương cổ tay phụ", "Xương cổ tay II", "Xương cổ tay III", "Xương cổ tay IV"];
      carpals.forEach((name, index) => {
        const row = index < 4 ? 0 : 1;
        const col = index < 4 ? index : index - 4;
        const point = radius.clone().lerp(carpus, row === 0 ? 0.68 : 0.9).addScaledVector(side, (col - 1.5) * axes.halfWidth * 0.016).addScaledVector(longitudinal, sign * axes.halfLength * 0.005);
        const root = addRecord(`carpal-${sideName}-${index + 1}`, `${name} ${suffix}`, index < 4 ? "Ossa carpi proximalia" : "Ossa carpi distalia", "forelimb", point, "Xương cổ tay nhỏ riêng; sơ đồ 7 xương là mô hình quy ước, biến thiên cá thể có thể có.");
        addEllipsoid(root, name, point, new THREE.Vector3(axes.halfWidth * 0.014, axes.halfHeight * 0.016, axes.halfWidth * 0.014));
      });
    }
    if (carpus && fetlock) {
      addLongBone(`mc3-${sideName}`, `Xương bàn III trước ${suffix}`, "Os metacarpale III", "forelimb", carpus, fetlock, axes.halfHeight * 0.019, "Xương bàn chính (xương ống) của chi trước.", true);
      for (const splintSign of [-1, 1]) {
        const offset = side.clone().multiplyScalar(splintSign * axes.halfWidth * 0.021);
        addLongBone(`splint-front-${sideName}-${splintSign}`, `Xương bàn phụ trước ${suffix}`, "Ossa metacarpalia II et IV", "forelimb", carpus.clone().add(offset), fetlock.clone().add(offset.clone().multiplyScalar(0.32)), axes.halfHeight * 0.006, "Xương bàn phụ II/IV chạy dọc cạnh xương bàn III; minh họa theo rig.");
      }
    }
    if (fetlock && pastern) addLongBone(`p1-front-${sideName}`, `Đốt ngón gần trước ${suffix}`, "Phalanx proximalis (P1)", "forelimb", fetlock, pastern, axes.halfHeight * 0.014, "Xương đốt gần của ngón III.", true);
    if (fetlock && pastern && hoof) {
      const p2End = pastern.clone().lerp(hoof, 0.6);
      addLongBone(`p2-front-${sideName}`, `Đốt ngón giữa trước ${suffix}`, "Phalanx media (P2)", "forelimb", pastern, p2End, axes.halfHeight * 0.011, "Xương đốt giữa/coronary của ngón III.");
      addLongBone(`p3-front-${sideName}`, `Xương guốc trước ${suffix}`, "Phalanx distalis (P3)", "forelimb", p2End, hoof, axes.halfHeight * 0.014, "Xương guốc P3 nằm trong bao móng.", true);
      for (const signSesamoid of [-1, 1]) {
        const point = fetlock.clone().addScaledVector(side, sign * signSesamoid * axes.halfWidth * 0.016).addScaledVector(height, -axes.halfHeight * 0.016);
        const root = addRecord(`sesamoid-front-${sideName}-${signSesamoid}`, `Xương vừng gần trước ${suffix}`, "Ossa sesamoidea proximalia", "forelimb", point, "Cặp xương vừng gần ở khớp đốt bàn-ngón.");
        addEllipsoid(root, "Sesamoid", point, new THREE.Vector3(axes.halfHeight * 0.011, axes.halfHeight * 0.012, axes.halfHeight * 0.009));
      }
      const navicularPoint = p2End.clone().addScaledVector(longitudinal, axes.halfLength * 0.012);
      const navicular = addRecord(`navicular-front-${sideName}`, `Xương thuyền trước ${suffix}`, "Os sesamoideum distale", "forelimb", navicularPoint, "Xương thuyền (xương vừng xa) nằm phía sau P3; kích thước minh họa.");
      addEllipsoid(navicular, "Navicular", navicularPoint, new THREE.Vector3(axes.halfHeight * 0.018, axes.halfHeight * 0.009, axes.halfHeight * 0.01));
    }
  }

  // Hind limbs: stifle and hock are separate landmarks; the fibula is reduced.
  for (const sideName of ["l", "r"] as const) {
    const suffix = sideName === "l" ? "trái" : "phải";
    const femur = worldPosition(`upperleg_${sideName}_${sideName === "l" ? "0405" : "0474"}`);
    const tibia = worldPosition(`lowerleg_${sideName}_${sideName === "l" ? "0406" : "0475"}`);
    const hock = worldPosition(`foot_${sideName}_${sideName === "l" ? "0407" : "0476"}`);
    const fetlock = worldPosition(`toes_01_${sideName}_${sideName === "l" ? "0408" : "0477"}`);
    const pastern = worldPosition(`toes_02_${sideName}_${sideName === "l" ? "0409" : "0478"}`);
    const hoof = worldPosition(`toes_end_${sideName}_${sideName === "l" ? "0410" : "0479"}`);
    const pelvisSide = pelvis?.clone().addScaledVector(side, (sideName === "l" ? -1 : 1) * axes.halfWidth * 0.07);
    if (femur && tibia) {
      const stifle = femur.clone().lerp(tibia, 0.32);
      if (pelvisSide) addLongBone(`femur-${sideName}`, `Xương đùi ${suffix}`, "Femur", "hindlimb", pelvisSide, stifle, axes.halfHeight * 0.039, "Xương đùi nối ổ cối với khớp gối (stifle).", true);
      const patella = addRecord(`patella-${sideName}`, `Xương bánh chè ${suffix}`, "Patella", "hindlimb", stifle, "Xương bánh chè ở mặt trước khớp gối; vị trí minh họa theo rig.");
      addEllipsoid(patella, "Patella · mặt khớp", stifle.clone().addScaledVector(longitudinal, -axes.halfLength * 0.012), new THREE.Vector3(axes.halfHeight * 0.017, axes.halfHeight * 0.022, axes.halfHeight * 0.014));
      addLongBone(`tibia-${sideName}`, `Xương chày ${suffix}`, "Tibia", "hindlimb", stifle, tibia, axes.halfHeight * 0.03, "Xương chày chịu lực chính từ gối đến cổ chân sau.");
      const fibulaEnd = tibia.clone().lerp(hock ?? tibia, 0.35).addScaledVector(side, (sideName === "l" ? -1 : 1) * axes.halfWidth * 0.018);
      addLongBone(`fibula-${sideName}`, `Xương mác tiêu giảm ${suffix}`, "Fibula (rudimentum)", "hindlimb", tibia.clone().addScaledVector(side, (sideName === "l" ? -1 : 1) * axes.halfWidth * 0.018), fibulaEnd, axes.halfHeight * 0.008, "Xương mác ngựa tiêu giảm, dính một phần với xương chày.");
    }
    if (tibia && hock) {
      const calcaneusEnd = hock.clone().addScaledVector(longitudinal, -axes.halfLength * 0.035).addScaledVector(height, axes.halfHeight * 0.035);
      addLongBone(`calcaneus-${sideName}`, `Xương gót ${suffix}`, "Calcaneus", "hindlimb", hock, calcaneusEnd, axes.halfHeight * 0.018, "Mấu gót lồi ra phía sau cổ chân (hock).", true);
      const tarsals = ["Xương sên", "Xương cổ chân trung tâm", "Xương cổ chân I", "Xương cổ chân II", "Xương cổ chân III", "Xương cổ chân IV"];
      tarsals.forEach((name, index) => {
        const point = tibia.clone().lerp(hock, 0.76 + index * 0.025).addScaledVector(side, ((index % 3) - 1) * axes.halfWidth * 0.012);
        const root = addRecord(`tarsal-${sideName}-${index}`, `${name} ${suffix}`, "Ossa tarsi", "hindlimb", point, "Các xương cổ chân (tarsus) được tách riêng dạng minh họa.");
        addEllipsoid(root, name, point, new THREE.Vector3(axes.halfWidth * 0.013, axes.halfHeight * 0.014, axes.halfWidth * 0.014));
      });
    }
    if (hock && fetlock) {
      addLongBone(`mt3-${sideName}`, `Xương bàn III sau ${suffix}`, "Os metatarsale III", "hindlimb", hock, fetlock, axes.halfHeight * 0.018, "Xương bàn chính của chi sau.", true);
      for (const splintSign of [-1, 1]) {
        const offset = side.clone().multiplyScalar(splintSign * axes.halfWidth * 0.019);
        addLongBone(`splint-hind-${sideName}-${splintSign}`, `Xương bàn phụ sau ${suffix}`, "Ossa metatarsalia II et IV", "hindlimb", hock.clone().add(offset), fetlock.clone().add(offset.clone().multiplyScalar(0.32)), axes.halfHeight * 0.0055, "Xương bàn phụ II/IV ở hai cạnh xương bàn III.");
      }
    }
    if (fetlock && pastern) addLongBone(`p1-hind-${sideName}`, `Đốt ngón gần sau ${suffix}`, "Phalanx proximalis (P1)", "hindlimb", fetlock, pastern, axes.halfHeight * 0.013, "Đốt gần ngón III chi sau.");
    if (fetlock && pastern && hoof) {
      const p2End = pastern.clone().lerp(hoof, 0.6);
      addLongBone(`p2-hind-${sideName}`, `Đốt ngón giữa sau ${suffix}`, "Phalanx media (P2)", "hindlimb", pastern, p2End, axes.halfHeight * 0.01, "Đốt giữa ngón III chi sau.");
      addLongBone(`p3-hind-${sideName}`, `Xương guốc sau ${suffix}`, "Phalanx distalis (P3)", "hindlimb", p2End, hoof, axes.halfHeight * 0.013, "Xương guốc P3 nằm trong bao móng.");
      for (const signSesamoid of [-1, 1]) {
        const point = fetlock.clone().addScaledVector(side, (sideName === "l" ? -1 : 1) * signSesamoid * axes.halfWidth * 0.014).addScaledVector(height, -axes.halfHeight * 0.015);
        const root = addRecord(`sesamoid-hind-${sideName}-${signSesamoid}`, `Xương vừng gần sau ${suffix}`, "Ossa sesamoidea proximalia", "hindlimb", point, "Cặp xương vừng gần tại khớp đốt bàn-ngón.");
        addEllipsoid(root, "Sesamoid", point, new THREE.Vector3(axes.halfHeight * 0.01, axes.halfHeight * 0.011, axes.halfHeight * 0.009));
      }
      const navicularPoint = p2End.clone().addScaledVector(longitudinal, axes.halfLength * 0.01);
      const navicular = addRecord(`navicular-hind-${sideName}`, `Xương thuyền sau ${suffix}`, "Os sesamoideum distale", "hindlimb", navicularPoint, "Xương thuyền nằm phía sau xương guốc.");
      addEllipsoid(navicular, "Navicular", navicularPoint, new THREE.Vector3(axes.halfHeight * 0.016, axes.halfHeight * 0.009, axes.halfHeight * 0.009));
    }
  }

  // Merge each bone's anatomical pieces into one selectable mesh per material
  // so the detailed layer stays responsive on lower-powered devices.
  const sourceGeometries = new Set<THREE.BufferGeometry>([shaftGeometry, ellipsoidGeometry]);
  let mergeFallback = false;
  for (const record of records) {
    const boneParts: THREE.BufferGeometry[] = [];
    const cartilageParts: THREE.BufferGeometry[] = [];
    record.object.children.forEach((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const geometry = child.geometry.clone();
      child.updateMatrix();
      geometry.applyMatrix4(child.matrix);
      geometry.computeVertexNormals();
      (child.userData.isCartilage ? cartilageParts : boneParts).push(geometry);
      sourceGeometries.add(child.geometry);
    });
    const mergedBone = boneParts.length ? mergeGeometries(boneParts, false) : null;
    const mergedCartilage = cartilageParts.length ? mergeGeometries(cartilageParts, false) : null;
    if (!mergedBone || (cartilageParts.length && !mergedCartilage)) {
      mergeFallback = true;
      [...boneParts, ...cartilageParts].forEach((geometry) => geometry.dispose());
      continue;
    }
    mergedBone.computeBoundingBox();
    mergedBone.computeBoundingSphere();
    mergedCartilage?.computeBoundingBox();
    mergedCartilage?.computeBoundingSphere();
    record.object.clear();
    const boneMesh = new THREE.Mesh(mergedBone, materials.bone);
    boneMesh.name = record.name;
    boneMesh.castShadow = true;
    boneMesh.receiveShadow = true;
    boneMesh.renderOrder = 3;
    boneMesh.userData.boneId = record.id;
    record.object.add(boneMesh);
    if (mergedCartilage) {
      const cartilageMesh = new THREE.Mesh(mergedCartilage, materials.cartilage);
      cartilageMesh.name = `${record.name} · sụn`;
      cartilageMesh.castShadow = true;
      cartilageMesh.receiveShadow = true;
      cartilageMesh.renderOrder = 3;
      cartilageMesh.userData.boneId = record.id;
      cartilageMesh.userData.isCartilage = true;
      record.object.add(cartilageMesh);
    }
  }
  if (!mergeFallback) sourceGeometries.forEach((geometry) => geometry.dispose());

  // Keep generated material/texture resources owned by this layer for cleanup.
  group.userData.skeletonRecords = records;
  group.userData.skeletonMaterials = materials;
  group.userData.ownedTextures = [surface];
  group.userData.skeletonGroupLabels = groupLabels;
  group.userData.skeletonIds = [...byId.keys()];
  return { group, records, materials };
}
