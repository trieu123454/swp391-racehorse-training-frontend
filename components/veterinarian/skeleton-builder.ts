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
  const radialSegments = 20;
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

function loftGeometry(
  stations: { center: THREE.Vector3; lateralRadius: number; verticalRadius: number }[],
  lateral: THREE.Vector3,
  vertical: THREE.Vector3,
  radialSegments = 20,
  capStart = true,
  capEnd = true,
) {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  stations.forEach((station, ring) => {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const angle = segment / radialSegments * Math.PI * 2;
      const point = station.center.clone()
        .addScaledVector(lateral, Math.cos(angle) * station.lateralRadius)
        .addScaledVector(vertical, Math.sin(angle) * station.verticalRadius);
      vertices.push(point.x, point.y, point.z);
      uvs.push(segment / radialSegments, ring / Math.max(1, stations.length - 1));
    }
  });
  for (let ring = 0; ring < stations.length - 1; ring += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const current = ring * radialSegments + segment;
      const next = ring * radialSegments + (segment + 1) % radialSegments;
      const nextRing = current + radialSegments;
      const nextRingNext = next + radialSegments;
      indices.push(current, next, nextRing, next, nextRingNext, nextRing);
    }
  }
  const endOffset = (stations.length - 1) * radialSegments;
  if (capStart) {
    const startCenter = vertices.length / 3;
    vertices.push(stations[0].center.x, stations[0].center.y, stations[0].center.z);
    uvs.push(0.5, 0);
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments;
      indices.push(startCenter, next, segment);
    }
  }
  if (capEnd) {
    const end = stations[stations.length - 1].center;
    const endCenter = vertices.length / 3;
    vertices.push(end.x, end.y, end.z);
    uvs.push(0.5, 1);
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const next = (segment + 1) % radialSegments;
      indices.push(endCenter, endOffset + segment, endOffset + next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function triangularPlateGeometry(points: [THREE.Vector3, THREE.Vector3, THREE.Vector3], normal: THREE.Vector3, thickness: number) {
  const vertices: number[] = [];
  const indices = [0, 1, 2, 5, 4, 3, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0];
  for (const sign of [1, -1]) for (const point of points) {
    const vertex = point.clone().addScaledVector(normal, sign * thickness * 0.5);
    vertices.push(vertex.x, vertex.y, vertex.z);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildEquineSkeletonLayer(
  nodes: Map<string, THREE.Bone>,
  axes: SkeletonAxes,
  options: { through?: "spine" | "ribs" | "head" } = {},
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
  const ownedLabelTextures: THREE.Texture[] = [];
  const ownedLabelMaterials: THREE.Material[] = [];
  const materials = {
    bone: new THREE.MeshStandardMaterial({ color: "#E8E0D0", roughness: 0.68, metalness: 0, bumpMap: surface, bumpScale: 0.0048 }),
    cartilage: new THREE.MeshStandardMaterial({ color: "#D5CFC2", roughness: 0.54, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false }),
    tooth: new THREE.MeshStandardMaterial({ color: "#F8F4E8", roughness: 0.38, metalness: 0, bumpMap: surface, bumpScale: 0.002 }),
  };
  const shaftGeometry = boneGeometry();
  const ellipsoidGeometry = new THREE.SphereGeometry(1, 24, 16);
  const sourceGeometries = new Set<THREE.BufferGeometry>([shaftGeometry, ellipsoidGeometry]);
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
    if (material === materials.tooth) mesh.userData.isTooth = true;
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
    const jointRadius = radius * 1.2;
    const epiphysis = new THREE.Vector3(jointRadius * 1.12, radius * 0.62, jointRadius * 1.04);
    addEllipsoid(root, `${name} · đầu gần`, start.clone().addScaledVector(direction, radius * 0.12), epiphysis, direction);
    addEllipsoid(root, `${name} · đầu xa`, end.clone().addScaledVector(direction, -radius * 0.12), epiphysis.clone().multiply(new THREE.Vector3(1.04, 1, 1.06)), direction);
    const articularSurface = new THREE.Vector3(jointRadius * 0.82, radius * 0.13, jointRadius * 0.78);
    addEllipsoid(root, `${name} · sụn khớp gần`, start.clone().addScaledVector(direction, radius * 0.08), articularSurface, direction, materials.cartilage);
    addEllipsoid(root, `${name} · sụn khớp xa`, end.clone().addScaledVector(direction, -radius * 0.08), articularSurface, direction, materials.cartilage);
    return root;
  }

  function finishLayer() {
    let mergeFallback = false;
    for (const record of records) {
      const boneParts: THREE.BufferGeometry[] = [];
      const cartilageParts: THREE.BufferGeometry[] = [];
      const toothParts: THREE.BufferGeometry[] = [];
      record.object.children.forEach((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const geometry = child.geometry.clone();
        child.updateMatrix();
        geometry.applyMatrix4(child.matrix);
        geometry.computeVertexNormals();
        if (child.userData.isCartilage) cartilageParts.push(geometry);
        else if (child.userData.isTooth) toothParts.push(geometry);
        else boneParts.push(geometry);
        sourceGeometries.add(child.geometry);
      });
      const mergedBone = boneParts.length ? mergeGeometries(boneParts, false) : null;
      const mergedCartilage = cartilageParts.length ? mergeGeometries(cartilageParts, false) : null;
      const mergedTooth = toothParts.length ? mergeGeometries(toothParts, false) : null;
      if ((boneParts.length && !mergedBone) || (cartilageParts.length && !mergedCartilage) || (toothParts.length && !mergedTooth)) {
        mergeFallback = true;
        [...boneParts, ...cartilageParts, ...toothParts].forEach((geometry) => geometry.dispose());
        continue;
      }
      mergedBone?.computeBoundingBox();
      mergedBone?.computeBoundingSphere();
      mergedCartilage?.computeBoundingBox();
      mergedCartilage?.computeBoundingSphere();
      mergedTooth?.computeBoundingBox();
      mergedTooth?.computeBoundingSphere();
      record.object.clear();
      if (mergedBone) {
        const boneMesh = new THREE.Mesh(mergedBone, materials.bone);
        boneMesh.name = record.name;
        boneMesh.castShadow = true;
        boneMesh.receiveShadow = true;
        boneMesh.renderOrder = 3;
        boneMesh.userData.boneId = record.id;
        record.object.add(boneMesh);
      }
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
      if (mergedTooth) {
        const toothMesh = new THREE.Mesh(mergedTooth, materials.tooth);
        toothMesh.name = `${record.name} · răng`;
        toothMesh.castShadow = true;
        toothMesh.receiveShadow = true;
        toothMesh.renderOrder = 4;
        toothMesh.userData.boneId = record.id;
        toothMesh.userData.isTooth = true;
        record.object.add(toothMesh);
      }
    }

    const keyLabelIds = new Set([
      "skull", "mandible", "t6", "t10", "rib-8-l", "sternum-1",
      "scapula-trái", "radius-trái", "pelvis-trái", "femur-l", "tibia-l", "mt3-l",
    ]);
    const leftAnchor = worldPosition("clavicle_l_0203");
    const viewSide = side.clone().multiplyScalar(leftAnchor ? Math.sign(leftAnchor.dot(side)) || -1 : -1);
    for (const record of records.filter((candidate) => keyLabelIds.has(candidate.id))) {
      const labelLayer = categoryFor(record.group).getObjectByName("skeleton-labels") as THREE.Group | undefined
        ?? (() => {
          const layer = new THREE.Group();
          layer.name = "skeleton-labels";
          layer.visible = false;
          categoryFor(record.group).add(layer);
          return layer;
        })();
      const verticalOffsets: Record<string, number> = {
        skull: 0.11, mandible: -0.12, t6: 0.12, t10: 0.18,
        "rib-8-l": -0.1, "sternum-1": -0.13, "scapula-trái": 0.13,
        "radius-trái": -0.13, "pelvis-trái": 0.12, "femur-l": 0.12,
        "tibia-l": -0.12, "mt3-l": 0.1,
      };
      const longitudinalOffsets: Record<string, number> = {
        t6: -0.11, t10: 0.11, "rib-8-l": 0.1, "sternum-1": 0.1,
        "femur-l": 0.08, "tibia-l": -0.06, "mt3-l": -0.1,
      };
      const labelPosition = record.anchor.clone()
        .addScaledVector(height, axes.halfHeight * (verticalOffsets[record.id] ?? 0.1))
        .addScaledVector(longitudinal, axes.halfHeight * (longitudinalOffsets[record.id] ?? 0))
        .addScaledVector(viewSide, axes.halfWidth * 0.12);
      const leaderGeometry = new THREE.BufferGeometry().setFromPoints([record.anchor, labelPosition]);
      const leaderMaterial = new THREE.LineBasicMaterial({ color: "#6d8d92", transparent: true, opacity: 0.72, depthTest: false, depthWrite: false });
      const leader = new THREE.Line(leaderGeometry, leaderMaterial);
      leader.name = `leader-${record.id}`;
      leader.renderOrder = 7;
      labelLayer.add(leader);
      ownedLabelMaterials.push(leaderMaterial);

      const canvas = document.createElement("canvas");
      canvas.width = 384;
      canvas.height = 96;
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.fillStyle = "rgba(255,255,255,0.96)";
      context.strokeStyle = "#d4e1df";
      context.lineWidth = 3;
      context.beginPath();
      context.roundRect(3, 3, canvas.width - 6, canvas.height - 6, 20);
      context.fill();
      context.stroke();
      context.fillStyle = "#36566a";
      context.font = "600 25px Arial, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(record.name, canvas.width / 2, 37, canvas.width - 24);
      context.fillStyle = "#667b84";
      context.font = "italic 19px Arial, sans-serif";
      context.fillText(record.latin, canvas.width / 2, 68, canvas.width - 24);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      const labelMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
      const sprite = new THREE.Sprite(labelMaterial);
      sprite.name = `label-${record.id}`;
      sprite.position.copy(labelPosition);
      sprite.scale.set(0.46, 0.115, 1);
      sprite.userData.baseLabelScale = [0.46, 0.115];
      sprite.renderOrder = 8;
      labelLayer.add(sprite);
      ownedLabelTextures.push(texture);
      ownedLabelMaterials.push(labelMaterial);
    }
    if (!mergeFallback) sourceGeometries.forEach((geometry) => geometry.dispose());
    group.userData.skeletonRecords = records;
    group.userData.skeletonMaterials = materials;
    group.userData.ownedTextures = [surface, ...ownedLabelTextures];
    group.userData.ownedLabelMaterials = ownedLabelMaterials;
    group.userData.skeletonGroupLabels = groupLabels;
    group.userData.skeletonIds = [...byId.keys()];
    group.userData.estimated = true;
    return { group, records, materials };
  }

  function addVertebra(
    id: string,
    name: string,
    latin: string,
    center: THREE.Vector3,
    size: number,
    processHeight: number,
    tangent: THREE.Vector3,
    segmentLength: number,
    special: "atlas" | "axis" | "sacral" | "tail" | null = null,
  ) {
    const root = addRecord(id, name, latin, "axial", center, `Vị trí và hình dạng của ${name} được dựng ước lượng theo rig để minh họa học tập.`, ["C1", "C2", "T3", "T6", "T10", "L3", "CA1"].includes(name));
    const vertebralAxis = tangent.clone().normalize();
    addEllipsoid(root, `${name} · thân đốt`, center, new THREE.Vector3(size * 0.8, Math.max(size * 0.9, segmentLength * 0.72), size * 0.85), vertebralAxis);
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
      addShaft(root, "Axis · mỏm nha", center.clone().addScaledVector(longitudinal, -size * 0.35), center.clone().addScaledVector(longitudinal, -size * 1.05), size * 0.28);
      addShaft(root, "Axis · gai trục", center.clone().addScaledVector(height, size * 0.25), dorsal.clone().addScaledVector(longitudinal, -size * 0.3), size * 0.31);
    }
    if (special === "sacral") {
      addEllipsoid(root, `${name} · cánh xương cùng`, center.clone().addScaledVector(side, size * 0.9), new THREE.Vector3(size * 0.5, size * 0.42, size * 1.5));
    }
    return root;
  }

  // Fit all vertebral regions to one continuous spline built from the horse rig.
  const spineAnchorIds = [
    "head_019", "neck_05_018", "neck_04_017", "neck_03_016", "neck_02_015", "neck_01_014",
    "spine_04_012", "spine_03_011", "spine_02_010", "spine_01_09", "pelvis_08",
    "tail_01_0367", "tail_02_0368", "tail_03_0369", "tail_04_0370", "tail_05_0371",
  ];
  const spineAnchors = spineAnchorIds.map(worldPosition);
  const hasContinuousRig = spineAnchors.every((point): point is THREE.Vector3 => point !== null);
  let thoracic: THREE.Vector3[] = [];
  if (hasContinuousRig) {
    const spineCurve = new THREE.CatmullRomCurve3(spineAnchors, false, "centripetal");
    const divisions = 2000;
    const cumulativeLengths = spineCurve.getLengths(divisions);
    const totalLength = cumulativeLengths[divisions];
    const arcFractionAtParam = (parameter: number) => {
      const position = THREE.MathUtils.clamp(parameter, 0, 1) * divisions;
      const before = Math.floor(position);
      const after = Math.min(divisions, before + 1);
      const portion = position - before;
      const distance = THREE.MathUtils.lerp(cumulativeLengths[before], cumulativeLengths[after], portion);
      return distance / totalLength;
    };
    const anchorFractions = spineAnchors.map((_, index) => arcFractionAtParam(index / (spineAnchors.length - 1)));
    const sampleArcRange = (start: number, end: number, count: number) => {
      const startFraction = anchorFractions[start];
      const endFraction = anchorFractions[end];
      const intervalLength = Math.max(0, (endFraction - startFraction) * totalLength);
      return Array.from({ length: count }, (_, index) => {
        const u = THREE.MathUtils.lerp(startFraction, endFraction, (index + 0.5) / count);
        const point = spineCurve.getPointAt(u);
        point.y -= axes.halfHeight * 0.055;
        return {
          point,
          tangent: spineCurve.getTangentAt(u).normalize(),
          segmentLength: intervalLength / count,
        };
      });
    };

    sampleArcRange(0, 6, 7).forEach(({ point, tangent, segmentLength }, index) => {
      const number = index + 1;
      const taper = THREE.MathUtils.lerp(0.72, 1, index / 6);
      const center = point.clone();
      if (number === 1) center.lerp(spineAnchors[0], 0.24).addScaledVector(height, -axes.halfHeight * 0.006);
      addVertebra(`c${number}`, `C${number}`, number === 1 ? "Atlas" : number === 2 ? "Axis" : `Vertebra cervicalis ${number}`, center, axes.halfHeight * 0.025 * taper, axes.halfHeight * 0.019 * taper, tangent, segmentLength, number === 1 ? "atlas" : number === 2 ? "axis" : null);
    });

    const thoracicSamples = sampleArcRange(6, 9, 18);
    thoracic = thoracicSamples.map(({ point }) => point);
    thoracicSamples.forEach(({ point, tangent, segmentLength }, index) => {
      const number = index + 1;
      const withersFactor = number >= 3 && number <= 10 ? 1.5 : number <= 2 ? 1.2 : 1;
      addVertebra(`t${number}`, `T${number}`, `Vertebra thoracica ${number}`, point, axes.halfHeight * 0.027, axes.halfHeight * 0.04 * withersFactor, tangent, segmentLength);
    });

    sampleArcRange(9, 10, 6).forEach(({ point, tangent, segmentLength }, index) => {
      const number = index + 1;
      addVertebra(`l${number}`, `L${number}`, `Vertebra lumbalis ${number}`, point, axes.halfHeight * 0.03, axes.halfHeight * 0.045, tangent, segmentLength);
    });

    const pelvisFraction = anchorFractions[10];
    const fusedSpread = Math.min(0.016, axes.halfLength * 0.035 / totalLength);
    Array.from({ length: 5 }, (_, index) => {
      const u = pelvisFraction + ((index - 2) / 4) * fusedSpread;
      const point = spineCurve.getPointAt(THREE.MathUtils.clamp(u, 0, 1));
      point.y -= axes.halfHeight * 0.055;
      const tangent = spineCurve.getTangentAt(THREE.MathUtils.clamp(u, 0, 1)).normalize();
      const size = axes.halfHeight * 0.031;
      addVertebra(`s${index + 1}`, `S${index + 1}`, `Vertebra sacralis ${index + 1}`, point, size, axes.halfHeight * 0.07, tangent, size * 1.6, "sacral");
    });

    sampleArcRange(10, 15, 18).forEach(({ point, tangent, segmentLength }, index) => {
      const number = index + 1;
      const ratio = 1 - (index / 18) * 0.54;
      addVertebra(`ca${number}`, `CA${number}`, `Vertebra caudalis ${number}`, point, axes.halfHeight * 0.02 * ratio, axes.halfHeight * 0.026 * ratio, tangent, segmentLength, "tail");
    });
  }

  if (options.through === "spine") return finishLayer();

  // Eighteen ribs per side with separate bone and costal cartilage meshes.
  if (thoracic.length === 18) {
    const ribTips: THREE.Vector3[][] = [[], []];
    thoracic.forEach((root, index) => {
      const number = index + 1;
      const progress = index / 17;
      const lengthFactor = 0.68 + 0.32 * Math.sin(progress * Math.PI);
      // Expand the rib arc to occupy the thorax under the ghost skin; its
      // widest point remains inside the torso width and peaks near rib 10.
      const span = axes.halfWidth * (0.54 + 0.15 * lengthFactor);
      for (const [sideIndex, sign] of [-1, 1].entries()) {
        const ribId = `rib-${number}-${sign < 0 ? "l" : "r"}`;
        const start = root.clone().addScaledVector(height, -axes.halfHeight * 0.012);
        const lower = root.clone()
          .addScaledVector(longitudinal, axes.halfLength * (0.018 + progress * 0.075))
          .addScaledVector(side, sign * span)
          .addScaledVector(height, -axes.halfHeight * (0.34 + 0.12 * lengthFactor));
        const tip = lower.clone().addScaledVector(longitudinal, axes.halfLength * (0.012 + progress * 0.03));
        const isTrueRib = number <= 8;
        const record = addRecord(ribId, `Xương sườn ${number}${sign < 0 ? " trái" : " phải"}`, `Costa ${number}`, "axial", start.clone().lerp(tip, 0.5), `${isTrueRib ? "Sườn thật" : "Sườn giả"}; xương sườn riêng, sụn sườn dựng riêng.`, number === 1 || number === 8 || number === 18);
        const sideSign = sign;
        const curve = new THREE.CatmullRomCurve3([
          start,
          start.clone().lerp(lower, 0.28).addScaledVector(side, sideSign * axes.halfWidth * 0.035),
          start.clone().lerp(lower, 0.7).addScaledVector(longitudinal, axes.halfLength * (0.012 + progress * 0.035)),
          lower,
        ]);
        const rib = addPart(record, "Costa · thân cong", new THREE.TubeGeometry(curve, 20, axes.halfHeight * 0.009, 7, false));
        ribTips[sideIndex].push(tip);
        if (isTrueRib) {
          const sternum = root.clone()
            .addScaledVector(longitudinal, axes.halfLength * (0.03 + progress * 0.07))
            .addScaledVector(height, -axes.halfHeight * 0.43);
          const cartilageCurve = new THREE.CatmullRomCurve3([lower, lower.clone().lerp(sternum, 0.5), sternum]);
          addPart(record, "Cartilago costalis · sụn sườn", new THREE.TubeGeometry(cartilageCurve, 8, axes.halfHeight * 0.0075, 6, false), materials.cartilage);
        }
      }
    });
    // Eight true pairs meet segmented sternebrae; false ribs form the costal arch.
    for (let segment = 0; segment < 8; segment += 1) {
      const point = thoracic[segment].clone()
        .addScaledVector(longitudinal, axes.halfLength * (0.014 + segment * 0.002))
        .addScaledVector(height, -axes.halfHeight * 0.43);
      const next = thoracic[Math.min(segment + 1, 17)].clone()
        .addScaledVector(longitudinal, axes.halfLength * 0.034)
        .addScaledVector(height, -axes.halfHeight * 0.43);
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
  if (options.through === "ribs") return finishLayer();

  // The paired pelvic plates meet at the sacrum and end at the hip sockets.
  const pelvis = worldPosition("hips_0366") ?? worldPosition("pelvis_08");
  if (options.through !== "head" && pelvis) for (const [sideName, suffix] of [["l", "trái"], ["r", "phải"]] as const) {
    const hipJoint = worldPosition(`upperleg_${sideName}_${sideName === "l" ? "0405" : "0474"}`);
    if (!hipJoint) continue;
    const sign = Math.sign(hipJoint.dot(side)) || (sideName === "l" ? -1 : 1);
    const sacralAttach = pelvis.clone().addScaledVector(side, sign * axes.halfHeight * 0.025);
    const iliacCrest = pelvis.clone()
      .addScaledVector(longitudinal, -axes.halfHeight * 0.035)
      .addScaledVector(height, axes.halfHeight * 0.04)
      .addScaledVector(side, sign * axes.halfHeight * 0.05);
    const ischialTuberosity = pelvis.clone()
      .addScaledVector(longitudinal, axes.halfHeight * 0.045)
      .addScaledVector(height, -axes.halfHeight * 0.12)
      .addScaledVector(side, sign * axes.halfHeight * 0.05);
    const pubicRamus = hipJoint.clone()
      .addScaledVector(longitudinal, axes.halfHeight * 0.085)
      .addScaledVector(height, -axes.halfHeight * 0.035)
      .addScaledVector(side, -sign * axes.halfHeight * 0.015);
    const pelvisHalf = addRecord(`pelvis-${suffix}`, `Xương chậu ${suffix}`, "Os coxae", "hindlimb", hipJoint, "Cánh chậu, ổ cối, ngành mu và ụ ngồi ghép thành bản chậu; hình thể ước lượng theo rig.", sideName === "l");
    addPart(pelvisHalf, "Ilium · cánh chậu", triangularPlateGeometry([sacralAttach, iliacCrest, hipJoint], side, axes.halfHeight * 0.024));
    addPart(pelvisHalf, "Pubis · ngành mu", triangularPlateGeometry([hipJoint, pubicRamus, pelvis], side, axes.halfHeight * 0.02));
    addPart(pelvisHalf, "Ischium · ụ ngồi", triangularPlateGeometry([hipJoint, pelvis, ischialTuberosity], side, axes.halfHeight * 0.022));
    addShaft(pelvisHalf, "Crista iliaca · mào chậu", iliacCrest, sacralAttach, axes.halfHeight * 0.012);
    addEllipsoid(pelvisHalf, "Acetabulum · ổ cối", hipJoint, new THREE.Vector3(axes.halfHeight * 0.026, axes.halfHeight * 0.028, axes.halfHeight * 0.024));
  }

  // Follow the rig's head and jaw-end anchors so the upper skull sits on the
  // sloping face profile instead of floating above the translucent head.
  const head = worldPosition("head_019");
  const muzzle = worldPosition("jaw_end_021");
  if (head && muzzle) {
    const forward = longitudinal.clone().negate();
    const skullTip = head.clone().lerp(muzzle, 0.93);
    skullTip.y = THREE.MathUtils.lerp(head.y, muzzle.y, 0.68);
    const skullAxis = skullTip.clone().sub(head).normalize();
    const skullLength = skullTip.distanceTo(head);
    const dorsal = new THREE.Vector3().crossVectors(side, skullAxis).normalize();
    if (dorsal.y < 0) dorsal.negate();
    const skullCenterAt = (t: number) => head.clone().lerp(skullTip, t);
    const skullRadius = (t: number) => {
      const base = t < 0.1 ? THREE.MathUtils.lerp(0.034, 0.061, t / 0.1)
        : t < 0.25 ? THREE.MathUtils.lerp(0.061, 0.072, (t - 0.1) / 0.15)
        : t < 0.43 ? THREE.MathUtils.lerp(0.072, 0.063, (t - 0.25) / 0.18)
        : t < 0.7 ? THREE.MathUtils.lerp(0.063, 0.044, (t - 0.43) / 0.27)
        : t < 0.88 ? THREE.MathUtils.lerp(0.044, 0.029, (t - 0.7) / 0.18)
        : THREE.MathUtils.lerp(0.029, 0.016, (t - 0.88) / 0.12);
      return base * 1.15;
    };
    const skull = addRecord("skull", "Xương sọ", "Cranium", "head", skullCenterAt(0.3), "Mesh sọ dài liền khối, gồm sọ não và phần mặt; tỷ lệ, ổ mắt và các chi tiết nhỏ là ước lượng minh họa theo rig, không phải dữ liệu CT.", true);
    const skullStations = [0.16, 0.19, 0.31, 0.44, 0.58, 0.73, 0.87, 0.96, 1].map((t) => {
      const radius = skullRadius(t) * axes.halfHeight;
      const lateralScale = t < 0.3 ? 1 : THREE.MathUtils.lerp(1, 0.72, (t - 0.3) / 0.7);
      const verticalScale = t < 0.3 ? 0.92 : THREE.MathUtils.lerp(0.92, 0.55, (t - 0.3) / 0.7);
      return { center: skullCenterAt(t), lateralRadius: radius * lateralScale, verticalRadius: radius * verticalScale };
    });
    addPart(skull, "Cranium + maxilla · vỏ sọ liền", loftGeometry(skullStations, side, dorsal, 28, false, true));

    // The occipital portion continues directly into the cranium at a shared seam.
    const occipital = addRecord("occipital", "Xương chẩm", "Occipital bone", "head", skullCenterAt(0.08), "Phần chẩm nối với sọ não ở gáy; ranh giới mesh và tỷ lệ là ước lượng minh họa.", true);
    const occipitalStations = [0, 0.045, 0.09, 0.13, 0.16].map((t) => {
      const radius = skullRadius(t) * axes.halfHeight;
      return { center: skullCenterAt(t), lateralRadius: radius, verticalRadius: radius * 0.92 };
    });
    addPart(occipital, "Os occipitale · phần sau sọ", loftGeometry(occipitalStations, side, dorsal, 28, true, false));

    // A single low ridge indicates the nasal bone, rather than two detached bars.
    const nasal = addRecord("nasal-bone", "Xương mũi", "Nasal bone", "head", skullCenterAt(0.66), "Xương mũi dài, thuôn theo sống mũi; hình thể và vị trí là ước lượng minh họa.", true);
    const nasalStations = [0.29, 0.42, 0.58, 0.75, 0.9, 0.99].map((t, index, all) => {
      const radius = skullRadius(t) * axes.halfHeight;
      const taper = 1 - index / (all.length - 1) * 0.58;
      return {
        center: skullCenterAt(t).addScaledVector(dorsal, radius * 0.82),
        lateralRadius: axes.halfHeight * 0.009 * taper,
        verticalRadius: axes.halfHeight * 0.006 * taper,
      };
    });
    addPart(nasal, "Os nasale · sống mũi", loftGeometry(nasalStations, side, dorsal, 12));

    // The orbital rims follow the lateral skull surface and are named separately.
    for (const [eyeSide, eyeId, fallbackSign] of [["trái", "eye_l_059", -1], ["phải", "eye_r_063", 1]] as const) {
      const eyeAnchor = worldPosition(eyeId);
      const sign = eyeAnchor ? Math.sign(eyeAnchor.dot(side)) || fallbackSign : fallbackSign;
      const eyeT = eyeAnchor ? THREE.MathUtils.clamp(eyeAnchor.clone().sub(head).dot(skullAxis) / skullLength, 0.34, 0.82) : 0.55;
      const radiusAtEye = skullRadius(eyeT) * axes.halfHeight;
      const dorsalOffset = eyeAnchor
        ? THREE.MathUtils.clamp(eyeAnchor.clone().sub(skullCenterAt(eyeT)).dot(dorsal), -axes.halfHeight * 0.014, axes.halfHeight * 0.014)
        : 0;
      const orbitCenter = skullCenterAt(eyeT)
        .addScaledVector(dorsal, dorsalOffset)
        .addScaledVector(side, sign * radiusAtEye * 0.76);
      const orbit = addRecord(`orbit-${eyeSide}`, `Hốc mắt ${eyeSide}`, "Orbita", "head", orbitCenter, "Ổ mắt nằm ở một phần ba sau của sọ; viền xương ước lượng, lồng sát vào mesh sọ.");
      const points = Array.from({ length: 33 }, (_, index) => {
        const angle = index / 32 * Math.PI * 2;
        return orbitCenter.clone()
          .addScaledVector(skullAxis, Math.cos(angle) * axes.halfHeight * 0.034)
          .addScaledVector(dorsal, Math.sin(angle) * axes.halfHeight * 0.036)
          .addScaledVector(side, sign * axes.halfHeight * 0.0025);
      });
      addPart(orbit, "Margo orbitalis", new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, axes.halfHeight * 0.0038, 7, false));
    }

    // Upper dental arcade: six incisors and twelve cheek teeth, all fitted close
    // to the maxilla. Tooth coordinates are illustrative, not individual scans.
    const incisors = addRecord("upper-incisors", "Răng cửa hàm trên", "Dentes incisivi maxillares", "head", skullCenterAt(0.94), "Sáu răng cửa hàm trên được minh họa thành một cung nhỏ.");
    for (let index = 0; index < 6; index += 1) {
      const across = (index - 2.5) * axes.halfHeight * 0.012;
      const point = skullCenterAt(0.98).addScaledVector(side, across).addScaledVector(dorsal, -axes.halfHeight * 0.014);
      addEllipsoid(incisors, `Incisor ${index + 1}`, point, new THREE.Vector3(axes.halfHeight * 0.008, axes.halfHeight * 0.011, axes.halfHeight * 0.007), skullAxis, materials.tooth);
    }
    const cheekTeeth = addRecord("upper-cheek-teeth", "Răng hàm trên", "Dentes molares maxillares", "head", skullCenterAt(0.68), "Khoảng mười hai răng hàm má trên được minh họa thành hai dãy.");
    for (const sign of [-1, 1]) for (let index = 0; index < 6; index += 1) {
      const t = 0.54 + index * 0.047;
      const radius = skullRadius(t) * axes.halfHeight;
      const point = skullCenterAt(t)
        .addScaledVector(side, sign * (radius * 0.78 + axes.halfHeight * 0.006))
        .addScaledVector(dorsal, -radius * 0.64);
      addEllipsoid(cheekTeeth, `Molar ${sign < 0 ? "L" : "R"}${index + 1}`, point, new THREE.Vector3(axes.halfHeight * 0.008, axes.halfHeight * 0.014, axes.halfHeight * 0.009), skullAxis, materials.tooth);
    }

    // The mandible uses paired, curved bodies that meet at the chin and rise
    // into broad posterior rami. All dimensions remain estimated to the rig.
    const jawJoint = worldPosition("jaw_020");
    if (jawJoint) {
      const jawPivot = new THREE.Group();
      jawPivot.name = "mandible-pivot";
      jawPivot.position.copy(jawJoint);
      categoryFor("head").add(jawPivot);
      const mandible = addRecord("mandible", "Hàm dưới", "Mandible", "head", jawJoint, "Hai thân xương hàm dưới tạo cung chữ V, có ngành đứng và góc hàm; mesh ước lượng theo các mốc rig.", true);
      const jawCurves: THREE.CatmullRomCurve3[] = [];
      for (const sign of [-1, 1]) {
        const condyle = jawJoint.clone().addScaledVector(side, sign * axes.halfHeight * 0.035);
        const ramus = jawJoint.clone()
          .addScaledVector(forward, axes.halfHeight * 0.06)
          .addScaledVector(height, -axes.halfHeight * 0.03)
          .addScaledVector(side, sign * axes.halfHeight * 0.055);
        const angle = jawJoint.clone()
          .addScaledVector(forward, axes.halfHeight * 0.18)
          .addScaledVector(height, -axes.halfHeight * 0.035)
          .addScaledVector(side, sign * axes.halfHeight * 0.06);
        const body = skullCenterAt(0.63)
          .addScaledVector(height, -axes.halfHeight * 0.025)
          .addScaledVector(side, sign * axes.halfHeight * 0.052);
        const chin = skullCenterAt(0.985).addScaledVector(height, -axes.halfHeight * 0.035).addScaledVector(side, sign * axes.halfHeight * 0.012);
        const curve = new THREE.CatmullRomCurve3([condyle, ramus, angle, body, chin], false, "centripetal");
        jawCurves.push(curve);
        const stations = Array.from({ length: 17 }, (_, index) => {
          const t = index / 16;
          const swelling = Math.sin(Math.min(1, t / 0.46) * Math.PI);
          const radius = axes.halfHeight * (0.024 + swelling * 0.008 - t * 0.004);
          return { center: curve.getPointAt(t), lateralRadius: radius, verticalRadius: radius * 0.82 };
        });
        addPart(mandible, `Mandibula · thân ${sign < 0 ? "trái" : "phải"}`, loftGeometry(stations, side, height, 16));
      }
      const chinCenter = skullCenterAt(0.985).addScaledVector(height, -axes.halfHeight * 0.035);
      addShaft(mandible, "Symphysis mandibulae · khớp cằm", chinCenter.clone().addScaledVector(side, -axes.halfHeight * 0.014), chinCenter.clone().addScaledVector(side, axes.halfHeight * 0.014), axes.halfHeight * 0.018, 1, 0.85);

      const lowerIncisors = addRecord("lower-incisors", "Răng cửa hàm dưới", "Dentes incisivi mandibulares", "head", chinCenter, "Sáu răng cửa dưới minh họa ở khớp cằm.");
      for (let index = 0; index < 6; index += 1) {
        const across = (index - 2.5) * axes.halfHeight * 0.01;
        const point = chinCenter.clone().addScaledVector(side, across).addScaledVector(height, axes.halfHeight * 0.018);
        addEllipsoid(lowerIncisors, `Incisor inferior ${index + 1}`, point, new THREE.Vector3(axes.halfHeight * 0.007, axes.halfHeight * 0.01, axes.halfHeight * 0.006), skullAxis, materials.tooth);
      }
      const lowerMolars = addRecord("lower-cheek-teeth", "Răng hàm dưới", "Dentes molares mandibulares", "head", skullCenterAt(0.63), "Khoảng mười hai răng hàm má dưới được minh họa dọc hai thân hàm.");
      jawCurves.forEach((curve, sideIndex) => {
        const sign = sideIndex === 0 ? -1 : 1;
        for (let index = 0; index < 6; index += 1) {
          const t = 0.38 + index * 0.075;
          const radius = axes.halfHeight * (0.024 + Math.sin(Math.min(1, t / 0.46) * Math.PI) * 0.008 - t * 0.004);
          const point = curve.getPointAt(t)
            .addScaledVector(height, radius * 0.76)
            .addScaledVector(side, sign * radius * 0.58);
          addEllipsoid(lowerMolars, `Molar inferior ${sign < 0 ? "L" : "R"}${index + 1}`, point, new THREE.Vector3(axes.halfHeight * 0.007, axes.halfHeight * 0.012, axes.halfHeight * 0.008), skullAxis, materials.tooth);
        }
      });

      for (const jawRecord of [mandible, lowerIncisors, lowerMolars]) {
        jawRecord.position.sub(jawJoint);
        jawPivot.add(jawRecord);
      }

      const tmj = addRecord("tmj", "Khớp thái dương hàm", "Articulatio temporomandibularis", "head", jawJoint, "Hai lồi cầu hàm khớp với sọ ngay dưới và sau hốc mắt; sụn khớp được minh họa.");
      for (const sign of [-1, 1]) {
        const center = jawJoint.clone().addScaledVector(side, sign * axes.halfHeight * 0.04);
        addEllipsoid(tmj, "Discus articularis · sụn khớp", center, new THREE.Vector3(axes.halfHeight * 0.015, axes.halfHeight * 0.012, axes.halfHeight * 0.014), undefined, materials.cartilage);
      }
    }
  }
  if (options.through === "head") return finishLayer();

  // Forelimbs follow one shared sequence of shoulder, elbow, radius, carpus,
  // cannon bone, pastern and hoof anchors so adjacent elements meet exactly.
  for (const sideName of ["l", "r"] as const) {
    const suffix = sideName === "l" ? "trái" : "phải";
    const sign = sideName === "l" ? -1 : 1;
    const scapulaPoint = worldPosition(`clavicle_${sideName}_${sideName === "l" ? "0203" : "0269"}`);
    const humerus = worldPosition(`upperarm_${sideName}_${sideName === "l" ? "0204" : "0270"}`);
    const radiusMid = worldPosition(`lowerarm_${sideName}_${sideName === "l" ? "0205" : "0271"}`);
    const carpus = worldPosition(`hand_${sideName}_${sideName === "l" ? "0206" : "0272"}`);
    const fetlock = worldPosition(`fingers_01_${sideName}_${sideName === "l" ? "0187" : "0273"}`);
    const pastern = worldPosition(`fingers_02_${sideName}_${sideName === "l" ? "0208" : "0274"}`);
    const hoof = worldPosition(`fingers_end_${sideName}_${sideName === "l" ? "0209" : "0275"}`);
    if (scapulaPoint && humerus) {
      const forward = longitudinal.clone().negate();
      const topFront = scapulaPoint.clone().addScaledVector(forward, axes.halfHeight * 0.03).addScaledVector(height, axes.halfHeight * 0.085);
      const topBack = scapulaPoint.clone().addScaledVector(longitudinal, axes.halfHeight * 0.075).addScaledVector(height, axes.halfHeight * 0.09);
      const scapula = addRecord(`scapula-${suffix}`, `Xương vai ${suffix}`, "Scapula", "forelimb", scapulaPoint, "Tấm vai tam giác dẹt, nghiêng và tì sát thành ngực; vị trí ước lượng theo rig. Vai nối thân qua cơ, không có khớp xương cứng với cột sống.", sideName === "l");
      addPart(scapula, "Scapula · bản tam giác", triangularPlateGeometry([topFront, topBack, scapulaPoint], side, axes.halfHeight * 0.018));
      const nearSide = Math.sign(scapulaPoint.dot(side)) || sign;
      addShaft(scapula, "Spina scapulae · gai vai", topBack.clone().lerp(topFront, 0.55).addScaledVector(side, nearSide * axes.halfHeight * 0.01), scapulaPoint.clone().addScaledVector(side, nearSide * axes.halfHeight * 0.01), axes.halfHeight * 0.006);
      addEllipsoid(scapula, "Cavitas glenoidalis · ổ khớp vai", scapulaPoint, new THREE.Vector3(axes.halfHeight * 0.027, axes.halfHeight * 0.03, axes.halfHeight * 0.027));
    }
    if (scapulaPoint && humerus) addLongBone(`humerus-${suffix}`, `Xương cánh tay ${suffix}`, "Humerus", "forelimb", scapulaPoint, humerus, axes.halfHeight * 0.038, "Xương cánh tay ngựa ngắn, chếch từ ổ vai đến khuỷu; bám theo mốc rig.");
    if (humerus && radiusMid && carpus) {
      const radiusBone = addRecord(`radius-${suffix}`, `Xương quay ${suffix}`, "Radius", "forelimb", humerus.clone().lerp(carpus, 0.5), "Xương quay chạy liên tục từ khuỷu qua mốc cẳng chân đến cổ tay; hai đoạn dùng chung điểm nối theo rig.", true);
      const radiusWidth = axes.halfHeight * 0.049;
      addShaft(radiusBone, "Radius · khuỷu đến thân", humerus, radiusMid, radiusWidth, 1.02, 0.95);
      addShaft(radiusBone, "Radius · thân đến cổ tay", radiusMid, carpus, radiusWidth * 0.96, 1, 0.92);
      const elbowAxis = radiusMid.clone().sub(humerus).normalize();
      const wristAxis = carpus.clone().sub(radiusMid).normalize();
      addEllipsoid(radiusBone, "Radius · đầu gần khuỷu", humerus, new THREE.Vector3(radiusWidth * 1.18, radiusWidth, radiusWidth * 1.12), elbowAxis);
      addEllipsoid(radiusBone, "Radius · chuyển tiếp thân", radiusMid, new THREE.Vector3(radiusWidth * 0.9, radiusWidth * 0.86, radiusWidth * 0.9), elbowAxis.clone().lerp(wristAxis, 0.5));
      addEllipsoid(radiusBone, "Radius · đầu xa cổ tay", carpus, new THREE.Vector3(radiusWidth * 1.15, radiusWidth, radiusWidth * 1.1), wristAxis);

      // The olecranon projects caudally from the elbow and blends into the proximal radius.
      const ulna = addRecord(`ulna-${suffix}`, `Xương trụ ${suffix}`, "Ulna (rút gọn)", "forelimb", humerus, "Mỏm khuỷu và phần gần xương trụ tiêu giảm; thân dưới dính với xương quay ở ngựa trưởng thành.");
      const olecranon = humerus.clone().addScaledVector(longitudinal, axes.halfHeight * 0.045).addScaledVector(height, axes.halfHeight * 0.035);
      const ulnaEnd = humerus.clone().lerp(radiusMid, 0.42).addScaledVector(longitudinal, axes.halfHeight * 0.018);
      addShaft(ulna, "Olecranon · mỏm khuỷu", olecranon, humerus, axes.halfHeight * 0.023, 1.05, 0.92);
      addShaft(ulna, "Ulna · thân gần dính quay", humerus, ulnaEnd, axes.halfHeight * 0.012, 1, 0.85);
      addEllipsoid(ulna, "Olecranon · lồi củ", olecranon, new THREE.Vector3(axes.halfHeight * 0.024, axes.halfHeight * 0.017, axes.halfHeight * 0.02));
    }
    if (radiusMid && carpus) {
      const carpals = ["Xương cổ tay quay", "Xương cổ tay trung gian", "Xương cổ tay trụ", "Xương cổ tay phụ", "Xương cổ tay II", "Xương cổ tay III", "Xương cổ tay IV"];
      carpals.forEach((name, index) => {
        const row = index < 4 ? 0 : 1;
        const col = index < 4 ? index : index - 4;
        const point = carpus.clone()
          .addScaledVector(longitudinal, (col - (row === 0 ? 1.5 : 1)) * axes.halfHeight * 0.018)
          .addScaledVector(height, (row === 0 ? -1 : 1) * axes.halfHeight * 0.012);
        const root = addRecord(`carpal-${sideName}-${index + 1}`, `${name} ${suffix}`, index < 4 ? "Ossa carpi proximalia" : "Ossa carpi distalia", "forelimb", point, "Xương cổ tay nhỏ riêng; sơ đồ 7 xương là mô hình quy ước, biến thiên cá thể có thể có.");
        addEllipsoid(root, name, point, new THREE.Vector3(axes.halfHeight * 0.016, axes.halfHeight * 0.011, axes.halfHeight * 0.013));
      });
    }
    if (carpus && fetlock) {
      addLongBone(`mc3-${sideName}`, `Xương bàn III trước ${suffix}`, "Os metacarpale III", "forelimb", carpus, fetlock, axes.halfHeight * 0.032, "Xương bàn chính (xương ống) của chi trước, nối trực tiếp cổ tay với khớp fetlock.", true);
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

  // Hindlimb sequence: hip socket → femur → stifle → tibia → hock → cannon.
  for (const sideName of ["l", "r"] as const) {
    const suffix = sideName === "l" ? "trái" : "phải";
    const femur = worldPosition(`upperleg_${sideName}_${sideName === "l" ? "0405" : "0474"}`);
    const tibia = worldPosition(`lowerleg_${sideName}_${sideName === "l" ? "0406" : "0475"}`);
    const hock = worldPosition(`foot_${sideName}_${sideName === "l" ? "0407" : "0476"}`);
    const fetlock = worldPosition(`toes_01_${sideName}_${sideName === "l" ? "0408" : "0477"}`);
    const pastern = worldPosition(`toes_02_${sideName}_${sideName === "l" ? "0409" : "0478"}`);
    const hoof = worldPosition(`toes_end_${sideName}_${sideName === "l" ? "0410" : "0479"}`);
    if (femur && tibia && hock) {
      const stifle = tibia.clone();
      const femurRoot = addRecord(`femur-${sideName}`, `Xương đùi ${suffix}`, "Femur", "hindlimb", femur.clone().lerp(stifle, 0.5), "Xương đùi đi từ ổ cối đến gối; điểm upperleg là đầu gần, lowerleg là đầu xa theo rig.", true);
      addShaft(femurRoot, "Femur · thân", femur, stifle, axes.halfHeight * 0.034, 1.02, 0.95);
      const femurAxis = stifle.clone().sub(femur).normalize();
      addEllipsoid(femurRoot, "Femur · chỏm và đầu gần", femur, new THREE.Vector3(axes.halfHeight * 0.039, axes.halfHeight * 0.037, axes.halfHeight * 0.036), femurAxis.clone().negate());
      addEllipsoid(femurRoot, "Femur · lồi cầu xa", stifle, new THREE.Vector3(axes.halfHeight * 0.037, axes.halfHeight * 0.034, axes.halfHeight * 0.035), femurAxis);

      const patella = addRecord(`patella-${sideName}`, `Xương bánh chè ${suffix}`, "Patella", "hindlimb", stifle, "Xương bánh chè nằm phía trước lồi cầu đùi tại khớp gối; vị trí minh họa theo rig.");
      const forward = longitudinal.clone().negate();
      addEllipsoid(patella, "Patella · mặt khớp", stifle.clone().addScaledVector(forward, axes.halfHeight * 0.025), new THREE.Vector3(axes.halfHeight * 0.018, axes.halfHeight * 0.024, axes.halfHeight * 0.016));

      const tibiaRoot = addRecord(`tibia-${sideName}`, `Xương chày ${suffix}`, "Tibia", "hindlimb", stifle.clone().lerp(hock, 0.5), "Xương chày nối gối với hock; đầu dưới chạm cụm xương cổ chân tại đúng mốc foot của rig.", true);
      addShaft(tibiaRoot, "Tibia · thân đến hock", stifle, hock, axes.halfHeight * 0.033, 1, 0.94);
      const tibiaAxis = hock.clone().sub(stifle).normalize();
      addEllipsoid(tibiaRoot, "Tibia · đầu gần gối", stifle, new THREE.Vector3(axes.halfHeight * 0.037, axes.halfHeight * 0.034, axes.halfHeight * 0.035), tibiaAxis.clone().negate());
      addEllipsoid(tibiaRoot, "Tibia · đầu xa hock", hock, new THREE.Vector3(axes.halfHeight * 0.031, axes.halfHeight * 0.029, axes.halfHeight * 0.03), tibiaAxis);

      const sideSign = Math.sign(femur.dot(side)) || (sideName === "l" ? -1 : 1);
      const fibulaOffset = sideSign * axes.halfHeight * 0.027;
      const fibulaStart = stifle.clone().addScaledVector(side, fibulaOffset);
      const fibulaEnd = stifle.clone().lerp(hock, 0.46).addScaledVector(side, fibulaOffset * 0.58);
      addLongBone(`fibula-${sideName}`, `Xương mác tiêu giảm ${suffix}`, "Fibula (rudimentum)", "hindlimb", fibulaStart, fibulaEnd, axes.halfHeight * 0.008, "Đầu trên xương mác áp sát đầu gần xương chày; đoạn dưới tiêu giảm và dính một phần.");
    }
    if (tibia && hock) {
      const calcaneusEnd = hock.clone().addScaledVector(longitudinal, axes.halfHeight * 0.045).addScaledVector(height, axes.halfHeight * 0.04);
      addLongBone(`calcaneus-${sideName}`, `Xương gót ${suffix}`, "Calcaneus", "hindlimb", hock, calcaneusEnd, axes.halfHeight * 0.017, "Mấu gót nhô về phía sau và hơi lên trên từ hock.", true);
      const tarsals = ["Xương sên", "Xương cổ chân trung tâm", "Xương cổ chân I", "Xương cổ chân II", "Xương cổ chân III", "Xương cổ chân IV"];
      tarsals.forEach((name, index) => {
        const row = index < 3 ? 0 : 1;
        const col = index < 3 ? index - 1 : index - 4;
        const point = hock.clone()
          .addScaledVector(longitudinal, (col - (row === 0 ? 0 : 0)) * axes.halfHeight * 0.016)
          .addScaledVector(height, (row === 0 ? -1 : 1) * axes.halfHeight * 0.012);
        const root = addRecord(`tarsal-${sideName}-${index}`, `${name} ${suffix}`, "Ossa tarsi", "hindlimb", point, "Các xương cổ chân (tarsus) được tách riêng dạng minh họa.");
        addEllipsoid(root, name, point, new THREE.Vector3(axes.halfHeight * 0.016, axes.halfHeight * 0.011, axes.halfHeight * 0.013));
      });
    }
    if (hock && fetlock) {
      addLongBone(`mt3-${sideName}`, `Xương bàn III sau ${suffix}`, "Os metatarsale III", "hindlimb", hock, fetlock, axes.halfHeight * 0.022, "Xương bàn chính của chi sau, nối từ cổ chân xuống khớp fetlock.", true);
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

  return finishLayer();
}
