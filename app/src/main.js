// Wires the Neon Coast editor: photos in, live cover preview, PNG exports out.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).

import { LAYOUTS, GRADES, SIZES, drawCoverArt, renderCoverToCanvas, layoutPanels } from './cover.js';
import { defaultState, cloneState, clampSelection, CoverHistory } from './state.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const tray = document.getElementById('tray');
const panelLabel = document.getElementById('panel-label');

export const state = defaultState();
export const history = new CoverHistory(state);
export let photos = [];

function redraw() {
  const size = SIZES[state.size] || SIZES.wide;
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  drawCoverArt(canvas, photos, state);
  document.getElementById('undo').disabled = !history.canUndo();
  document.getElementById('redo').disabled = !history.canRedo();
  panelLabel.textContent = `Panel ${state.selected + 1} of ${panelCount()} — drag it to pan, scroll to zoom`;
}

function panelCount() {
  return (LAYOUTS[state.layout] || LAYOUTS.nine).panels;
}

/** Commits the current state to the undo history and redraws. */
export function commit() {
  clampSelection(state);
  history.push(cloneState(state));
  redraw();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Downscales a huge photo to at most 1600 px on its long side, for speed. */
export function downscalePhoto(img) {
  const max = 1600;
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= max) return Promise.resolve(img);
  const scale = max / longest;
  const off = document.createElement('canvas');
  off.width = Math.round(img.naturalWidth * scale);
  off.height = Math.round(img.naturalHeight * scale);
  off.getContext('2d').drawImage(img, 0, 0, off.width, off.height);
  return loadImage(off.toDataURL('image/jpeg', 0.88));
}

/** Adds loaded photos to the tray and points empty panels at them. */
export async function addPhotos(images, names) {
  for (const img of images) {
    photos.push(await downscalePhoto(img));
  }
  renderTray();
  commit();
  status.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} loaded — pick a layout and export.`;
}

/** Rebuilds the photo tray thumbnails from the loaded photos. */
export function renderTray() {
  tray.innerHTML = '';
  photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.title = `Use photo ${i + 1} for the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = photo.src;
    thumb.alt = `Photo ${i + 1}`;
    button.appendChild(thumb);
    button.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      commit();
    });
    tray.appendChild(button);
  });
}

/** Builds the layout, grade and size picker buttons, marking the current
choice active in each group. */
export function buildPickers() {
  const layouts = document.getElementById('layouts');
  Object.entries(LAYOUTS).forEach(([id, layout]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.layout = id;
    button.textContent = layout.name;
    button.addEventListener('click', () => {
      state.layout = id;
      document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('active', b === button));
      commit();
    });
    if (id === state.layout) button.classList.add('active');
    layouts.appendChild(button);
  });
  const grades = document.getElementById('grades');
  Object.entries(GRADES).forEach(([id, grade]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.grade = id;
    button.textContent = grade.name;
    button.style.setProperty('--g1', grade.top);
    button.style.setProperty('--g2', grade.bottom);
    button.addEventListener('click', () => {
      state.grade = id;
      document.querySelectorAll('#grades button').forEach((b) => b.classList.toggle('active', b === button));
      commit();
    });
    if (id === state.grade) button.classList.add('active');
    grades.appendChild(button);
  });
  const sizes = document.getElementById('sizes');
  Object.entries(SIZES).forEach(([id, size]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.size = id;
    button.textContent = size.name;
    button.addEventListener('click', () => {
      state.size = id;
      document.querySelectorAll('#sizes button').forEach((b) => b.classList.toggle('active', b === button));
      commit();
    });
    if (id === state.size) button.classList.add('active');
    sizes.appendChild(button);
  });
}

