#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'https';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const LIVE_V1 = 'https://turbo-cabinets-studio-v1.vercel.app/';
const BLOCKED = [
  'https://turbo-cabinets-studio.vercel.app',
  'https://turbocabinets.net/studio',
];
const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DIR = path.resolve(SKILL_DIR, '../../..');
const RUN_ID = process.env.RUN_ID || String(process.pid);
const STATE_DIR = process.env.STUDIO_VERIFY_DIR || `/tmp/studio-verify-${RUN_ID}`;
const INSTANCE = path.join(STATE_DIR, 'instance.json');
const ARTIFACTS = path.join(SKILL_DIR, 'artifacts');

const argv = process.argv.slice(2);
const cmd = argv[0];
if (!cmd) fail('usage: control-studio launch|doctor|browser|stop');

if (cmd === 'launch') await launch(argv.includes('--local'));
else if (cmd === 'doctor') await doctor();
else if (cmd === 'stop') await stop();
else if (cmd === 'browser') await browser(argv.slice(1));
else fail(`unknown command ${cmd}`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function launch(local) {
  await mkdir(STATE_DIR, { recursive: true });
  await mkdir(ARTIFACTS, { recursive: true });
  let url = LIVE_V1;
  let serverPid = null;
  if (local) {
    const overlay = path.join(STATE_DIR, 'www');
    await mkdir(overlay, { recursive: true });
    for (const name of ['index.html', 'studio.css', 'studio.js', 'showroom.js', 'templates.js', 'kitchen.js', 'pack.js', 'catalog.js', 'studio.p1.txt', 'studio.p2.txt', 'studio.p3.txt', 'studio.p4.txt']) {
      await cp(path.join(REPO_DIR, name), path.join(overlay, name));
    }
    await fetchModels(overlay);
    const port = await freePort();
    const child = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
      cwd: overlay,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    serverPid = child.pid;
    url = `http://127.0.0.1:${port}/`;
    await waitHttp(url);
  }
  const profile = path.join(STATE_DIR, 'chrome-profile');
  const downloads = path.join(STATE_DIR, 'downloads');
  await mkdir(profile, { recursive: true });
  await mkdir(downloads, { recursive: true });
  const debugPort = await freePort();
  const chrome = spawn(process.env.CHROME_BIN || '/usr/bin/google-chrome-stable', [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${debugPort}`,
    '--headless=new',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
    '--no-first-run',
    '--no-default-browser-check',
    url,
  ], { detached: true, stdio: 'ignore' });
  chrome.unref();
  const browserURL = `http://127.0.0.1:${debugPort}`;
  await waitJson(`${browserURL}/json/version`);
  const browserInstance = await puppeteer.connect({ browserURL });
  const page = (await browserInstance.pages())[0] || await browserInstance.newPage();
  const client = await page.createCDPSession();
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads }).catch(async () => {
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  });
  if (!page.url().includes('vercel.app') && !page.url().includes('127.0.0.1')) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#measure-open', { timeout: 30000 });
  await writeFile(INSTANCE, JSON.stringify({
    url,
    local,
    serverPid,
    chromePid: chrome.pid,
    debugPort,
    browserURL,
    profile,
    downloads,
    runId: RUN_ID,
  }, null, 2));
  await browserInstance.disconnect();
  console.log(`launched url=${url} run=${RUN_ID} debug=${debugPort}`);
}

async function doctor() {
  const instance = await readInstance();
  if (BLOCKED.some((origin) => instance.url.startsWith(origin))) fail(`refusing ${instance.url}`);
  const html = await getText(instance.url);
  const hasCore = html.includes('id="measure-open"') && html.includes('data-view="kitchen"') && html.includes('id="job-download"');
  const v1 = hasCore && html.includes('id="template-list"');
  const title = /<title>([^<]+)</.exec(html)?.[1] || '';
  if (title !== 'Cabinet studio · Turbo Cabinets') fail(`unexpected title ${title}`);
  if (!v1) fail('page is not V1 (missing welcome, Room sizes, Kitchen view, or Save job)');
  if (html.includes('data-mode=')) fail('page still has the preview mode bar');
  const { page, browser: chrome } = await connect(instance);
  const errorHidden = await page.$eval('#load-error', (el) => el.hidden).catch(() => false);
  const phase = await page.$eval('body', (el) => el.dataset.phase || '').catch(() => '');
  const welcome = await page.$eval('#welcome', (el) => !el.hidden).catch(() => false);
  await chrome.disconnect();
  console.log(`ok url=${instance.url} v1=true title=${JSON.stringify(title)} phase=${phase || 'none'} welcome=${welcome} loadErrorHidden=${errorHidden}`);
}

async function stop() {
  let instance;
  try { instance = await readInstance(); } catch { console.log('nothing to stop'); return; }
  try {
    const chrome = await puppeteer.connect({ browserURL: instance.browserURL || `http://127.0.0.1:${instance.debugPort}` });
    await chrome.close();
  } catch {
    if (instance.chromePid) try { process.kill(instance.chromePid, 'SIGTERM'); } catch {}
  }
  if (instance.chromePid) try { process.kill(instance.chromePid, 'SIGTERM'); } catch {}
  if (instance.serverPid) try { process.kill(instance.serverPid, 'SIGTERM'); } catch {}
  for (let i = 0; i < 6; i++) {
    try {
      await rm(STATE_DIR, { recursive: true, force: true });
      break;
    } catch (err) {
      if (i === 5) throw err;
      await sleep(250);
    }
  }
  console.log(`stopped run=${instance.runId} artifacts=${ARTIFACTS}`);
}

async function browser(args) {
  const instance = await readInstance();
  const { page, browser: chrome } = await connect(instance);
  const action = args[0];
  const flags = parseFlags(args.slice(1));
  try {
    if (action === 'click') {
      const selector = need(flags, 'selector');
      const clicked = await page.$eval(selector, (el) => {
        el.click();
        return true;
      }).catch(() => false);
      if (!clicked) fail(`missing ${selector}`);
      console.log(`clicked ${selector}`);
    } else if (action === 'fill') {
      const selector = need(flags, 'selector');
      const value = need(flags, 'value');
      const filled = await page.$eval(selector, (el, next) => {
        el.focus();
        el.value = next;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return el.value;
      }, value).catch(() => null);
      if (filled == null) fail(`missing ${selector}`);
      console.log(`filled ${selector}`);
    } else if (action === 'press') {
      await page.keyboard.press(need(flags, 'key'));
      console.log(`pressed ${flags.key}`);
    } else if (action === 'snapshot') {
      const dest = path.resolve(need(flags, 'path'));
      await mkdir(path.dirname(dest), { recursive: true });
      const tree = await page.evaluate(() => document.body.innerText);
      await writeFile(dest, tree);
      console.log(`wrote ${dest}`);
    } else if (action === 'screenshot') {
      const dest = path.resolve(need(flags, 'path'));
      await mkdir(path.dirname(dest), { recursive: true });
      await page.screenshot({ path: dest, fullPage: true });
      console.log(`wrote ${dest}`);
    } else if (action === 'bounds') {
      const report = await placedBounds(page);
      if (flags.path) {
        const dest = path.resolve(flags.path);
        await mkdir(path.dirname(dest), { recursive: true });
        await writeFile(dest, JSON.stringify(report, null, 1));
        console.log(`wrote ${dest}`);
      }
      for (const item of report.placed) {
        const { min, max } = item.world;
        console.log(`${item.wallId} ${item.skuId} x[${min[0]},${max[0]}] y[${min[1]},${max[1]}] z[${min[2]},${max[2]}]`);
      }
      for (const door of report.doors) {
        const swing = `swing x[${door.swing.x}] z[${door.swing.z}]`;
        if (!door.blockedBy.length) console.log(`door ${door.mesh} ${swing} clear`);
        for (const hit of door.blockedBy) console.log(`door ${door.mesh} ${swing} blocked by ${hit.mesh} at x[${hit.x}] z[${hit.z}]`);
      }
      const blocked = report.doors.filter((door) => door.blockedBy.length).length;
      console.log(`placed=${report.placed.length} stacked=${report.stacked} sharedFloor=${report.sharedFloor.length} cornerDoors=${report.doors.length} blocked=${blocked}`);
      for (const pair of report.sharedFloor) console.log(`  ${pair.a} x ${pair.b} shares ${pair.x} x ${pair.z} in`);
      if (report.sharedFloor.length) fail('placed meshes share floor');
      if (blocked) fail('a corner door cannot swing');
    } else {
      fail(`unknown browser action ${action}`);
    }
  } finally {
    await chrome.disconnect();
  }
}

async function placedBounds(page) {
  const placed = await page.evaluate(async () => {
    const THREE = await import('three');
    const viewer = globalThis.STUDIO_VIEWER;
    if (!viewer?.skuRoot) throw new Error('no assembled SKU kitchen on the page');
    const toIn = (value) => Math.round((value / 0.0254) * 1000) / 1000;
    const manifest = await fetch('/models/sku-v1/manifest.json').then((res) => (res.ok ? res.json() : { assets: [] })).catch(() => ({ assets: [] }));
    const assets = new Map(manifest.assets.map((asset) => [asset.id, asset]));
    viewer.skuRoot.updateMatrixWorld(true);
    return viewer.skuRoot.children.map((node) => {
      const box = new THREE.Box3().setFromObject(node, true);
      const asset = assets.get(node.userData.skuId);
      return {
        skuId: node.userData.skuId,
        wallId: node.userData.wallId,
        style: node.userData.style,
        position: node.position.toArray().map(toIn),
        world: { min: box.min.toArray().map(toIn), max: box.max.toArray().map(toIn) },
        blind: asset?.frontOffset == null ? null : { depth: asset.depth, frontOffset: asset.frontOffset, frontWidth: asset.frontWidth },
      };
    });
  });
  const eps = 0.01;
  const span = (a, b, axis) => Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]);
  const round = (value) => Math.round(value * 1000) / 1000;
  const name = (item) => `${item.wallId}/${item.skuId}@${item.position[0]},${item.position[2]}`;
  const sharedFloor = [];
  let stacked = 0;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i].world;
      const b = placed[j].world;
      const x = span(a, b, 0);
      const z = span(a, b, 2);
      if (x <= eps || z <= eps) continue;
      if (span(a, b, 1) <= eps) stacked++;
      else sharedFloor.push({ a: name(placed[i]), b: name(placed[j]), x: round(x), z: round(z) });
    }
  }
  const doors = placed.filter((item) => item.blind).map((item) => {
    const { min, max } = item.world;
    const { depth, frontOffset, frontWidth } = item.blind;
    const swing = item.wallId === 'sink'
      ? { min: [min[0] + depth, min[1], max[2] - frontOffset - frontWidth], max: [min[0] + depth + frontWidth, max[1], max[2] - frontOffset] }
      : { min: [min[0] + frontOffset, min[1], min[2] + depth], max: [min[0] + frontOffset + frontWidth, max[1], min[2] + depth + frontWidth] };
    const blockedBy = placed
      .filter((other) => other !== item && span(swing, other.world, 0) > eps && span(swing, other.world, 1) > eps && span(swing, other.world, 2) > eps)
      .map((other) => ({
        mesh: name(other),
        x: [round(Math.max(swing.min[0], other.world.min[0])), round(Math.min(swing.max[0], other.world.max[0]))],
        z: [round(Math.max(swing.min[2], other.world.min[2])), round(Math.min(swing.max[2], other.world.max[2]))],
      }));
    return { mesh: name(item), swing: { x: [round(swing.min[0]), round(swing.max[0])], z: [round(swing.min[2]), round(swing.max[2])] }, blockedBy };
  });
  return { url: page.url(), placed, stacked, sharedFloor, doors };
}

