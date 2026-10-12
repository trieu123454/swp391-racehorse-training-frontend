import * as THREE from "three";

export type OrganSystem = "respiratory" | "circulatory" | "digestive" | "urinary" | "nervous";
export type OrganSystems = Record<OrganSystem, boolean>;

export type OrganRecord = {
  id: string;
  name: string;
  system: OrganSystem;
  description: string;
  estimated: boolean;
  label: boolean;
  labelOffset: [number, number];
  anchor: THREE.Vector3;
  object: THREE.Group;
};

export type EquineOrganLayer = {
  organGroup: THREE.Group;
  nerveGroup: THREE.Group;
  records: OrganRecord[];
};

export type OrganAxes = {
  longAxis: "x" | "z";
  sideAxis: "x" | "z";
  headDirection: 1 | -1;
  halfLength: number;
  halfHeight: number;
  halfWidth: number;
};

const systemLabels: Record<OrganSystem, string> = {
  respiratory: "Hô hấp",
  circulatory: "Tuần hoàn",
  digestive: "Tiêu hóa",
  urinary: "Tiết niệu",
  nervous: "Hệ thần kinh",
};

function smoothStep(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function makeRimMaterial(color: string, opacity = 0.94, roughness = 0.48, depthTest = true) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.015,
    transparent: opacity < 1,
    opacity,
    depthWrite: false,
    depthTest,
    side: THREE.DoubleSide,
  });
  material.userData.baseOpacity = opacity;
  material.userData.baseEmissive = material.emissive.getHex();
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      `#include <output_fragment>
      float organRim = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
      gl_FragColor.rgb += vec3(0.10, 0.055, 0.045) * organRim;`,
    );
  };
  material.customProgramCacheKey = () => "equine-organ-rim-v1";
  return material;
}

function sideDirection(axis: "x" | "z", sign = 1) {
  return new THREE.Vector3().setComponent(axis === "x" ? 0 : 2, sign);
}