/** Exports the current cover at one size as a PNG download. */
export function exportCover(sizeId) {
  const size = SIZES[sizeId] || SIZES[state.size];
  const out = renderCoverToCanvas(photos, state, size.w, size.h);
  out.toBlob((blob) => {
    if (!blob) { status.textContent = 'Export failed — try again.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-cover-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    status.textContent = `Saved neon-coast-cover-${size.w}x${size.h}.png`;
  }, 'image/png');
}

/** Finds which panel (if any) a preview point falls in. */
export function panelAtPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  const titleH = state.layout === 'bleed' ? 0 : Math.round(canvas.height * 0.21);
  const rects = layoutPanels(state.layout, canvas.width, canvas.height, titleH);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

let dragging = null;

canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAtPoint(e.clientX, e.clientY);
  if (hit < 0) return;
  state.selected = hit;
  dragging = { x: e.clientX, y: e.clientY, moved: false };
  canvas.setPointerCapture(e.pointerId);
  redraw();
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const slot = state.panels[state.selected];
  const rect = canvas.getBoundingClientRect();
  slot.ox = Math.max(-1, Math.min(1, slot.ox + ((e.clientX - dragging.x) / rect.width) * 2));
  slot.oy = Math.max(-1, Math.min(1, slot.oy + ((e.clientY - dragging.y) / rect.height) * 2));
  dragging.x = e.clientX;
  dragging.y = e.clientY;
  dragging.moved = true;
  redraw();
});

canvas.addEventListener('pointerup', () => {
  if (dragging && dragging.moved) commit();
  dragging = null;
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const slot = state.panels[state.selected];
  slot.zoom = Math.max(1, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
  redraw();
}, { passive: false });

document.getElementById('photos').addEventListener('change', async (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
  if (!files.length) { status.textContent = 'That file is not an image — pick a photo.'; return; }
  const loaded = [];
  for (const file of files) {
    try { loaded.push(await loadImage(URL.createObjectURL(file))); } catch { /* skip unreadable files */ }
  }
  if (loaded.length) addPhotos(loaded, files.map((f) => f.name));
  else status.textContent = 'Could not read that photo — try another file.';
});

document.getElementById('load-samples').addEventListener('click', async () => {
  const loaded = [];
  for (const name of ['boulevard', 'pier']) {
    try { loaded.push(await loadImage(`samples/${name}.jpg`)); } catch { /* sample missing */ }
  }
  if (loaded.length) addPhotos(loaded, ['boulevard.jpg', 'pier.jpg']);
});

document.getElementById('fill-all').addEventListener('click', () => {
  const pick = state.panels[state.selected].photo;
  state.panels.forEach((slot) => { slot.photo = pick; });
  commit();
  status.textContent = 'Every panel now uses the selected panel’s photo.';
});

document.getElementById('zoom').addEventListener('input', (e) => {
  state.panels[state.selected].zoom = Number(e.target.value);
  redraw();
});
document.getElementById('zoom').addEventListener('change', commit);
document.getElementById('panx').addEventListener('input', (e) => {
  state.panels[state.selected].ox = Number(e.target.value);
  redraw();
});
document.getElementById('panx').addEventListener('change', commit);
document.getElementById('pany').addEventListener('input', (e) => {
  state.panels[state.selected].oy = Number(e.target.value);
  redraw();
});
document.getElementById('pany').addEventListener('change', commit);

captionInput.addEventListener('input', () => { state.title = captionInput.value; redraw(); });
captionInput.addEventListener('change', commit);
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
subtitleInput.addEventListener('change', commit);
document.getElementById('title-size').addEventListener('input', (e) => {
  state.titleScale = Number(e.target.value);
  redraw();
});
document.getElementById('title-size').addEventListener('change', commit);
document.getElementById('heat').addEventListener('input', (e) => {
  state.heat = Number(e.target.value);
  redraw();
});
document.getElementById('heat').addEventListener('change', commit);

for (const id of ['frame', 'grain', 'vignette']) {
  document.getElementById(id).addEventListener('change', (e) => {
    state[id] = e.target.checked;
    commit();
  });
}

document.getElementById('undo').addEventListener('click', () => {
  const back = history.undo();
  if (back) { Object.assign(state, back); redraw(); }
});
document.getElementById('redo').addEventListener('click', () => {
  const next = history.redo();
  if (next) { Object.assign(state, next); redraw(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('undo').click();
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault();
    document.getElementById('redo').click();
  }
});

document.querySelectorAll('[data-export]').forEach((button) => {
  button.addEventListener('click', () => exportCover(button.dataset.export));
});
document.getElementById('export-all').addEventListener('click', () => {
  Object.keys(SIZES).forEach((id, i) => setTimeout(() => exportCover(id), i * 350));
  status.textContent = 'Exporting all three sizes…';
});

buildPickers();

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadImage, addPhotos, redraw, commit,
    get state() { return state; },
    setPhotos(next) { photos = next; renderTray(); },
  });
} else {
  redraw();
}
