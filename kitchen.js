import * as THREE from 'three';
import { packRoom } from './pack.js';

const IN = 0.0254;
const STATE_KEY = 'turbo-cabinet-studio-v5';
const SKU_DIR = new URL('/models/sku-v1/', globalThis.location?.origin || import.meta.url);

const META = {
  'BBC39-L': { kind: 'base', width: 39, height: 34.5, depth: 24, placementBottom: 0, styles: true, blind: true },
  'SB36': { kind: 'base', width: 36, height: 34.5, depth: 24, placementBottom: 0, styles: true },
  'BWB18': { kind: 'base', width: 18, height: 34.5, depth: 24, placementBottom: 0, styles: true },
  'B15-L': { kind: 'base', width: 15, height: 34.5, depth: 24, placementBottom: 0, styles: true },
  'B12-R': { kind: 'base', width: 12, height: 34.5, depth: 24, placementBottom: 0, styles: true },
  'F3-base': { kind: 'filler', width: 3, height: 34.5, depth: 24, placementBottom: 0, styles: false },
  'W3630': { kind: 'upper', width: 36, height: 36, depth: 12, placementBottom: 54, styles: true },
  'W3615': { kind: 'upper', width: 36, height: 15, depth: 29.5, placementBottom: 75, styles: true },
  'W3015': { kind: 'upper', width: 30, height: 15, depth: 12, placementBottom: 75, styles: true },
  'W2730': { kind: 'upper', width: 27, height: 36, depth: 12, placementBottom: 54, styles: true },
  'WBC2730-L': { kind: 'upper', width: 27, height: 36, depth: 12, placementBottom: 54, styles: true, blind: true },
  'W1230-L': { kind: 'upper', width: 12, height: 36, depth: 12, placementBottom: 54, styles: true },
  'W1230-R': { kind: 'upper', width: 12, height: 36, depth: 12, placementBottom: 54, styles: true },
  'F3-upper': { kind: 'filler', width: 3, height: 36, depth: 12, placementBottom: 54, styles: false },
  'RANGE1.30': { kind: 'appliance', width: 30, height: 44.6, depth: 27, placementBottom: 0, styles: false },
  'DISH-IQ6': { kind: 'appliance', width: 24, height: 34.4, depth: 25, placementBottom: 0, styles: false },
  'REF.2D.36': { kind: 'appliance', width: 36, height: 64.9, depth: 29.5, placementBottom: 0, styles: false },
};

const UPPER_RECIPES = {
  longer: ['WBC2730-L', 'W3630', 'W3015', 'W2730', 'W1230-L'],
  more: ['WBC2730-L', 'W1230-L', 'W1230-R', 'W2730', 'W3015'],
  even: ['WBC2730-L', 'W2730', 'W1230-L', 'W3630', 'W3015'],
  tight: ['WBC2730-L', 'W3630', 'W3015', 'W2730', 'F3-upper', 'W1230-L'],
};

const OPENING_SKU = { range: 'RANGE1.30', dishwasher: 'DISH-IQ6', fridge: 'REF.2D.36' };

function storedRoom() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || 'null')?.room || null;
  } catch {
    return null;
  }
}

function recipeId() {
  try {
    return JSON.parse(sessionStorage.getItem('turbo-studio-template') || 'null')?.id || 'longer';
  } catch {
    return 'longer';
  }
}

function packUppers(room) {
  const ids = UPPER_RECIPES[recipeId()] || UPPER_RECIPES.longer;
  const skus = ids.map((id) => META[id]).filter(Boolean).map((meta, i) => ({ id: ids[i], ...meta }));
  return packRoom(room, skus, { filler: { id: 'F3-upper', ...META['F3-upper'] } });
}

function openingRows(room) {
  const rows = [];
  for (const wall of room?.walls || []) {
    for (const opening of wall.openings || []) {
      const skuId = OPENING_SKU[opening.kind];
      if (!skuId) continue;
      rows.push({ skuId, wallId: wall.id, start: opening.start });
    }
  }
  return rows;
}

function pickScene(gltf, style) {
  return gltf.scenes.find((scene) => scene.name === style)
    || gltf.scenes.find((scene) => scene.name === 'shaker')
    || gltf.scenes.find((scene) => scene.name === 'default')
    || gltf.scene;
}

