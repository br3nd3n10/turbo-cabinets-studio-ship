import * as THREE from 'three';
import { SKU } from './inventory.js';
import { wallChain } from './pack.js';

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
let paint = null;
let openDoor = null;
const DOOR_OPEN = Math.PI / 3;

function selectionKey(target) {
  if (!target || target.wallId == null || target.start == null) return '';
  return `${target.wallId}:${target.start}:${target.bank || 'base'}`;
}

function formatIn(value) {
  return String(Math.round(value * 1000) / 1000);
}

function swapMaterial(node, from, to) {
  node.traverse((mesh) => {
    if (!mesh.isMesh || !from) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let changed = false;
    const next = list.map((slot) => {
      if (slot !== from && slot?.name !== to.name) return slot;
      changed = true;
      return to;
    });
    if (changed) mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
}

function tintCabinet(g, node, bankName, spec) {
  const bank = g.banks[bankName];
  const finish = bank.finish.clone();
  finish.color.set(spec.bodyColor || spec.color);
  finish.map = ['wood', 'mineral'].includes(spec.texture) ? g.texture(spec.texture) : null;
  finish.roughness = spec.texture === 'gloss' ? 0.13 : spec.texture === 'wood' ? 0.42 : 0.34;
  finish.clearcoat = spec.texture === 'gloss' ? 1 : 0;
  finish.clearcoatRoughness = 0.08;
  finish.needsUpdate = true;
  const hardware = bank.hardware.clone();
  hardware.color.set(spec.hardware === 'brass' ? '#c89d51' : '#25292b');
  hardware.metalness = spec.hardware === 'brass' ? 0.82 : 0.35;
  const frame = bank.frame.clone();
  frame.color.set(spec.frameColor || '#252b27');
  const glass = bank.glass.clone();
  glass.color.set(spec.color);
  glass.transmission = spec.fluted ? 0.93 : 0.65;
  glass.roughness = spec.fluted ? 0.13 : 0.18;
  if (spec.fluted && g.flutedNormal) glass.normalMap = g.flutedNormal();
  glass.needsUpdate = true;
  finish.name = 'CABINET_FINISH';
  hardware.name = 'CABINET_HARDWARE';
  frame.name = 'CABINET_FRAME';
  glass.name = 'CABINET_GLASS';
  swapMaterial(node, bank.finish, finish);
  swapMaterial(node, bank.hardware, hardware);
  swapMaterial(node, bank.frame, frame);
  swapMaterial(node, bank.glass, glass);
}

function makeSprite(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  ctx.fillRect(8, 24, 240, 80);
  ctx.fillStyle = '#29372e';
  ctx.font = '700 64px League Spartan, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 64);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
  sprite.renderOrder = 5;
  return sprite;
}

function labelWalls(g, room, rows) {
  const host = document.querySelector('#wall-labels');
  const chain = room?.walls ? wallChain(room, rows, SKU) : [];
  const names = { range: 'Stove wall', sink: 'Sink wall' };
  if (host) {
    host.replaceChildren(...chain.map((wall) => {
      const line = document.createElement('p');
      const sum = formatIn(wall.parts.reduce((total, part) => total + part, 0));
      line.textContent = `${names[wall.wallId] || wall.wallId} ${wall.parts.map(formatIn).join(' + ')} = ${sum} in`;
      return line;
    }));
    host.dataset.labels = chain.map((wall) => `${wall.wallId}:${wall.parts.map(formatIn).join('+')}=${formatIn(wall.length)}`).join(' ');
    const gaps = (rows || []).filter((row) => row.cut);
    if (gaps.length) {
      const note = document.createElement('p');
      note.textContent = gaps.map((gap) => `${formatIn(gap.width)} in on the ${names[gap.wallId] || gap.wallId} is an unresolved gap, not a cabinet to cut.`).join(' ');
      host.append(note);
    }
    host.hidden = document.body.dataset.phase !== 'ready' || !chain.length;
  }
  if (g.labelRoot) {
    g.scene.remove(g.labelRoot);
    g.labelRoot.traverse((node) => {
      node.material?.map?.dispose?.();
      node.material?.dispose?.();
    });
    g.labelRoot = null;
  }
  if (!chain.length) return;
  g.labelRoot = new THREE.Group();
  g.labelRoot.name = 'wall-labels';
  for (const wall of chain) {
    let at = 0;
    for (const part of wall.parts) {
      const sprite = makeSprite(formatIn(part));
      const mid = (at + part / 2) * IN;
      const out = (24 + 10) * IN;
      if (wall.wallId === 'sink') sprite.position.set(out, 0.42, mid);
      else sprite.position.set(mid, 0.42, out);
      const scale = Math.min(0.46, Math.max(0.18, part * IN * 0.85));
      sprite.scale.set(scale, scale * 0.5, 1);
      g.labelRoot.add(sprite);
      at += part;
    }
  }
  g.scene.add(g.labelRoot);
}

function frontOf(root) {
  let found = null;
  root.traverse((node) => {
    if (node.userData?.role === 'fronts' || String(node.name || '').startsWith('fronts')) found = node;
  });
  return found;
}

function pivotOf(root) {
  let found = null;
  root.traverse((node) => {
    if (node.name === 'door-pivot') found = node;
  });
  return found;
}

function hingeFront(front, side) {
  if (!front || front.userData.hinged) return pivotOf(front?.parent || front);
  const box = new THREE.Box3();
  let any = false;
  front.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix));
    any = true;
  });
  if (!any || box.isEmpty()) return null;
  const hingeX = side === 'right' ? box.max.x : box.min.x;
  const pivot = new THREE.Group();
  pivot.name = 'door-pivot';
  pivot.userData.side = side;
  front.parent.add(pivot);
  pivot.position.set(hingeX, 0, 0);
  pivot.attach(front);
  front.userData.hinged = true;
  return pivot;
}

