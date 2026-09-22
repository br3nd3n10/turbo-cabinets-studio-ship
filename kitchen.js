import * as THREE from 'three';
import { SKU } from './inventory.js';

const IN = 0.0254;
const STATE_KEY = 'turbo-cabinet-studio-v5';
const SKU_DIR = new URL('/models/sku-v1/', globalThis.location?.origin || import.meta.url);

const META = Object.fromEntries([...SKU.values()].map((sku) => [sku.id, {
  ...sku,
  placementBottom: sku.bottom || 0,
  styles: sku.kind === 'base' || sku.kind === 'upper',
}]));

const OPENING_SKU = { range: 'RANGE1.30', dishwasher: 'DISH-IQ6', fridge: 'REF.2D.36' };

let viewer = null;

function storedRoom() {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || 'null')?.room || null;
  } catch {
    return null;
  }
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
  node.userData.skuId = row.skuId;
  node.userData.wallId = row.wallId;
  node.userData.start = row.start;
  node.userData.bank = meta.bank;
}

// Lego swap. A click on the canvas that did not orbit picks the placed box under the
// pointer and hands it to the layout owner. The picked box wears an outline until the
// selection clears.
function target(node) {
  const { skuId, wallId, start, bank } = node.userData;
  return { skuId, wallId, start, bank };
}

function pickAt(g, event) {
  const rect = g.renderer.domElement.getBoundingClientRect();
  const point = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(point, g.camera);
  for (const hit of ray.intersectObjects(g.skuRoot?.children || [], true)) {
    let node = hit.object;
    while (node && node.parent !== g.skuRoot) node = node.parent;
    if (node?.userData.skuId) return target(node);
  }
  return null;
}

function bindPicking(g) {
  if (g.pickingBound) return;
  g.pickingBound = true;
  const canvas = g.renderer.domElement;
  let down = null;
  canvas.addEventListener('pointerdown', (event) => {
    down = event.button === 0 ? { x: event.clientX, y: event.clientY } : null;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    down = null;
    if (moved > 4) return;
    globalThis.STUDIO_SELECT?.(pickAt(g, event));
  });
}

function highlight(selection) {
  const g = viewer;
  if (!g) return;
  if (g.swapOutline) {
    g.scene.remove(g.swapOutline);
    g.swapOutline.dispose?.();
    g.swapOutline = null;
  }
  const canvas = g.renderer.domElement;
  const node = selection && g.skuRoot?.children.find((child) => child.userData.wallId === selection.wallId
    && Math.abs(child.userData.start - selection.start) < 1e-6
    && (!selection.bank || child.userData.bank === selection.bank));
  if (!node) {
    delete canvas.dataset.selected;
    g.invalidate();
    return;
  }
  const box = new THREE.Box3().setFromObject(node, true).expandByScalar(0.006);
  g.swapOutline = new THREE.Box3Helper(box, new THREE.Color('#c89d51'));
  g.scene.add(g.swapOutline);
  canvas.dataset.selected = `${node.userData.wallId}:${node.userData.start}:${node.userData.skuId}`;
  g.invalidate();
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
  viewer = g;
  bindPicking(g);
  const room = storedRoom();
  const placed = [];
  for (const row of [...rows, ...openingRows(room)]) {
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
  const selection = canvas.dataset.selected?.split(':');
  highlight(selection ? { wallId: selection[0], start: Number(selection[1]), skuId: selection[2], bank: META[selection[2]]?.bank } : null);
  g.resize?.();
  g.renderer.render(g.scene, g.camera);
  g.invalidate();
  if (!placed.length) throw new Error('The kitchen could not load.');
  return true;
}

globalThis.STUDIO_ASSEMBLE_SKU = assembleSku;
globalThis.STUDIO_HIGHLIGHT = highlight;