function bindMaterials(root, bank) {
  root.traverse((node) => {
    if (!node.isMesh) return;
    const assign = (material) => {
      if (!material) return material;
      if (material.name === 'CABINET_FINISH') return bank.finish;
      if (material.name === 'CABINET_HARDWARE') return bank.hardware;
      if (material.name === 'CABINET_FRAME') return bank.frame;
      if (material.name === 'CABINET_GLASS') return bank.glass;
      return material;
    };
    node.castShadow = true;
    node.receiveShadow = true;
    node.material = Array.isArray(node.material) ? node.material.map(assign) : assign(node.material);
  });
}

function place(node, row, meta) {
  const bottom = meta.placementBottom || 0;
  if (row.wallId === 'sink') {
    node.rotation.y = Math.PI / 2;
    node.position.set(meta.depth * IN, bottom * IN, (row.start + meta.width) * IN);
  } else {
    node.position.set(row.start * IN, bottom * IN, meta.depth * IN);
  }
}

function clearGroup(group) {
  for (const child of [...group.children]) group.remove(child);
}

function hideShowroom(g) {
  if (g.base) g.base.visible = false;
  for (const bank of ['upper', 'lower']) {
    if (g.fronts?.[bank]) g.fronts[bank].visible = false;
  }
  if (g.backdrop) g.backdrop.visible = false;
  if (g.layoutRoot) g.layoutRoot.visible = false;
  g.scene.background.set('#efe8dc');
}

async function loadSku(g, skuId) {
  g.skuCache ||= new Map();
  if (!g.skuCache.has(skuId)) {
    const url = new URL(`${skuId}.glb`, SKU_DIR).href;
    g.skuCache.set(skuId, g.loader.loadAsync(url).catch((err) => {
      g.skuCache.delete(skuId);
      throw err;
    }));
  }
  return g.skuCache.get(skuId);
}

async function assembleSku(g, design, rows, opts = {}) {
  await g.ready;
  hideShowroom(g);
  if (g.skuRoot) g.skuRoot.visible = !opts.layout;
  if (opts.layout) return true;
  g.applyFinish('upper', design.upper.finish);
  g.applyFinish('lower', design.lower.finish);
  if (!g.skuRoot) {
    g.skuRoot = new THREE.Group();
    g.skuRoot.name = 'sku-kitchen';
    g.scene.add(g.skuRoot);
  }
  g.skuRoot.visible = true;
  clearGroup(g.skuRoot);
  const room = storedRoom();
  const extras = [];
  if (!rows.some((row) => META[row.skuId]?.kind === 'upper')) extras.push(...packUppers(room));
  extras.push(...openingRows(room));
  const placed = [];
  for (const row of [...rows, ...extras]) {
    if (row.cut || !row.skuId) continue;
    const meta = META[row.skuId];
    if (!meta) continue;
    const bankName = meta.kind === 'upper' ? 'upper' : 'lower';
    const style = meta.styles ? design[bankName].style.id : 'default';
    const gltf = await loadSku(g, row.skuId);
    const source = pickScene(gltf, style);
    if (!source) continue;
    const node = source.clone(true);
    bindMaterials(node, g.banks[bankName]);
    place(node, row, meta);
    node.userData.skuId = row.skuId;
    node.userData.wallId = row.wallId;
    node.userData.style = style;
    g.skuRoot.add(node);
    placed.push(`${row.skuId}:${style}`);
  }
  const canvas = g.renderer.domElement;
  canvas.dataset.preview = 'sku';
  canvas.dataset.layoutSkus = placed.map((item) => item.split(':')[0]).join(',');
  canvas.dataset.skuStyles = placed.join(',');
  canvas.dataset.upperStyle = design.upper.style.id;
  canvas.dataset.lowerStyle = design.lower.style.id;
  canvas.dataset.upperFinish = design.upper.finish.id;
  canvas.dataset.lowerFinish = design.lower.finish.id;
  canvas.setAttribute('aria-label', `Assembled kitchen: ${placed.join(' ')}`);
  const caption = document.querySelector('#mode-caption');
  if (opts.still && caption) caption.textContent = 'This kitchen';
  document.querySelector('.image-stage')?.classList.toggle('quality-mode', Boolean(opts.still));
  g.resize?.();
  g.renderer.render(g.scene, g.camera);
  g.invalidate();
  if (!placed.length) throw new Error('The kitchen could not load.');
  return true;
}

globalThis.STUDIO_ASSEMBLE_SKU = assembleSku;