function makeSideProfile(
  center: THREE.Vector3,
  width: number,
  height: number,
  depth: number,
  axes: OrganAxes,
  draw: (shape: THREE.Shape, width: number, height: number) => void,
) {
  const shape = new THREE.Shape();
  draw(shape, width, height);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: Math.min(width, height, depth) * 0.045,
    bevelThickness: depth * 0.12,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -depth / 2);
  const long = sideDirection(axes.longAxis, axes.headDirection);
  const lateral = sideDirection(axes.sideAxis);
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(long, new THREE.Vector3(0, 1, 0), lateral));
  geometry.translate(center.x, center.y, center.z);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeSweepGeometry(
  curve: THREE.CatmullRomCurve3,
  radius: number,
  longitudinalSegments: number,
  radialSegments: number,
  radiusAt: (t: number) => number = () => 1,
) {
  const frames = curve.computeFrenetFrames(longitudinalSegments, false);
  const positions: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];
  for (let ring = 0; ring <= longitudinalSegments; ring += 1) {
    const t = ring / longitudinalSegments;
    const center = curve.getPointAt(t);
    const ringRadius = radius * radiusAt(t);
    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const point = center.clone()
        .addScaledVector(frames.normals[ring], Math.cos(angle) * ringRadius)
        .addScaledVector(frames.binormals[ring], Math.sin(angle) * ringRadius);
      positions.push(point.x, point.y, point.z);
      uvs.push(segment / radialSegments, t);
      if (ring < longitudinalSegments && segment < radialSegments) {
        const a = ring * (radialSegments + 1) + segment;
        const b = a + radialSegments + 1;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makeDiaphragm(center: THREE.Vector3, axes: OrganAxes) {
  const columns = 18;
  const rows = 12;
  const positions: number[] = [];
  const indices: number[] = [];
  const width = axes.halfWidth * 0.36;
  const verticalRange = axes.halfHeight * 0.25;
  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const height = (0.1 - v * 0.36) * axes.halfHeight;
    for (let column = 0; column <= columns; column += 1) {
      const u = (column / columns) * 2 - 1;
      const lateral = u * width;
      const dome = (1 - u * u) * axes.halfLength * 0.025;
      const long = dome + (v - 0.5) * axes.halfLength * 0.009;
      const point = center.clone()
        .addScaledVector(sideDirection(axes.longAxis, axes.headDirection), long)
        .addScaledVector(sideDirection(axes.sideAxis), lateral)
        .add(new THREE.Vector3(0, height - verticalRange * 0.04, 0));
      positions.push(point.x, point.y, point.z);
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Build illustrative organ meshes in horse-relative coordinates. Rig anchors define scale and orientation only. */
export function buildEquineOrganLayer(
  boneNodes: Map<string, THREE.Bone>,
  axes: OrganAxes,
): EquineOrganLayer {
  const organGroup = new THREE.Group();
  organGroup.name = "Equine organ meshes";
  const nerveGroup = new THREE.Group();
  nerveGroup.name = "Equine major nerves";
  const records: OrganRecord[] = [];
  const long = sideDirection(axes.longAxis, axes.headDirection);
  const rightNode = boneNodes.get("clavicle_r_0269");
  const rightPosition = rightNode?.getWorldPosition(new THREE.Vector3());
  const rightLateral = rightPosition?.getComponent(axes.sideAxis === "x" ? 0 : 2) ?? 1;
  const rightSign = Math.sign(rightLateral) || 1;

  const bodyPoint = (longitudinal: number, height: number, lateral: number) => new THREE.Vector3()
    .addScaledVector(long, longitudinal * axes.halfLength)
    .add(new THREE.Vector3(0, height * axes.halfHeight, 0))
    .addScaledVector(sideDirection(axes.sideAxis), lateral * axes.halfWidth);

  const register = (
    id: string,
    name: string,
    system: OrganSystem,
    description: string,
    anchor: THREE.Vector3,
    labelOffset: [number, number],
    parent = organGroup,
    labelled = true,
  ) => {
    const object = new THREE.Group();
    object.name = name;
    object.userData.organId = id;
    object.userData.organSystem = system;
    object.userData.organName = name;
    object.userData.organDescription = description;
    parent.add(object);
    const record: OrganRecord = { id, name, system, description, estimated: true, label: labelled, labelOffset, anchor, object };
    records.push(record);
    return object;
  };

  const addMesh = (root: THREE.Group, name: string, geometry: THREE.BufferGeometry, color: string, opacity = 0.94, roughness = 0.48) => {
    const mesh = new THREE.Mesh(geometry, makeRimMaterial(color, opacity, roughness));
    mesh.name = name;
    mesh.renderOrder = 4;
    mesh.userData.organId = root.userData.organId;
    root.add(mesh);
    return mesh;
  };

  const addProfile = (
    root: THREE.Group,
    name: string,
    center: THREE.Vector3,
    width: number,
    height: number,
    depth: number,
    color: string,
    draw: (shape: THREE.Shape, width: number, height: number) => void,
    opacity = 0.94,
    roughness = 0.48,
  ) => addMesh(root, name, makeSideProfile(center, width, height, depth, axes, draw), color, opacity, roughness);

  const addTube = (
    root: THREE.Group,
    name: string,
    points: THREE.Vector3[],
    radius: number,
    color: string,
    segments = 36,
    opacity = 0.94,
    radiusAt?: (t: number) => number,
  ) => {
    if (points.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
    const geometry = makeSweepGeometry(curve, radius, segments, 10, radiusAt);
    addMesh(root, name, geometry, color, opacity, 0.46);
  };

  const lungShape = (shape: THREE.Shape, width: number, height: number) => {
    shape.moveTo(-width * 0.47, -height * 0.12);
    shape.bezierCurveTo(-width * 0.5, height * 0.1, -width * 0.37, height * 0.43, -width * 0.11, height * 0.45);
    shape.bezierCurveTo(width * 0.03, height * 0.46, width * 0.1, height * 0.34, width * 0.16, height * 0.23);
    shape.bezierCurveTo(width * 0.28, height * 0.4, width * 0.48, height * 0.31, width * 0.46, height * 0.08);
    shape.bezierCurveTo(width * 0.44, -height * 0.15, width * 0.25, -height * 0.39, width * 0.02, -height * 0.43);
    shape.bezierCurveTo(-width * 0.2, -height * 0.47, -width * 0.43, -height * 0.34, -width * 0.47, -height * 0.12);
    shape.closePath();
  };

  for (const side of [-1, 1]) {
    const isRight = side === 1;
    const lungCenter = bodyPoint(0.105, -0.015, side * rightSign * 0.105);
    const lungId = isRight ? "right-lung" : "left-lung";
    const lungName = isRight ? "Phổi phải" : "Phổi trái";
    const lung = register(lungId, lungName, "respiratory", "Khối phổi nằm trong lồng ngực; mesh hai bên được thu gọn thành các thùy lớn để dễ quan sát.", lungCenter, [isRight ? 74 : -95, isRight ? -28 : 24]);
    addProfile(lung, lungName, lungCenter, axes.halfLength * (isRight ? 0.39 : 0.37), axes.halfHeight * 0.34, axes.halfWidth * 0.19, isRight ? "#E7A1A1" : "#EAB1B0", lungShape, 0.9, 0.42);
  }

  const diaphragmCenter = bodyPoint(0.025, -0.035, 0);
  const diaphragm = register("diaphragm", "Cơ hoành", "respiratory", "Vách cong mỏng ngăn khoang ngực với khoang bụng.", diaphragmCenter, [76, 46]);
  addMesh(diaphragm, "Mặt cơ hoành", makeDiaphragm(diaphragmCenter, axes), "#D6A49A", 0.34, 0.62);

  const heartCenter = bodyPoint(0.105, -0.12, -rightSign * 0.025);
  const heart = register("heart", "Tim", "circulatory", "Cơ quan bơm máu, đặt thấp giữa hai phổi và hơi lệch trái.", heartCenter, [-82, 42]);
  addProfile(heart, "Heart wall", heartCenter, axes.halfLength * 0.145, axes.halfHeight * 0.19, axes.halfWidth * 0.14, "#98283B", (shape, width, height) => {
    // Equine heart silhouette: broad dorsal base, oblique walls, and a tapered ventral apex.
    shape.moveTo(-width * 0.43, height * 0.22);
    shape.bezierCurveTo(-width * 0.45, height * 0.47, width * 0.02, height * 0.54, width * 0.35, height * 0.35);
    shape.bezierCurveTo(width * 0.48, height * 0.26, width * 0.42, height * 0.02, width * 0.3, -height * 0.18);
    shape.bezierCurveTo(width * 0.14, -height * 0.42, -width * 0.08, -height * 0.49, -width * 0.16, -height * 0.5);
    shape.bezierCurveTo(-width * 0.3, -height * 0.42, -width * 0.46, -height * 0.06, -width * 0.43, height * 0.22);
    shape.closePath();
  });
  const heartDorsal = new THREE.Vector3(0, axes.halfHeight * 0.075, 0);
  const aortaOrigin = heartCenter.clone().add(heartDorsal).addScaledVector(long, axes.halfLength * 0.025);
  addTube(heart, "Aortic arch", [
    aortaOrigin,
    aortaOrigin.clone().add(new THREE.Vector3(0, axes.halfHeight * 0.045, 0)),
    aortaOrigin.clone().addScaledVector(long, axes.halfLength * 0.045).add(new THREE.Vector3(0, axes.halfHeight * 0.052, 0)),
    aortaOrigin.clone().addScaledVector(long, axes.halfLength * 0.075).add(new THREE.Vector3(0, axes.halfHeight * 0.015, 0)),
  ], axes.halfWidth * 0.012, "#9C3541", 20, 0.94);
  addTube(heart, "Pulmonary trunk", [
    heartCenter.clone().add(heartDorsal).addScaledVector(long, -axes.halfLength * 0.015),
    heartCenter.clone().add(heartDorsal).addScaledVector(long, -axes.halfLength * 0.035).add(new THREE.Vector3(0, axes.halfHeight * 0.035, 0)),
    heartCenter.clone().add(heartDorsal).addScaledVector(long, -axes.halfLength * 0.065).add(new THREE.Vector3(0, axes.halfHeight * 0.025, 0)),
  ], axes.halfWidth * 0.009, "#B95761", 16, 0.92);

  const liverCenter = bodyPoint(-0.025, -0.05, rightSign * 0.09);
  const liver = register("liver", "Gan", "digestive", "Tạng lớn nằm sát phía bụng sau cơ hoành, phần khối chính nghiêng về bên phải.", liverCenter, [75, -32]);
  addProfile(liver, "Khối gan", liverCenter, axes.halfLength * 0.22, axes.halfHeight * 0.18, axes.halfWidth * 0.2, "#7E4036", (shape, width, height) => {
    shape.moveTo(-width * 0.49, height * 0.17);
    shape.bezierCurveTo(-width * 0.31, height * 0.52, width * 0.05, height * 0.43, width * 0.22, height * 0.33);
    shape.bezierCurveTo(width * 0.53, height * 0.25, width * 0.45, -height * 0.2, width * 0.16, -height * 0.36);
    shape.bezierCurveTo(-width * 0.05, -height * 0.46, -width * 0.3, -height * 0.22, -width * 0.49, height * 0.17);
    shape.closePath();
  });

  const stomachCenter = bodyPoint(-0.12, -0.105, -rightSign * 0.065);
  const stomach = register("stomach", "Dạ dày", "digestive", "Dạ dày ngựa nhỏ, dạng túi cong chữ J ở phần trước bụng và lệch trái.", stomachCenter, [-82, -30]);
  addProfile(stomach, "Túi dạ dày chữ J", stomachCenter, axes.halfLength * 0.125, axes.halfHeight * 0.13, axes.halfWidth * 0.12, "#C96F77", (shape, width, height) => {
    shape.moveTo(-width * 0.4, height * 0.43);
    shape.bezierCurveTo(-width * 0.05, height * 0.59, width * 0.41, height * 0.35, width * 0.38, height * 0.04);
    shape.bezierCurveTo(width * 0.36, -height * 0.15, width * 0.18, -height * 0.1, width * 0.13, -height * 0.28);
    shape.bezierCurveTo(width * 0.1, -height * 0.52, -width * 0.22, -height * 0.52, -width * 0.3, -height * 0.3);
    shape.bezierCurveTo(-width * 0.38, -height * 0.1, -width * 0.2, height * 0.08, -width * 0.4, height * 0.43);
    shape.closePath();
  });

  const smallIntestineCenter = bodyPoint(-0.16, -0.14, 0);
  const smallIntestine = register("small-intestine", "Ruột non", "digestive", "Các quai ruột non được cuộn gọn ở vùng giữa bụng; số quai và đường đi đã giản lược.", smallIntestineCenter, [-86, -32]);
  for (let loop = 0; loop < 5; loop += 1) {
    const phase = loop * 0.54;
    const points = Array.from({ length: 19 }, (_, index) => {
      const t = index / 18;
      const angle = t * Math.PI * 2 + phase;
      return bodyPoint(
        -0.15 + Math.cos(angle) * 0.075,
        -0.095 + Math.sin(angle) * 0.04 + (loop - 2) * 0.009,
        (loop - 2) * 0.04 + Math.sin(angle * 0.5) * 0.014,
      );
    });
    addTube(smallIntestine, `Quai ruột non ${loop + 1}`, points, axes.halfWidth * 0.02, loop % 2 ? "#D79A71" : "#E3AA78", 34, 0.93);
  }

  const cecumCenter = bodyPoint(-0.3, -0.1, rightSign * 0.15);
  const cecum = register("cecum", "Manh tràng", "digestive", "Túi lớn hình dấu phẩy ở bên phải; đáy nằm gần vùng hông, đỉnh cong về phía bụng dưới.", cecumCenter, [84, 42]);
  const cecumBase = bodyPoint(-0.28, 0.055, rightSign * 0.14);
  const cecumPoints = [
    cecumBase,
    bodyPoint(-0.35, 0.025, rightSign * 0.17),
    bodyPoint(-0.365, -0.075, rightSign * 0.17),
    bodyPoint(-0.32, -0.17, rightSign * 0.15),
    bodyPoint(-0.235, -0.22, rightSign * 0.12),
  ];
  addTube(cecum, "Thân và đỉnh manh tràng", cecumPoints, axes.halfWidth * 0.062, "#CF865F", 52, 0.95, (t) => 0.1 + 0.9 * Math.pow(Math.sin(Math.PI * t), 0.36));

  const colonCenter = bodyPoint(-0.2, -0.2, 0);
  const largeColon = register("large-colon", "Đại tràng lớn", "digestive", "Đoạn đại tràng lớn được uốn thành hai vòng chữ U giản lược trong khoang bụng dưới.", colonCenter, [82, -34]);
  const colonPath = [
    bodyPoint(-0.055, -0.09, rightSign * 0.16),
    bodyPoint(-0.16, -0.2, rightSign * 0.18),
    bodyPoint(-0.31, -0.21, rightSign * 0.145),
    bodyPoint(-0.34, -0.105, rightSign * 0.04),
    bodyPoint(-0.3, -0.205, -rightSign * 0.06),
    bodyPoint(-0.16, -0.21, -rightSign * 0.16),
    bodyPoint(-0.05, -0.09, -rightSign * 0.165),
  ];
  addTube(largeColon, "Đại tràng lớn uốn hai vòng", colonPath, axes.halfWidth * 0.052, "#D48B61", 76, 0.95, (t) => 0.74 + 0.26 * Math.sin(Math.PI * t));

  const kidneyShape = (shape: THREE.Shape, width: number, height: number) => {
    shape.moveTo(-width * 0.44, -height * 0.18);
    shape.bezierCurveTo(-width * 0.49, height * 0.16, -width * 0.22, height * 0.52, width * 0.08, height * 0.44);
    shape.bezierCurveTo(width * 0.31, height * 0.38, width * 0.45, height * 0.14, width * 0.3, height * 0.03);
    shape.bezierCurveTo(width * 0.17, -height * 0.06, width * 0.18, -height * 0.17, width * 0.36, -height * 0.21);
    shape.bezierCurveTo(width * 0.15, -height * 0.55, -width * 0.32, -height * 0.49, -width * 0.44, -height * 0.18);
    shape.closePath();
  };
  const lumbarAnchor = boneNodes.get("spine_01_09")?.getWorldPosition(new THREE.Vector3())
    ?? boneNodes.get("pelvis_08")?.getWorldPosition(new THREE.Vector3());
  for (const side of [-1, 1]) {
    const isRight = side === 1;
    const center = (lumbarAnchor
      ? lumbarAnchor.clone()
        .addScaledVector(long, (isRight ? 0.025 : -0.035) * axes.halfLength)
        .addScaledVector(sideDirection(axes.sideAxis), side * rightSign * axes.halfWidth * 0.06)
        .add(new THREE.Vector3(0, -axes.halfHeight * 0.025, 0))
      : bodyPoint(isRight ? -0.005 : -0.09, 0.055, side * rightSign * 0.072))
      .add(new THREE.Vector3(0, -axes.halfHeight * 0.2, 0));
    const kidney = register(isRight ? "right-kidney" : "left-kidney", isRight ? "Thận phải" : "Thận trái", "urinary", "Thận nằm sát thành lưng vùng thắt lưng; vị trí hai bên có chênh lệch nhẹ.", center, [side * rightSign > 0 ? 75 : -82, isRight ? -40 : 38]);
    addProfile(kidney, "Thận hình hạt đậu", center, axes.halfLength * 0.065, axes.halfHeight * 0.1, axes.halfWidth * 0.065, "#775366", kidneyShape, 0.95, 0.42);
  }

  const bladderCenter = bodyPoint(-0.29, -0.24, 0);
  const bladder = register("urinary-bladder", "Bàng quang", "urinary", "Túi chứa nước tiểu ở vùng bụng sau, sát cửa vào khung chậu.", bladderCenter, [78, 34]);
  addProfile(bladder, "Thân bàng quang", bladderCenter, axes.halfLength * 0.06, axes.halfHeight * 0.08, axes.halfWidth * 0.075, "#C98D91", (shape, width, height) => {
    shape.moveTo(0, -height * 0.52);
    shape.bezierCurveTo(-width * 0.45, -height * 0.3, -width * 0.48, height * 0.25, -width * 0.23, height * 0.41);
    shape.bezierCurveTo(-width * 0.05, height * 0.55, width * 0.05, height * 0.55, width * 0.23, height * 0.41);
    shape.bezierCurveTo(width * 0.48, height * 0.25, width * 0.45, -height * 0.3, 0, -height * 0.52);
    shape.closePath();
  });

  const tracheaAnchors = ["head_019", "neck_05_018", "neck_04_017", "neck_03_016", "neck_02_015", "neck_01_014", "spine_04_012"]
    .map((name) => boneNodes.get(name)?.getWorldPosition(new THREE.Vector3()))
    .filter((point): point is THREE.Vector3 => Boolean(point))
    .map((point) => point.add(new THREE.Vector3(0, -axes.halfHeight * 0.09, 0)));
  const tracheaAnchor = bodyPoint(0.23, -0.035, 0);
  const trachea = register("trachea", "Khí quản và phế quản", "respiratory", "Ống khí quản chạy dọc mặt dưới cổ, chia thành hai phế quản chính đi vào phổi.", tracheaAnchor, [82, 34]);
  if (tracheaAnchors.length > 1) {
    const tracheaCurve = new THREE.CatmullRomCurve3(tracheaAnchors, false, "centripetal");
    addTube(trachea, "Khí quản", tracheaAnchors, axes.halfWidth * 0.022, "#C8797D", 56, 0.96);
    const bifurcation = tracheaCurve.getPoint(0.7);
    for (const side of [-1, 1]) {
      addTube(trachea, `Phế quản ${side < 0 ? "trái" : "phải"}`, [
        bifurcation,
        bodyPoint(0.18, -0.12, side * rightSign * 0.09),
        bodyPoint(0.12, -0.04, side * rightSign * 0.18),
      ], axes.halfWidth * 0.014, "#D08A87", 22, 0.92);
    }
    const ringGeometry = new THREE.TorusGeometry(axes.halfWidth * 0.019, axes.halfWidth * 0.0025, 5, 12);
    const ringMaterial = makeRimMaterial("#E8B3A8", 0.92, 0.58);
    const ringNormal = new THREE.Vector3(0, 0, 1);
    for (let index = 1; index <= 14; index += 1) {
      const t = index / 15;
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(tracheaCurve.getPoint(t));
      ring.quaternion.setFromUnitVectors(ringNormal, tracheaCurve.getTangent(t));
      ring.renderOrder = 5;
      ring.userData.organId = trachea.userData.organId;
      trachea.add(ring);
    }
  }

  const spinalNames = ["pelvis_08", "spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012", "neck_01_014", "neck_02_015", "neck_03_016", "neck_04_017", "neck_05_018"];
  const spinalPoints = spinalNames
    .map((name) => boneNodes.get(name)?.getWorldPosition(new THREE.Vector3()))
    .filter((point): point is THREE.Vector3 => Boolean(point));

  const addNervePaths = (
    id: string,
    name: string,
    description: string,
    paths: THREE.Vector3[][],
    radius: number,
    labelOffset: [number, number],
    labelled = false,
  ) => {
    const validPaths = paths.filter((points) => points.length > 1);
    if (!validPaths.length) return;
    const anchorPath = validPaths[0];
    const anchor = anchorPath[Math.floor(anchorPath.length / 2)].clone();
    const root = register(id, name, "nervous", description, anchor, labelOffset, nerveGroup, labelled);
    validPaths.forEach((points, index) => {
      const curve = new THREE.CatmullRomCurve3(points, false, "centripetal");
      const nerve = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(24, points.length * 10), radius, 7, false),
        makeRimMaterial("#E7D18A", 0.48, 0.7, false),
      );
      nerve.name = validPaths.length > 1 ? `${name} ${index + 1}` : name;
      nerve.renderOrder = 6;
      nerve.userData.organId = id;
      root.add(nerve);
    });
    return root;
  };

  const addNerve = (id: string, name: string, description: string, points: THREE.Vector3[], radius: number, labelOffset: [number, number], labelled = false) =>
    addNervePaths(id, name, description, [points], radius, labelOffset, labelled);

  addNerve("spinal-cord", "Tủy sống", "Dải thần kinh trung ương nằm trong ống sống; đường kính và vị trí chỉ minh họa theo trục đốt sống.", spinalPoints, axes.halfWidth * 0.006, [92, -18], true);

  const thoracicAnchors = ["spine_01_09", "spine_02_010", "spine_03_011", "spine_04_012"]
    .map((name) => boneNodes.get(name)?.getWorldPosition(new THREE.Vector3()))
    .filter((point): point is THREE.Vector3 => Boolean(point));
  if (thoracicAnchors.length > 1) {
    const thoracicCurve = new THREE.CatmullRomCurve3(thoracicAnchors, false, "centripetal");
    const ribStations = [0.05, 0.16, 0.27, 0.38, 0.5, 0.62, 0.73, 0.84, 0.95];
    const intercostalPaths = ribStations.flatMap((progress) => {
      const root = thoracicCurve.getPoint(progress);
      const caudalOffset = axes.halfLength * (0.018 + progress * 0.022);
      const ribWidth = axes.halfWidth * (0.56 + Math.sin(progress * Math.PI) * 0.1);
      return [-1, 1].map((side) => {
        const lateral = sideDirection(axes.sideAxis, side * rightSign);
        return [
          root.clone().add(new THREE.Vector3(0, -axes.halfHeight * 0.015, 0)),
          root.clone().addScaledVector(long, caudalOffset * 0.28).addScaledVector(lateral, ribWidth * 0.36)
            .add(new THREE.Vector3(0, -axes.halfHeight * 0.09, 0)),
          root.clone().addScaledVector(long, caudalOffset * 0.68).addScaledVector(lateral, ribWidth * 0.68)
            .add(new THREE.Vector3(0, -axes.halfHeight * 0.23, 0)),
          root.clone().addScaledVector(long, caudalOffset).addScaledVector(lateral, ribWidth * 0.54)
            .add(new THREE.Vector3(0, -axes.halfHeight * 0.32, 0)),
        ];
      });
    });
    addNervePaths(
      "intercostal-nerves",
      "Thần kinh liên sườn",
      "Các nhánh ngực đi dọc bờ sau sườn rồi tiếp tục về thành bụng; số nhánh và đường đi được giản lược theo rig.",
      intercostalPaths,
      axes.halfWidth * 0.0028,
      [86, 28],
    );

    const dorsalRamusPaths = [0.12, 0.31, 0.5, 0.69, 0.88].flatMap((progress) => {
      const root = thoracicCurve.getPoint(progress);
      return [-1, 1].map((side) => {
        const lateral = sideDirection(axes.sideAxis, side * rightSign);
        return [
          root.clone(),
          root.clone().add(new THREE.Vector3(0, axes.halfHeight * 0.035, 0)),
          root.clone().addScaledVector(long, -axes.halfLength * 0.012)
            .addScaledVector(lateral, axes.halfWidth * 0.075)
            .add(new THREE.Vector3(0, axes.halfHeight * 0.025, 0)),
        ];
      });
    });
    addNervePaths(
      "thoracic-dorsal-rami",
      "Nhánh lưng thần kinh ngực",
      "Các nhánh lưng tỏa sang hai bên vùng đốt sống ngực; số nhánh được giản lược để dễ quan sát.",
      dorsalRamusPaths,
      axes.halfWidth * 0.0026,
      [88, -22],
    );

    const lateralCutaneousPaths = [0.22, 0.5, 0.78].flatMap((progress) => {
      const root = thoracicCurve.getPoint(progress);
      const caudalOffset = axes.halfLength * (0.018 + progress * 0.022);
      const ribWidth = axes.halfWidth * (0.56 + Math.sin(progress * Math.PI) * 0.1);
      return [-1, 1].map((side) => {
        const lateral = sideDirection(axes.sideAxis, side * rightSign);
        return [
          root.clone().addScaledVector(long, caudalOffset * 0.55).addScaledVector(lateral, ribWidth * 0.58)
            .add(new THREE.Vector3(0, -axes.halfHeight * 0.2, 0)),
          root.clone().addScaledVector(long, caudalOffset * 0.66).addScaledVector(lateral, ribWidth * 0.76)
            .add(new THREE.Vector3(0, -axes.halfHeight * 0.19, 0)),
          root.clone().addScaledVector(long, caudalOffset * 0.72).addScaledVector(lateral, ribWidth * 0.82)
            .add(new THREE.Vector3(0, -axes.halfHeight * 0.14, 0)),
        ];
      });
    });
    addNervePaths(
      "thoracic-lateral-cutaneous-branches",
      "Nhánh bì bên thành ngực",
      "Các nhánh cảm giác ngắn tỏa từ khoang liên sườn ra thành ngực bên.",
      lateralCutaneousPaths,
      axes.halfWidth * 0.0023,
      [88, 24],
    );

    const sympatheticPaths = [-1, 1].map((side) => {
      const lateral = sideDirection(axes.sideAxis, side * rightSign);
      return [0.08, 0.34, 0.6, 0.86].map((progress) =>
        thoracicCurve.getPoint(progress).addScaledVector(lateral, axes.halfWidth * 0.045)
          .add(new THREE.Vector3(0, axes.halfHeight * 0.015, 0)),
      );
    });
    addNervePaths(
      "thoracic-sympathetic-trunks",
      "Thân giao cảm ngực",
      "Hai thân giao cảm chạy dọc đầu các xương sườn; đường hạch được giản lược.",
      sympatheticPaths,
      axes.halfWidth * 0.0028,
      [88, -20],
    );

    const splanchnicPaths = [-1, 1].map((side) => {
      const lateral = sideDirection(axes.sideAxis, side * rightSign);
      const thoracicRoot = thoracicCurve.getPoint(0.18).addScaledVector(lateral, axes.halfWidth * 0.045);
      return [
        thoracicRoot,
        bodyPoint(-0.02, -0.025, side * rightSign * 0.055).add(new THREE.Vector3(0, axes.halfHeight * 0.1, 0)),
        bodyPoint(-0.1, -0.06, side * rightSign * 0.045).add(new THREE.Vector3(0, axes.halfHeight * 0.1, 0)),
      ];
    });
    addNervePaths(
      "greater-splanchnic-nerves",
      "Thần kinh tạng lớn",
      "Các nhánh giao cảm đi từ ngực qua cơ hoành tới vùng bụng; vị trí hạch chỉ minh họa.",
      splanchnicPaths,
      axes.halfWidth * 0.0028,
      [88, 26],
    );
  }

  const lumbarNervePaths = [-1, 1].map((side) => [
    bodyPoint(-0.02, 0.025, side * rightSign * 0.055),
    bodyPoint(-0.12, -0.015, side * rightSign * 0.12),
    bodyPoint(-0.23, -0.075, side * rightSign * 0.15),
    bodyPoint(-0.3, -0.15, side * rightSign * 0.105),
  ]);
  addNervePaths(
    "lumbar-ventral-branches",
    "Nhánh thần kinh thắt lưng",
    "Các nhánh bụng thắt lưng được giản lược dọc thành bụng và vùng hông.",
    lumbarNervePaths,
    axes.halfWidth * 0.0028,
    [88, 28],
  );

  const lumbarDorsalPaths = [-1, 1].map((side) => [
    boneNodes.get("spine_01_09")?.getWorldPosition(new THREE.Vector3()),
    boneNodes.get("spine_01_09")?.getWorldPosition(new THREE.Vector3())?.addScaledVector(sideDirection(axes.sideAxis), side * rightSign * axes.halfWidth * 0.035),
    bodyPoint(-0.075, 0.07, side * rightSign * 0.11),
    bodyPoint(-0.19, 0.055, side * rightSign * 0.14),
  ].filter((point): point is THREE.Vector3 => Boolean(point)));
  addNervePaths(
    "lumbar-dorsal-rami",
    "Nhánh lưng thần kinh thắt lưng",
    "Các nhánh lưng tỏa dọc vùng thắt lưng và hông.",
    lumbarDorsalPaths,
    axes.halfWidth * 0.0025,
    [88, -22],
  );

  const vagusPoints = [
    boneNodes.get("neck_05_018")?.getWorldPosition(new THREE.Vector3()),
    boneNodes.get("neck_02_015")?.getWorldPosition(new THREE.Vector3()),
    boneNodes.get("neck_01_014")?.getWorldPosition(new THREE.Vector3()),
    boneNodes.get("spine_04_012")?.getWorldPosition(new THREE.Vector3()),
    bodyPoint(0.04, -0.08, -rightSign * 0.045),
    stomachCenter.clone(),
  ].filter((point): point is THREE.Vector3 => Boolean(point)).map((point) => point.add(new THREE.Vector3(0, -axes.halfHeight * 0.065, 0)));
  addNerve("vagus-nerve", "Thần kinh phế vị", "Đường thần kinh chính từ cổ xuống ngực và vùng bụng trước, được giản lược thành một cặp.", vagusPoints, axes.halfWidth * 0.0048, [-88, -20]);

  const phrenicPaths = [-1, 1].map((side) => {
    const lateral = sideDirection(axes.sideAxis, side * rightSign);
    const neckPoints = ["neck_03_016", "neck_02_015", "neck_01_014"]
      .map((name) => boneNodes.get(name)?.getWorldPosition(new THREE.Vector3()))
      .filter((point): point is THREE.Vector3 => Boolean(point))
      .map((point) => point.addScaledVector(lateral, axes.halfWidth * 0.025)
        .add(new THREE.Vector3(0, -axes.halfHeight * 0.045, 0)));
    const diaphragmTarget = diaphragmCenter.clone()
      .add(new THREE.Vector3(0, axes.halfHeight * 0.1, 0))
      .addScaledVector(lateral, axes.halfWidth * 0.045);
    return [
      ...neckPoints,
      bodyPoint(0.16, -0.06, side * rightSign * 0.065).add(new THREE.Vector3(0, axes.halfHeight * 0.1, 0)),
      bodyPoint(0.08, -0.08, side * rightSign * 0.06).add(new THREE.Vector3(0, axes.halfHeight * 0.1, 0)),
      diaphragmTarget,
    ];
  });
  addNervePaths(
    "phrenic-nerves",
    "Thần kinh hoành",
    "Cặp thần kinh từ vùng cổ đi qua ngực tới cơ hoành; đường đi được giản lược theo rig.",
    phrenicPaths,
    axes.halfWidth * 0.0032,
    [86, 28],
  );

  for (const side of [-1, 1]) {
    const sideName = side < 0 ? "trái" : "phải";
    const lateral = sideDirection(axes.sideAxis, side * rightSign);
    const shoulderName = side < 0 ? "clavicle_l_0203" : "clavicle_r_0269";
    const upperArmName = side < 0 ? "upperarm_l_0204" : "upperarm_r_0270";
    const forearmName = side < 0 ? "lowerarm_l_0205" : "lowerarm_r_0271";
    const carpusName = side < 0 ? "hand_l_0206" : "hand_r_0272";
    const foreFetlockName = side < 0 ? "fingers_01_l_0187" : "fingers_01_r_0273";
    const upperLegName = side < 0 ? "upperleg_l_0405" : "upperleg_r_0474";
    const lowerLegName = side < 0 ? "lowerleg_l_0406" : "lowerleg_r_0475";
    const hockName = side < 0 ? "foot_l_0407" : "foot_r_0476";
    const hindFetlockName = side < 0 ? "toes_01_l_0408" : "toes_01_r_0477";
    const pelvis = boneNodes.get("hips_0366")?.getWorldPosition(new THREE.Vector3()) ?? boneNodes.get("pelvis_08")?.getWorldPosition(new THREE.Vector3());
    const shoulder = boneNodes.get(shoulderName)?.getWorldPosition(new THREE.Vector3());
    const upperArm = boneNodes.get(upperArmName)?.getWorldPosition(new THREE.Vector3());
    const forearm = boneNodes.get(forearmName)?.getWorldPosition(new THREE.Vector3());
    const carpus = boneNodes.get(carpusName)?.getWorldPosition(new THREE.Vector3());
    const foreFetlock = boneNodes.get(foreFetlockName)?.getWorldPosition(new THREE.Vector3());
    const upperLeg = boneNodes.get(upperLegName)?.getWorldPosition(new THREE.Vector3());
    const lowerLeg = boneNodes.get(lowerLegName)?.getWorldPosition(new THREE.Vector3());
    const hock = boneNodes.get(hockName)?.getWorldPosition(new THREE.Vector3());
    const hindFetlock = boneNodes.get(hindFetlockName)?.getWorldPosition(new THREE.Vector3());
    if (shoulder && upperArm) {
      addNerve(`brachial-plexus-${sideName}`, `Đám rối thần kinh cánh tay ${sideName}`, "Bó thần kinh lớn đi từ vùng cổ thấp tới vai và chi trước.", [
        bodyPoint(0.24, 0.025, side * rightSign * 0.12),
        shoulder.clone().add(new THREE.Vector3(0, -axes.halfHeight * 0.035, 0)),
        upperArm.clone().lerp(shoulder, 0.55),
      ], axes.halfWidth * 0.005, [side * 68, -24]);
    }
    if (shoulder && upperArm && forearm && carpus) {
      const radialPoints = [
        shoulder.clone().lerp(upperArm, 0.55).addScaledVector(lateral, axes.halfWidth * 0.025),
        upperArm.clone().lerp(forearm, 0.45).addScaledVector(lateral, axes.halfWidth * 0.035),
        forearm.clone().lerp(carpus, 0.35).addScaledVector(lateral, axes.halfWidth * 0.022),
        carpus.clone(),
      ];
      addNerve(`radial-nerve-${sideName}`, `Thần kinh quay ${sideName}`, "Nhánh thần kinh lớn chạy dọc mặt ngoài chi trước tới vùng cổ tay.", radialPoints, axes.halfWidth * 0.0035, [side * 70, -18]);
      addNerve(`median-nerve-${sideName}`, `Thần kinh giữa ${sideName}`, "Nhánh thần kinh đi dọc mặt trong cẳng chân trước tới cổ tay.", [
        shoulder.clone().lerp(upperArm, 0.55).addScaledVector(lateral, -axes.halfWidth * 0.025),
        upperArm.clone().lerp(forearm, 0.5).addScaledVector(lateral, -axes.halfWidth * 0.028),
        forearm.clone().lerp(carpus, 0.35).addScaledVector(lateral, -axes.halfWidth * 0.022),
        carpus.clone(),
        ...(foreFetlock ? [foreFetlock.clone()] : []),
      ], axes.halfWidth * 0.0031, [side * 72, -18]);
      addNerve(`ulnar-nerve-${sideName}`, `Thần kinh trụ ${sideName}`, "Nhánh thần kinh đi phía sau cẳng chân trước và góp phần chi phối bàn chân.", [
        shoulder.clone().lerp(upperArm, 0.72).addScaledVector(long, -axes.halfLength * 0.01),
        upperArm.clone().lerp(forearm, 0.72).addScaledVector(lateral, -axes.halfWidth * 0.018),
        forearm.clone().lerp(carpus, 0.58).addScaledVector(lateral, -axes.halfWidth * 0.018),
        carpus.clone(),
      ], axes.halfWidth * 0.0028, [side * 72, -18]);
    }
    if (pelvis && upperLeg) {
      addNerve(`sciatic-nerve-${sideName}`, `Thần kinh tọa ${sideName}`, "Thân thần kinh lớn đi từ vùng chậu xuống mặt sau đùi.", [
        pelvis.clone().addScaledVector(sideDirection(axes.sideAxis), side * rightSign * axes.halfWidth * 0.06),
        pelvis.clone().lerp(upperLeg, 0.42).add(new THREE.Vector3(0, -axes.halfHeight * 0.035, 0)),
        upperLeg.clone().add(new THREE.Vector3(0, -axes.halfHeight * 0.025, 0)),
      ], axes.halfWidth * 0.0054, [side * 68, 26]);
    }
    if (pelvis && upperLeg && lowerLeg && hock) {
      const thighCenter = pelvis.clone().lerp(upperLeg, 0.5);
      const stifle = upperLeg.clone().lerp(lowerLeg, 0.55);
      addNerve(`femoral-nerve-${sideName}`, `Thần kinh đùi ${sideName}`, "Nhánh từ vùng thắt lưng tới mặt trước đùi và khớp gối sau.", [
        bodyPoint(-0.07, 0.02, side * rightSign * 0.055),
        pelvis.clone().lerp(upperLeg, 0.28).addScaledVector(long, axes.halfLength * 0.018),
        thighCenter.clone().addScaledVector(long, axes.halfLength * 0.025),
        stifle.clone().addScaledVector(long, axes.halfLength * 0.015),
      ], axes.halfWidth * 0.0037, [side * 68, 24]);
      addNerve(`tibial-nerve-${sideName}`, `Thần kinh chày ${sideName}`, "Nhánh thần kinh đi từ mặt sau đùi qua vùng gót xuống cẳng chân sau.", [
        thighCenter.clone().addScaledVector(long, -axes.halfLength * 0.015),
        stifle.clone().lerp(lowerLeg, 0.4).addScaledVector(long, -axes.halfLength * 0.01),
        lowerLeg.clone().lerp(hock, 0.62).addScaledVector(lateral, -axes.halfWidth * 0.014),
        hock.clone(),
        ...(hindFetlock ? [hindFetlock.clone()] : []),
      ], axes.halfWidth * 0.0032, [side * 68, 24]);
      addNerve(`common-fibular-nerve-${sideName}`, `Thần kinh mác chung ${sideName}`, "Nhánh thần kinh tách ở vùng gối và đi dọc mặt ngoài cẳng chân sau.", [
        thighCenter.clone().addScaledVector(long, axes.halfLength * 0.018).addScaledVector(lateral, axes.halfWidth * 0.025),
        stifle.clone().addScaledVector(lateral, axes.halfWidth * 0.03),
        lowerLeg.clone().lerp(hock, 0.42).addScaledVector(lateral, axes.halfWidth * 0.028),
        hock.clone().addScaledVector(lateral, axes.halfWidth * 0.014),
      ], axes.halfWidth * 0.0027, [side * 68, 24]);
    }
  }

  const organLift = axes.halfHeight * 0.2;
  organGroup.position.y += organLift;
  records.forEach((record) => {
    if (record.system !== "nervous") record.anchor.y += organLift;
  });

  return { organGroup, nerveGroup, records };
}

export const organSystemNames = systemLabels;