async function connect(instance) {
  const chrome = await puppeteer.connect({ browserURL: instance.browserURL || `http://127.0.0.1:${instance.debugPort}` });
  const pages = await chrome.pages();
  const page = pages.find((p) => p.url().includes('cabinet') || p.url().includes('127.0.0.1')) || pages[0];
  if (!page) fail('no Chrome page');
  const client = await page.createCDPSession();
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: instance.downloads }).catch(async () => {
    await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: instance.downloads });
  });
  return { browser: chrome, page };
}

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) continue;
    const key = args[i].slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else out[key] = args[++i];
  }
  return out;
}

function need(flags, key) {
  if (!flags[key]) fail(`missing --${key}`);
  return flags[key];
}

async function readInstance() {
  try { return JSON.parse(await readFile(INSTANCE, 'utf8')); }
  catch { fail(`no instance at ${INSTANCE}. run launch first`); }
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitHttp(url) {
  for (let i = 0; i < 40; i++) {
    try { await getText(url); return; } catch { await sleep(250); }
  }
  fail(`server did not answer ${url}`);
}

async function waitJson(url) {
  for (let i = 0; i < 40; i++) {
    try { return JSON.parse(await getText(url)); } catch { await sleep(250); }
  }
  fail(`chrome debug port did not answer ${url}`);
}

function getText(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) return reject(new Error(`${url} ${res.statusCode}`));
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

async function fetchModels(overlay) {
  const catalogText = await readFile(path.join(overlay, 'catalog.js'), 'utf8');
  const json = JSON.parse(catalogText.split('=').slice(1).join('=').trim().replace(/;$/, ''));
  const paths = [json.layout.commonAsset, ...json.styles.flatMap((style) => [style.upperAsset, style.lowerAsset])];
  for (const rel of paths) {
    const dest = path.join(overlay, rel);
    try { await access(dest); continue; } catch {}
    await mkdir(path.dirname(dest), { recursive: true });
    await download(`${LIVE_V1}${rel}`, dest);
  }
  const skuDir = path.join(REPO_DIR, 'models', 'sku-v1');
  try {
    await access(skuDir);
    await mkdir(path.join(overlay, 'models', 'sku-v1'), { recursive: true });
    await cp(skuDir, path.join(overlay, 'models', 'sku-v1'), { recursive: true });
  } catch {
    /* live V1 host will serve sku-v1 after deploy */
  }
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`${url} ${res.statusCode}`));
      const out = createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => out.close(resolve));
      out.on('error', reject);
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