function applyOpenDoor(g) {
  const canvas = g.renderer.domElement;
  for (const child of g.skuRoot?.children || []) {
    const pivot = pivotOf(child);
    if (!pivot) continue;
    const open = openDoor && selectionKey(child.userData) === openDoor;
    pivot.rotation.y = open ? (pivot.userData.side === 'right' ? DOOR_OPEN : -DOOR_OPEN) : 0;
  }
  if (openDoor) canvas.dataset.door = openDoor;
  else delete canvas.dataset.door;
}

globalThis.STUDIO_DOOR_OPEN = () => openDoor || '';

globalThis.STUDIO_CLOSE_DOOR = () => {
  openDoor = null;
  if (!viewer) return;
  applyOpenDoor(viewer);
  viewer.invalidate?.();
};

globalThis.STUDIO_TOGGLE_DOOR = () => {
  const sel = globalThis.STUDIO_SELECTION?.();
  const key = selectionKey(sel);
  const skuId = sel?.skuId || document.querySelector('#scene-canvas')?.dataset.selected?.split(':')[2];
  const sku = skuId && SKU.get(skuId);
  if (!key || !sku || (sku.kind !== 'base' && sku.kind !== 'upper')) return;
  openDoor = openDoor === key ? null : key;
  if (!viewer) return;
  applyOpenDoor(viewer);
  viewer.invalidate?.();
  const canvas = viewer.renderer.domElement;
  const parts = (canvas.dataset.selected || '').split(':');
  highlight(parts.length >= 3 ? { wallId: parts[0], start: Number(parts[1]), skuId: parts[2], bank: META[parts[2]]?.bank } : null);
};

globalThis.STUDIO_FINISH_OVERRIDE = () => paint;
globalThis.STUDIO_SET_FINISH_OVERRIDE = (next) => { paint = next || null; };

globalThis.STUDIO_PAINT = (scope, spec) => {
  const note = document.querySelector('#finish-scope-note');
  if (scope === 'clear') {
    paint = null;
    if (note && spec) {
      const chosen = globalThis.STUDIO_FINISH_SCOPE?.() || 'lowers';
      const where = chosen === 'uppers' ? 'every upper cabinet. Lowers stay as they are.' : chosen === 'kitchen' ? 'the entire kitchen, uppers and lowers.' : 'every lower cabinet. Uppers stay as they are.';
      note.textContent = `${spec.name} on ${where}`;
    }
    return true;
  }
  if (scope === 'one') {
    const sel = globalThis.STUDIO_SELECTION?.();
    if (!sel) {
      if (note) note.textContent = 'Select a cabinet, then pick a finish.';
      return false;
    }
    paint = { scope: 'one', key: selectionKey(sel), spec };
    if (note) note.textContent = `${spec.name} on this cabinet only.`;
    return true;
  }
  paint = null;
  return false;
};

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
  if (globalThis.STUDIO_WALL_COLOR) g.scene.background.set(globalThis.STUDIO_WALL_COLOR);
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
    if (meta.kind === 'base' || meta.kind === 'upper') hingeFront(frontOf(node), /-R$/.test(meta.id) ? 'right' : 'left');
    if (paint?.scope === 'one' && selectionKey({ wallId: row.wallId, start: row.start, bank: meta.bank }) === paint.key) tintCabinet(g, node, bankName, paint.spec);
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
  canvas.dataset.upperFinish = paint?.scope === 'all' ? paint.spec.id : design.upper.finish.id;
  canvas.dataset.lowerFinish = paint?.scope === 'all' ? paint.spec.id : design.lower.finish.id;
  canvas.dataset.finishScope = paint?.scope || 'bank';
  if (paint?.spec?.name) canvas.dataset.finishName = paint.spec.name;
  else delete canvas.dataset.finishName;
  if (paint?.scope === 'one') canvas.dataset.finishOne = paint.key;
  else delete canvas.dataset.finishOne;
  canvas.setAttribute('aria-label', `Assembled kitchen: ${placed.join(' ')}`);
  const caption = document.querySelector('#mode-caption');
  if (opts.still && caption) caption.textContent = 'This kitchen';
  document.querySelector('.image-stage')?.classList.toggle('quality-mode', Boolean(opts.still));
  labelWalls(g, room, rows);
  applySplash(g, room);
  applyOpenDoor(g);
  const selection = canvas.dataset.selected?.split(':');
  highlight(selection ? { wallId: selection[0], start: Number(selection[1]), skuId: selection[2], bank: META[selection[2]]?.bank } : null);
  g.resize?.();
  g.renderer.render(g.scene, g.camera);
  g.invalidate();
  if (!placed.length) throw new Error('No cabinet in this layout could be drawn. Your measurements are still here.');
  return true;
}

function applySplash(g, room) {
  if (g.splash) {
    g.scene.remove(g.splash);
    g.splash.traverse((node) => node.geometry?.dispose?.());
    g.splash = null;
  }
  const color = globalThis.STUDIO_SPLASH_COLOR;
  if (!color || !room?.walls) return;
  const group = new THREE.Group();
  group.name = 'backsplash';
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  const bottom = 34.5 * IN;
  const height = (54 - 34.5) * IN;
  for (const wall of room.walls) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.length * IN, height, 0.012), material);
    if (wall.id === 'sink') {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(0.006, bottom + height / 2, (wall.length * IN) / 2);
    } else mesh.position.set((wall.length * IN) / 2, bottom + height / 2, 0.006);
    group.add(mesh);
  }
  g.splash = group;
  g.scene.add(group);
}

globalThis.STUDIO_ASSEMBLE_SKU = assembleSku;
globalThis.STUDIO_HIGHLIGHT = highlight;
