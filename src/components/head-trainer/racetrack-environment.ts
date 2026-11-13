import * as THREE from "three";

type SurfaceKind = "grass" | "dirt" | "synthetic";

let cachedLawnTextures: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
const cachedTrackTextures = new Map<SurfaceKind, { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture }>();
let cachedFoliageTextures: { map: THREE.CanvasTexture; bumpMap: THREE.CanvasTexture } | null = null;
let cachedBarkTexture: THREE.CanvasTexture | null = null;
let cachedGrassBladeTexture: THREE.CanvasTexture | null = null;
let cachedSkyTexture: THREE.CanvasTexture | null = null;

function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function getSkyBackgroundTexture(): THREE.CanvasTexture {
  if (cachedSkyTexture) return cachedSkyTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#5b9bd5");
    grad.addColorStop(0.38, "#8ec5ec");
    grad.addColorStop(0.68, "#cbe6f7");
    grad.addColorStop(0.86, "#eef6f0");
    grad.addColorStop(1, "#d8e8d2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Soft distant cumulus clouds
    const rand = seededRandom(101);
    for (let i = 0; i < 28; i += 1) {
      const cx = rand() * 512;
      const cy = 140 + rand() * 170;
      const rx = 35 + rand() * 65;
      const ry = 12 + rand() * 22;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
      cloudGrad.addColorStop(0, "rgba(255, 255, 255, 0.42)");
      cloudGrad.addColorStop(0.6, "rgba(255, 255, 255, 0.18)");
      cloudGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedSkyTexture = tex;
  return tex;
}

function getLushLawnTextures() {
  if (cachedLawnTextures) return cachedLawnTextures;
  const size = 512;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;

  const ctx = colorCanvas.getContext("2d");
  const bCtx = bumpCanvas.getContext("2d");
  const rand = seededRandom(42);

  if (ctx && bCtx) {
    // Rich stadium turf base with subtle mowing stripes
    for (let x = 0; x < size; x += 1) {
      const stripe = Math.sin((x / size) * Math.PI * 4) * 0.5 + 0.5;
      const r = Math.round(46 + stripe * 14);
      const g = Math.round(108 + stripe * 22);
      const b = Math.round(34 + stripe * 8);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, 0, 1, size);
    }

    bCtx.fillStyle = "#808080";
    bCtx.fillRect(0, 0, size, size);

    // Organic soil/moss patches
    for (let i = 0; i < 180; i += 1) {
      const px = rand() * size;
      const py = rand() * size;
      const radius = 14 + rand() * 34;
      const dark = rand() > 0.5;
      const grad = ctx.createRadialGradient(px, py, 2, px, py, radius);
      grad.addColorStop(0, dark ? "rgba(28, 74, 22, 0.22)" : "rgba(92, 152, 48, 0.20)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 14,000 individual grass blade strokes
    const bladeColors = ["#2d6a1e", "#3b8228", "#4d9a34", "#5cad3e", "#255818", "#6dbd48"];
    for (let i = 0; i < 14000; i += 1) {
      const x = rand() * size;
      const y = rand() * size;
      const len = 3 + rand() * 6;
      const angle = -Math.PI / 2 + (rand() - 0.5) * 0.7;
      ctx.strokeStyle = bladeColors[Math.floor(rand() * bladeColors.length)];
      ctx.lineWidth = 0.9 + rand() * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();

      const bVal = Math.floor(100 + rand() * 145);
      bCtx.strokeStyle = `rgb(${bVal},${bVal},${bVal})`;
      bCtx.lineWidth = 1;
      bCtx.beginPath();
      bCtx.moveTo(x, y);
      bCtx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      bCtx.stroke();
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  cachedLawnTextures = { map, bumpMap };
  return cachedLawnTextures;
}

function getTrackSurfaceTextures(surfaceKind: SurfaceKind) {
  const existing = cachedTrackTextures.get(surfaceKind);
  if (existing) return existing;

  const size = 512;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;

  const ctx = colorCanvas.getContext("2d");
  const bCtx = bumpCanvas.getContext("2d");
  const rand = seededRandom(surfaceKind === "grass" ? 303 : surfaceKind === "dirt" ? 505 : 707);

  if (ctx && bCtx) {
    bCtx.fillStyle = "#808080";
    bCtx.fillRect(0, 0, size, size);

    if (surfaceKind === "grass") {
      ctx.fillStyle = "#2f7322";
      ctx.fillRect(0, 0, size, size);
      for (let y = 0; y < size; y += 1) {
        const band = Math.sin((y / size) * Math.PI * 8) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(74, 138, 42, ${(band * 0.22).toFixed(3)})`;
        ctx.fillRect(0, y, size, 1);
      }
      const turfShades = ["#265e1b", "#337a24", "#408e2f", "#4fa038", "#1e4d14", "#5eb041"];
      for (let i = 0; i < 16000; i += 1) {
        const x = rand() * size;
        const y = rand() * size;
        const len = 3 + rand() * 5;
        ctx.strokeStyle = turfShades[Math.floor(rand() * turfShades.length)];
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 3, y - len);
        ctx.stroke();

        const bVal = Math.floor(90 + rand() * 155);
        bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
        bCtx.fillRect(x, y, 2, 2);
      }
    } else if (surfaceKind === "dirt") {
      ctx.fillStyle = "#9e6b43";
      ctx.fillRect(0, 0, size, size);
      const dirtShades = ["#845532", "#96633c", "#ad774c", "#bc865a", "#6e4425", "#c89668"];
      for (let i = 0; i < 18000; i += 1) {
        const x = rand() * size;
        const y = rand() * size;
        const r = 1 + rand() * 2.5;
        ctx.fillStyle = dirtShades[Math.floor(rand() * dirtShades.length)];
        ctx.fillRect(x, y, r, r);
        const bVal = Math.floor(80 + rand() * 165);
        bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
        bCtx.fillRect(x, y, r, r);
      }
    } else {
      ctx.fillStyle = "#5c646d";
      ctx.fillRect(0, 0, size, size);
      const synthShades = ["#4b525a", "#575f68", "#67707a", "#737c87", "#3f464d"];
      for (let i = 0; i < 18000; i += 1) {
        const x = rand() * size;
        const y = rand() * size;
        ctx.fillStyle = synthShades[Math.floor(rand() * synthShades.length)];
        ctx.fillRect(x, y, 2, 2);
        const bVal = Math.floor(95 + rand() * 140);
        bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
        bCtx.fillRect(x, y, 2, 2);
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  const pair = { map, bumpMap };
  cachedTrackTextures.set(surfaceKind, pair);
  return pair;
}

function getFoliageTextures() {
  if (cachedFoliageTextures) return cachedFoliageTextures;
  const size = 256;
  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = size;
  colorCanvas.height = size;
  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = size;
  bumpCanvas.height = size;

  const ctx = colorCanvas.getContext("2d");
  const bCtx = bumpCanvas.getContext("2d");
  const rand = seededRandom(888);

  if (ctx && bCtx) {
    ctx.fillStyle = "#24581c";
    ctx.fillRect(0, 0, size, size);
    bCtx.fillStyle = "#606060";
    bCtx.fillRect(0, 0, size, size);

    const leafPalette = ["#1b4514", "#245a1b", "#2e6f23", "#3b842c", "#4c9a38", "#60b044", "#72bf52"];
    for (let i = 0; i < 4500; i += 1) {
      const x = rand() * size;
      const y = rand() * size;
      const rx = 2.5 + rand() * 4.5;
      const ry = 1.5 + rand() * 2.8;
      const rot = rand() * Math.PI;
      const shadeIdx = Math.floor(rand() * leafPalette.length);

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.fillStyle = leafPalette[shadeIdx];
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const bVal = 70 + Math.floor((shadeIdx / leafPalette.length) * 180);
      bCtx.save();
      bCtx.translate(x, y);
      bCtx.rotate(rot);
      bCtx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      bCtx.beginPath();
      bCtx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      bCtx.fill();
      bCtx.restore();
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  cachedFoliageTextures = { map, bumpMap };
  return cachedFoliageTextures;
}

function getBarkTexture() {
  if (cachedBarkTexture) return cachedBarkTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(999);
  if (ctx) {
    ctx.fillStyle = "#4a3525";
    ctx.fillRect(0, 0, 128, 256);
    const shades = ["#382619", "#59402d", "#2c1d12", "#664b36"];
    for (let i = 0; i < 900; i += 1) {
      ctx.fillStyle = shades[Math.floor(rand() * shades.length)];
      ctx.fillRect(rand() * 128, rand() * 256, 2 + rand() * 3, 12 + rand() * 28);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cachedBarkTexture = tex;
  return tex;
}

function getGrassBladeTexture() {
  if (cachedGrassBladeTexture) return cachedGrassBladeTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const rand = seededRandom(555);
  if (ctx) {
    ctx.clearRect(0, 0, 256, 128);
    const bladePalette = ["#24591a", "#2e6e22", "#3b842b", "#4c9b36", "#5eb042", "#70c14f"];
    for (let i = 0; i < 68; i += 1) {
      const baseX = 10 + (i / 68) * 236 + (rand() - 0.5) * 4;
      const baseY = 128;
      const height = 52 + rand() * 68;
      const bend = (rand() - 0.5) * 28;
      const width = 3.2 + rand() * 2.8;

      const grad = ctx.createLinearGradient(baseX, baseY, baseX + bend, baseY - height);
      grad.addColorStop(0, "#1d4714");
      grad.addColorStop(0.5, bladePalette[Math.floor(rand() * bladePalette.length)]);
      grad.addColorStop(1, "#7ed158");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(baseX - width / 2, baseY);
      ctx.quadraticCurveTo(baseX + bend * 0.45, baseY - height * 0.5, baseX + bend, baseY - height);
      ctx.quadraticCurveTo(baseX + bend * 0.45 + width * 0.4, baseY - height * 0.5, baseX + width / 2, baseY);
      ctx.closePath();
      ctx.fill();
    }

    // Subtle tiny wildflowers on a few tips
    const flowerColors = ["#fef08a", "#ffffff", "#fbcfe8"];
    for (let i = 0; i < 10; i += 1) {
      ctx.fillStyle = flowerColors[i % flowerColors.length];
      ctx.beginPath();
      ctx.arc(24 + rand() * 208, 22 + rand() * 42, 2.8 + rand() * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cachedGrassBladeTexture = tex;
  return tex;
}

function applyPlanarWorldUVs(mesh: THREE.Mesh, repeatScale: number) {
  mesh.updateMatrixWorld(true);
  const geom = mesh.geometry;
  const pos = geom.attributes.position;
  if (!pos) return;
  const uvs = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    uvs[i * 2] = v.x * repeatScale;
    uvs[i * 2 + 1] = v.z * repeatScale;
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
}

function createOrganicFoliageGeometry(): THREE.BufferGeometry {
  const geom = new THREE.IcosahedronGeometry(1, 3);
  const pos = geom.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i);
    const n1 = Math.sin(v.x * 4.2 + 0.5) * Math.cos(v.y * 3.8 - 0.3) * Math.sin(v.z * 4.5 + 1.1);
    const n2 = Math.cos(v.x * 7.5 - v.z * 6.2) * Math.sin(v.y * 8.1);
    const scale = 1 + n1 * 0.16 + n2 * 0.06;
    v.multiplyScalar(scale);
    // Slightly flatten bottom of canopy puff
    if (v.y < 0) v.y *= 0.78;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geom.computeVertexNormals();
  return geom;
}

function createGrassClumpGeometry(): THREE.BufferGeometry {
  const geometries: THREE.PlaneGeometry[] = [];
  const angles = [0, Math.PI / 3, (Math.PI * 2) / 3];
  angles.forEach((angle, idx) => {
    const plane = new THREE.PlaneGeometry(0.65, 0.34);
    plane.translate(0, 0.16, 0);
    plane.rotateX((idx - 1) * 0.16);
    plane.rotateY(angle);
    geometries.push(plane);
  });

  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;

  geometries.forEach((g) => {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    const u = g.attributes.uv.array;
    const idx = g.index?.array;
    for (let i = 0; i < p.length; i += 1) positions.push(p[i]);
    for (let i = 0; i < n.length; i += 1) normals.push(n[i]);
    for (let i = 0; i < u.length; i += 1) uvs.push(u[i]);
    if (idx) {
      for (let i = 0; i < idx.length; i += 1) indices.push(idx[i] + vertexOffset);
    }
    vertexOffset += g.attributes.position.count;
    g.dispose();
  });

  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

function createStartingArchway(finishLineX: number): THREE.Group {
  const group = new THREE.Group();
  group.name = "ChampionshipFinishArch";
  const archX = finishLineX + 0.19;
  const innerZ = 3.88;
  const outerZ = 8.12;
  const spanZ = outerZ - innerZ;
  const midZ = (innerZ + outerZ) / 2;
  const pillarHeight = 3.25;

  const whitePillarMat = new THREE.MeshStandardMaterial({
    color: "#f8fafc",
    roughness: 0.28,
    metalness: 0.18,
  });
  const goldAccentMat = new THREE.MeshStandardMaterial({
    color: "#d4af37",
    roughness: 0.25,
    metalness: 0.65,
  });

  // Left & Right Pillars + Gold Finials
  const pillarGeom = new THREE.CylinderGeometry(0.11, 0.14, pillarHeight, 16);
  const baseGeom = new THREE.CylinderGeometry(0.22, 0.25, 0.28, 16);
  const ringGeom = new THREE.TorusGeometry(0.14, 0.035, 10, 24);
  ringGeom.rotateX(Math.PI / 2);
  const finialGeom = new THREE.SphereGeometry(0.18, 16, 16);

  [innerZ, outerZ].forEach((zPos) => {
    const pillar = new THREE.Mesh(pillarGeom, whitePillarMat);
    pillar.position.set(archX, pillarHeight / 2, zPos);
    group.add(pillar);

    const base = new THREE.Mesh(baseGeom, goldAccentMat);
    base.position.set(archX, 0.14, zPos);
    group.add(base);

    const ring = new THREE.Mesh(ringGeom, goldAccentMat);
    ring.position.set(archX, pillarHeight - 0.15, zPos);
    group.add(ring);

    const finial = new THREE.Mesh(finialGeom, goldAccentMat);
    finial.position.set(archX, pillarHeight + 0.16, zPos);
    group.add(finial);
  });

  // Overhead Header Banner
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(0.5, "#1e3a8a");
    grad.addColorStop(1, "#0f172a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 96);

    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 88);

    ctx.fillStyle = "#f8fafc";
    ctx.font = "900 34px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★ EQUINE RACETRACK ★", 256, 49);
  }
  const bannerTex = new THREE.CanvasTexture(canvas);
  bannerTex.colorSpace = THREE.SRGBColorSpace;
  const bannerMat = new THREE.MeshStandardMaterial({
    map: bannerTex,
    roughness: 0.35,
    metalness: 0.1,
  });

  const headerGeom = new THREE.BoxGeometry(0.22, 0.56, spanZ + 0.24);
  const header = new THREE.Mesh(headerGeom, [
    bannerMat,
    bannerMat,
    goldAccentMat,
    goldAccentMat,
    goldAccentMat,
    goldAccentMat,
  ]);
  header.position.set(archX, pillarHeight - 0.28, midZ);
  group.add(header);

  return group;
}

export function enhanceTrackEnvironment(
  track: THREE.Group,
  surface: string | null | undefined,
  finishLineX: number,
  excludedFromOptimization: Set<THREE.Object3D>,
) {
  const val = surface?.trim().toLowerCase() ?? "";
  const surfaceKind: SurfaceKind =
    val.includes("dirt") || val.includes("sand") || val.includes("soil") || val.includes("đất") || val.includes("dat")
      ? "dirt"
      : val.includes("grass") || val.includes("turf") || val.includes("cỏ") || val.includes("co")
      ? "grass"
      : "synthetic";

  const lawnTex = getLushLawnTextures();
  const trackTex = getTrackSurfaceTextures(surfaceKind);
  const foliageTex = getFoliageTextures();
  const barkTex = getBarkTexture();

  const lawnMat = new THREE.MeshStandardMaterial({
    map: lawnTex.map,
    bumpMap: lawnTex.bumpMap,
    bumpScale: 0.04,
    roughness: 0.86,
    metalness: 0.02,
  });

  const racingSurfaceMat = new THREE.MeshStandardMaterial({
    map: trackTex.map,
    bumpMap: trackTex.bumpMap,
    bumpScale: surfaceKind === "dirt" ? 0.055 : 0.038,
    roughness: surfaceKind === "dirt" ? 0.92 : 0.82,
    metalness: 0.02,
  });

  const barkMat = new THREE.MeshStandardMaterial({
    map: barkTex,
    bumpMap: barkTex,
    bumpScale: 0.05,
    roughness: 0.9,
    metalness: 0.02,
  });

  const railMat = new THREE.MeshStandardMaterial({
    color: "#f8fafc",
    roughness: 0.3,
    metalness: 0.14,
  });

  const laneDividerMat = new THREE.MeshStandardMaterial({
    color: "#f1ebd8",
    roughness: 0.45,
    metalness: 0.05,
  });

  // Collect existing tree canopy bounding boxes so we can replace flat rock leaves with lush foliage
  const treeLeafGroups = new Map<string, THREE.Box3>();

  track.updateMatrixWorld(true);
  track.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const name = node.name || "";
    const matName = Array.isArray(node.material) ? node.material[0]?.name ?? "" : node.material?.name ?? "";

    // Hide static floating debris cubes baked for the old static template horse
    if (/^(GRASS_kickup|AIRBORNE_dust|DUST_)/i.test(name) || /clippings|airborne_dust/i.test(matName)) {
      node.visible = false;
      excludedFromOptimization.add(node);
      return;
    }

    // Track racing surface
    if (/ENV_oval_racing_surface/i.test(name) || /racing_turf|soil_track|matte_slate_track/i.test(matName)) {
      node.geometry.deleteAttribute("color");
      applyPlanarWorldUVs(node, 0.28);
      node.material = racingSurfaceMat;
      excludedFromOptimization.add(node);
      return;
    }

    // Ground lawn / infield / outfield slabs
    if (
      /^(ENV_grass_base|SOIL_ground_color_detail|GRASS_scattered_tufts)/i.test(name) ||
      /^TREE_\d+_grass_base$/i.test(name) ||
      /grass_slab|ground_varied|sand_base|gray_base_slab|matte_slate_ground|grass_tufts|tree_grass_patch/i.test(matName)
    ) {
      node.geometry.deleteAttribute("color");
      applyPlanarWorldUVs(node, 0.22);
      node.material = lawnMat;
      if (/^(ENV_grass_base|SOIL_ground_color_detail)/i.test(name)) {
        excludedFromOptimization.add(node);
      }
      return;
    }

    // White rails & posts
    if (/rail_white/i.test(matName) || /white_rail|post_/i.test(name)) {
      node.material = railMat;
      return;
    }

    // Lane dividers
    if (/lane_divider/i.test(matName) || /^LANE_divider/i.test(name)) {
      node.material = laneDividerMat;
      return;
    }

    // Tree trunks & branches: smooth normals and apply bark texture
    if (/^TREE_\d+_branch/i.test(name) || /tree_bark/i.test(matName)) {
      applyPlanarWorldUVs(node, 0.8);
      node.geometry.computeVertexNormals();
      node.material = barkMat;
      return;
    }

    // Tree leaves: record bounding box per tree & hide old blocky flat-shaded meshes
    const leafMatch = name.match(/^(TREE_\d+)_leaf/i);
    if (leafMatch || /leaf_detailed/i.test(matName)) {
      const treeId = leafMatch ? leafMatch[1] : name;
      const box = new THREE.Box3().setFromObject(node);
      const existing = treeLeafGroups.get(treeId);
      if (existing) existing.union(box);
      else treeLeafGroups.set(treeId, box);
      node.visible = false;
      excludedFromOptimization.add(node);
    }
  });

  // Build lush multi-layered organic canopies for all perimeter trees + new infield trees
  const foliageGeom = createOrganicFoliageGeometry();
  const canopyShades = ["#2d6e22", "#3a842b", "#499935", "#235919"];
  const canopyMats = canopyShades.map(
    (tint) =>
      new THREE.MeshStandardMaterial({
        map: foliageTex.map,
        bumpMap: foliageTex.bumpMap,
        bumpScale: 0.06,
        color: new THREE.Color(tint),
        roughness: 0.78,
        metalness: 0.02,
      }),
  );

  type PuffTransform = { pos: THREE.Vector3; scale: THREE.Vector3; rot: THREE.Euler; shade: number };
  const puffsByShade: PuffTransform[][] = [[], [], [], []];
  const rand = seededRandom(2026);

  treeLeafGroups.forEach((box) => {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const rx = Math.max(0.75, size.x * 0.36);
    const ry = Math.max(0.65, size.y * 0.36);
    const rz = Math.max(0.75, size.z * 0.36);

    // Central crown + 5 surrounding organic foliage puffs per tree
    const offsets = [
      [0, 0.18, 0, 1.05],
      [-0.48, -0.06, 0.32, 0.78],
      [0.52, -0.04, -0.28, 0.8],
      [0.28, 0.08, 0.48, 0.74],
      [-0.35, 0.05, -0.45, 0.76],
      [0, 0.38, 0, 0.68],
    ];
    offsets.forEach(([ox, oy, oz, sc], idx) => {
      const shade = ( idx + Math.floor(rand() * 4) ) % 4;
      puffsByShade[shade].push({
        pos: new THREE.Vector3(center.x + ox * rx, center.y + oy * ry, center.z + oz * rz),
        scale: new THREE.Vector3(rx * sc, ry * sc, rz * sc),
        rot: new THREE.Euler(rand() * 0.5, rand() * Math.PI * 2, rand() * 0.5),
        shade,
      });
    });
  });

  // Add manicured hedges along the inner rail & ornamental shrubs in the infield
  const hedgePositions: Array<{ x: number; z: number; sx: number; sy: number; sz: number }> = [];
  for (let x = -9.2; x <= 9.2; x += 1.15) {
    hedgePositions.push({ x, z: 3.32, sx: 0.52, sy: 0.36, sz: 0.38 });
    hedgePositions.push({ x, z: -3.32, sx: 0.52, sy: 0.36, sz: 0.38 });
  }
  for (let a = -Math.PI * 0.42; a <= Math.PI * 0.42; a += Math.PI * 0.14) {
    const r = 3.32;
    hedgePositions.push({ x: 10 + Math.cos(a) * r, z: Math.sin(a) * r, sx: 0.46, sy: 0.36, sz: 0.46 });
    hedgePositions.push({ x: -10 - Math.cos(a) * r, z: Math.sin(a) * r, sx: 0.46, sy: 0.36, sz: 0.46 });
  }
  hedgePositions.forEach((h, idx) => {
    const shade = idx % 4;
    puffsByShade[shade].push({
      pos: new THREE.Vector3(h.x, 0.24, h.z),
      scale: new THREE.Vector3(h.sx, h.sy, h.sz),
      rot: new THREE.Euler(0, (idx * 0.7) % Math.PI, 0),
      shade,
    });
  });

  // Add 3 ornamental trees in the center of the infield (x = -5.5, 0, +5.5, z = 0)
  const infieldTreeX = [-5.5, 0, 5.5];
  const trunkGeom = new THREE.CylinderGeometry(0.11, 0.17, 1.35, 10);
  infieldTreeX.forEach((tx, tIdx) => {
    const trunk = new THREE.Mesh(trunkGeom, barkMat);
    trunk.position.set(tx, 0.67, 0);
    excludedFromOptimization.add(trunk);
    track.add(trunk);

    // White ornamental planter ring around each infield tree
    const planterGeom = new THREE.TorusGeometry(0.62, 0.08, 10, 24);
    planterGeom.rotateX(Math.PI / 2);
    const planter = new THREE.Mesh(planterGeom, railMat);
    planter.position.set(tx, 0.06, 0);
    excludedFromOptimization.add(planter);
    track.add(planter);

    const treeOffsets = [
      [0, 1.65, 0, 0.92, 0.78, 0.92],
      [-0.42, 1.45, 0.3, 0.68, 0.58, 0.68],
      [0.42, 1.48, -0.28, 0.7, 0.6, 0.7],
      [0.2, 1.52, 0.42, 0.65, 0.55, 0.65],
      [-0.25, 1.5, -0.4, 0.66, 0.56, 0.66],
    ];
    treeOffsets.forEach(([ox, oy, oz, sx, sy, sz], idx) => {
      const shade = (tIdx + idx) % 4;
      puffsByShade[shade].push({
        pos: new THREE.Vector3(tx + ox, oy, oz),
        scale: new THREE.Vector3(sx, sy, sz),
        rot: new THREE.Euler(rand() * 0.3, rand() * Math.PI, rand() * 0.3),
        shade,
      });
    });
  });

  // Instantiate all foliage puffs in 4 fast InstancedMeshes
  const dummy = new THREE.Object3D();
  puffsByShade.forEach((list, shadeIdx) => {
    if (list.length === 0) return;
    const inst = new THREE.InstancedMesh(foliageGeom, canopyMats[shadeIdx], list.length);
    inst.name = `LushFoliageCanopy_${shadeIdx}`;
    list.forEach((item, i) => {
      dummy.position.copy(item.pos);
      dummy.scale.copy(item.scale);
      dummy.rotation.copy(item.rot);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    excludedFromOptimization.add(inst);
    track.add(inst);
  });

  // Scatter 720 3D Grass Blade & Wildflower Clumps across the infield & outer lawn
  const grassClumpGeom = createGrassClumpGeometry();
  const grassClumpMat = new THREE.MeshStandardMaterial({
    map: getGrassBladeTexture(),
    alphaTest: 0.32,
    transparent: true,
    side: THREE.DoubleSide,
    roughness: 0.75,
    metalness: 0.02,
  });

  const grassPositions: Array<{ x: number; z: number; scale: number; rotY: number }> = [];
  // Infield grass clumps (inside oval: |x| <= 10, |z| <= 3.1 plus semicircles at ends)
  for (let i = 0; i < 420; i += 1) {
    const x = (rand() - 0.5) * 24.5;
    const z = (rand() - 0.5) * 6.2;
    const dx = Math.max(0, Math.abs(x) - 10);
    if (dx * dx + z * z < 3.05 * 3.05) {
      grassPositions.push({
        x,
        z,
        scale: 0.65 + rand() * 0.65,
        rotY: rand() * Math.PI * 2,
      });
    }
  }
  // Outer lawn grass clumps (around trees & outside track)
  for (let i = 0; i < 360; i += 1) {
    const x = (rand() - 0.5) * 54;
    const z = (rand() - 0.5) * 36;
    const dx = Math.max(0, Math.abs(x) - 10);
    const distFromTrackCenter = Math.sqrt(dx * dx + z * z);
    if (distFromTrackCenter > 12.6 || (distFromTrackCenter > 8.3 && distFromTrackCenter < 9.5)) {
      grassPositions.push({
        x,
        z,
        scale: 0.75 + rand() * 0.75,
        rotY: rand() * Math.PI * 2,
      });
    }
  }

  if (grassPositions.length > 0) {
    const grassInst = new THREE.InstancedMesh(grassClumpGeom, grassClumpMat, grassPositions.length);
    grassInst.name = "Detailed3DGrassClumps";
    grassPositions.forEach((g, idx) => {
      dummy.position.set(g.x, 0.01, g.z);
      dummy.scale.set(g.scale, g.scale, g.scale);
      dummy.rotation.set(0, g.rotY, 0);
      dummy.updateMatrix();
      grassInst.setMatrixAt(idx, dummy.matrix);
    });
    grassInst.instanceMatrix.needsUpdate = true;
    grassInst.computeBoundingSphere();
    excludedFromOptimization.add(grassInst);
    track.add(grassInst);
  }

  // Add Championship Starting / Finish Archway at the checkered line
  const arch = createStartingArchway(finishLineX);
  arch.traverse((part) => excludedFromOptimization.add(part));
  track.add(arch);
}

