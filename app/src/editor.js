// Neon Coast — Cover Studio editor: wires the workbench (photo slots, layout and
// grade pickers, lettering fields, panel tweaks, undo/redo, export) to the
// renderer. The state lives in studio-state.js; this file only moves it.

import {
  EXPORT_SIZES, LAYOUTS, GRADES, freshCoverState, panelDefaults,
  remapPanels, snapshotCover, restoreCover, makeHistory,
} from './studio-state.js';
import { drawCoverArt, renderCoverTo } from './render.js';

const MAX_PHOTOS = 3;
const MAX_PHOTO_SIDE = 2048;

/** Load an image from a URL and, if it is huge, downscale it once so the
 *  canvas stays fast. Resolves to the (possibly new) image element. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (Math.max(img.naturalWidth, img.naturalHeight) <= MAX_PHOTO_SIDE) {
        resolve(img);
        return;
      }
      const scale = MAX_PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight);
      const small = document.createElement('canvas');
      small.width = Math.round(img.naturalWidth * scale);
      small.height = Math.round(img.naturalHeight * scale);
      small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
      const shrunk = new Image();
      shrunk.onload = () => resolve(shrunk);
      shrunk.onerror = reject;
      shrunk.src = small.toDataURL('image/jpeg', 0.9);
    };
    img.onerror = () => reject(new Error('That file could not be read as a photo.'));
    img.src = url;
  });
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Build the whole editor on `canvas` and return its control surface, used by
 *  the screenshot scenes too. */
export function initStudio(canvas) {
  const state = freshCoverState();
  const images = [null, null, null];
  const names = ['', '', ''];
  const history = makeHistory();
  let lastSnapshot = snapshotCover(state);

  const $ = (id) => document.getElementById(id);
  const status = $('status');
  const say = (msg) => { status.textContent = msg; };

  function commit() {
    const now = snapshotCover(state);
    if (now === lastSnapshot) return;
    history.commit(lastSnapshot);
    lastSnapshot = now;
    syncHistoryButtons();
  }

  function redraw() {
    const size = EXPORT_SIZES[state.size];
    if (canvas.width !== size.w || canvas.height !== size.h) {
      canvas.width = size.w;
      canvas.height = size.h;
    }
    drawCoverArt(canvas.getContext('2d'), size.w, size.h, state, images);
    $('stageLabel').textContent = `Live preview · ${size.label}`;
  }

  function syncHistoryButtons() {
    $('undoBtn').disabled = !history.canUndo;
    $('redoBtn').disabled = !history.canRedo;
  }

  function applySnapshot(snapshot) {
    restoreCover(state, snapshot);
    lastSnapshot = snapshot;
    syncPanelControls();
    syncChoiceButtons();
    $('titleInput').value = state.title;
    $('subtitleInput').value = state.subtitle;
    $('taglineInput').value = state.tagline;
    $('sizeSelect').value = state.size;
    redraw();
  }

  // ---- photo slots -------------------------------------------------------
  function rebuildPhotoSlots() {
    const wrap = $('photoSlots');
    wrap.replaceChildren();
    for (let i = 0; i < MAX_PHOTOS; i += 1) {
      const slot = el('div', 'photo-slot');
      if (images[i]) {
        const thumb = el('img');
        thumb.src = images[i].src;
        thumb.alt = names[i] || `Photo ${i + 1}`;
        slot.append(thumb);
        const label = el('div', 'slot-name', names[i] || `Photo ${i + 1}`);
        label.append(el('small', '', 'Loaded — pick it in a panel below.'));
        slot.append(label);
        const remove = el('button', '', 'Remove');
        remove.type = 'button';
        remove.addEventListener('click', () => {
          images[i] = null;
          names[i] = '';
          state.panels.forEach((p) => { if (p.photo === i) p.photo = 0; });
          commit();
          rebuildPhotoSlots();
          syncPanelControls();
          redraw();
        });
        slot.append(remove);
      } else {
        slot.append(el('div', 'slot-empty', '+'));
        const label = el('div', 'slot-name', `Photo ${i + 1} — empty`);
        label.append(el('small', '', 'JPG or PNG from your machine.'));
        slot.append(label);
        const pick = el('label', '', '');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.hidden = true;
        input.addEventListener('change', async () => {
          const file = input.files[0];
          if (file) await addPhotoFile(file, i);
        });
        const btn = el('button', '', 'Choose file');
        btn.type = 'button';
        btn.addEventListener('click', () => input.click());
        pick.append(input, btn);
        slot.append(pick);
      }
      wrap.append(slot);
    }
    syncPanelControls();
  }

  async function addPhotoFile(file, slotIndex) {
    if (!file.type.startsWith('image/')) {
      say('That is not an image file — pick a JPG or PNG.');
      return false;
    }
    try {
      const img = await loadImage(URL.createObjectURL(file));
      images[slotIndex] = img;
      names[slotIndex] = file.name;
      if (!state.panels.some((p) => p.photo === slotIndex)) {
        state.panels[state.selected].photo = slotIndex;
      }
      commit();
      rebuildPhotoSlots();
      redraw();
      say(`Loaded ${file.name}.`);
      return true;
    } catch {
      say('That photo could not be read — try a different file.');
      return false;
    }
  }

  async function loadSample(name) {
    const free = images.findIndex((img) => img === null);
    const slotIndex = free === -1 ? 0 : free;
    try {
      const res = await fetch(`samples/${name}.jpg`);
      if (!res.ok) throw new Error('sample missing');
      const img = await loadImage(URL.createObjectURL(await res.blob()));
      images[slotIndex] = img;
      names[slotIndex] = `${name}.jpg (sample)`;
      // Fill every panel that currently shows no photo with the new one, so
      // one sample fills the whole cover instead of leaving half the panels
      // on the sunset placeholder.
      state.panels.forEach((p) => { if (!images[p.photo]) p.photo = slotIndex; });
      commit();
      rebuildPhotoSlots();
      redraw();
      say(`Sample ${name} loaded into photo slot ${slotIndex + 1}.`);
      return true;
    } catch {
      say('The sample photo could not be loaded.');
      return false;
    }
  }

  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => loadSample(btn.dataset.sample));
  });

  // ---- layout + grade pickers --------------------------------------------
  function buildChoiceGrid(gridId, entries, current, onPick) {
    const grid = $(gridId);
    grid.replaceChildren();
    Object.entries(entries).forEach(([key, def]) => {
      const btn = el('button', 'choice');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(key === current));
      if (def.swatch) {
        const sw = el('span', 'swatch');
        sw.style.background = def.swatch;
        btn.append(sw);
      }
      btn.append(el('b', '', def.name), el('small', '', def.blurb));
      btn.addEventListener('click', () => onPick(key));
      grid.append(btn);
    });
  }

  function syncChoiceButtons() {
    buildChoiceGrid('layoutGrid', LAYOUTS, state.layout, pickLayout);
    buildChoiceGrid('gradeGrid', GRADES, state.grade, pickGrade);
  }

  function pickLayout(key) {
    if (key === state.layout) return;
    state.layout = key;
    state.panels = remapPanels(state.panels, key);
    state.selected = 0;
    commit();
    syncChoiceButtons();
    syncPanelControls();
    redraw();
  }

  function pickGrade(key) {
    if (key === state.grade) return;
    state.grade = key;
    commit();
    syncChoiceButtons();
    redraw();
  }

  // ---- lettering -----------------------------------------------------------
  function bindText(id, field) {
    $(id).addEventListener('input', (e) => {
      state[field] = e.target.value;
      redraw();
    });
    $(id).addEventListener('change', commit);
  }
  bindText('titleInput', 'title');
  bindText('subtitleInput', 'subtitle');
  bindText('taglineInput', 'tagline');

  $('sizeSelect').addEventListener('change', (e) => {
    state.size = e.target.value;
    commit();
    redraw();
  });

  // ---- selected panel ------------------------------------------------------
  function selectedPanel() {
    return state.panels[state.selected] || state.panels[0];
  }

  function syncPanelControls() {
    const panel = selectedPanel();
    $('selectedHint').textContent =
      `Panel ${state.selected + 1} of ${state.panels.length} — drag it on the cover to pan, scroll to zoom.`;
    const select = $('panelPhoto');
    select.replaceChildren();
    const none = el('option', '', 'No photo (sunset placeholder)');
    none.value = '-1';
    select.append(none);
    images.forEach((img, i) => {
      if (!img) return;
      const opt = el('option', '', names[i] || `Photo ${i + 1}`);
      opt.value = String(i);
      select.append(opt);
    });
    select.value = String(images[panel.photo] ? panel.photo : -1);
    $('zoomRange').value = Math.round(panel.zoom * 100);
    $('zoomVal').textContent = `${Math.round(panel.zoom * 100)}%`;
    $('panXRange').value = Math.round(panel.panX * 100);
    $('panXVal').textContent = String(Math.round(panel.panX * 100));
    $('panYRange').value = Math.round(panel.panY * 100);
    $('panYVal').textContent = String(Math.round(panel.panY * 100));
  }

  $('panelPhoto').addEventListener('change', (e) => {
    selectedPanel().photo = Number(e.target.value);
    commit();
    redraw();
  });

  function bindRange(id, valId, field, format) {
    $(id).addEventListener('input', (e) => {
      selectedPanel()[field] = Number(e.target.value) / 100;
      $(valId).textContent = format(Number(e.target.value));
      redraw();
    });
    $(id).addEventListener('change', commit);
  }
  bindRange('zoomRange', 'zoomVal', 'zoom', (v) => `${v}%`);
  bindRange('panXRange', 'panXVal', 'panX', (v) => String(v));
  bindRange('panYRange', 'panYVal', 'panY', (v) => String(v));

  $('resetPanelBtn').addEventListener('click', () => {
    const panel = selectedPanel();
    panel.zoom = 1;
    panel.panX = 0;
    panel.panY = 0;
    commit();
    syncPanelControls();
    redraw();
  });

  $('fillAllBtn').addEventListener('click', () => {
    const photo = selectedPanel().photo;
    state.panels.forEach((p) => { p.photo = photo; });
    commit();
    syncPanelControls();
    redraw();
    say('Every panel now shows the same photo.');
  });

  // ---- canvas picking, dragging, zooming ------------------------------------
  function coverPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function panelAt(point) {
    const layout = LAYOUTS[state.layout];
    for (let i = layout.slots.length - 1; i >= 0; i -= 1) {
      const s = layout.slots[i];
      if (
        point.x >= s.x * canvas.width && point.x <= (s.x + s.w) * canvas.width
        && point.y >= s.y * canvas.height && point.y <= (s.y + s.h) * canvas.height
      ) return i;
    }
    return -1;
  }

  let drag = null;
  canvas.addEventListener('pointerdown', (event) => {
    const point = coverPoint(event);
    const hit = panelAt(point);
    if (hit < 0) return;
    state.selected = hit;
    syncPanelControls();
    redraw();
    const panel = selectedPanel();
    drag = { startX: point.x, startY: point.y, panX: panel.panX, panY: panel.panY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const point = coverPoint(event);
    const layout = LAYOUTS[state.layout];
    const slot = layout.slots[state.selected];
    const panel = selectedPanel();
    panel.panX = Math.max(-1, Math.min(1, drag.panX + ((point.x - drag.startX) / (slot.w * canvas.width)) * 2));
    panel.panY = Math.max(-1, Math.min(1, drag.panY + ((point.y - drag.startY) / (slot.h * canvas.height)) * 2));
    syncPanelControls();
    redraw();
  });
  function endDrag() {
    if (!drag) return;
    drag = null;
    commit();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  let wheelTimer = null;
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const panel = selectedPanel();
    panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-event.deltaY * 0.0012)));
    syncPanelControls();
    redraw();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(commit, 350);
  }, { passive: false });

  // ---- undo / redo -----------------------------------------------------------
  $('undoBtn').addEventListener('click', () => {
    const snap = history.undo(lastSnapshot);
    if (snap !== null) {
      applySnapshot(snap);
      say('Undid the last change.');
    }
  });
  $('redoBtn').addEventListener('click', () => {
    const snap = history.redo(lastSnapshot);
    if (snap !== null) {
      applySnapshot(snap);
      say('Redid the change.');
    }
  });
  document.addEventListener('keydown', (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    if (event.target.matches('input, select, textarea')) return;
    event.preventDefault();
    if (event.shiftKey) $('redoBtn').click();
    else $('undoBtn').click();
  });

  // ---- export ----------------------------------------------------------------
  async function exportPng() {
    const offscreen = document.createElement('canvas');
    const size = renderCoverTo(offscreen, state.size, state, images);
    const blob = await new Promise((resolve) => offscreen.toBlob(resolve, 'image/png'));
    if (!blob) {
      say('Export failed — try again.');
      return null;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-coast-${size.w}x${size.h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    say(`Exported neon-coast-${size.w}x${size.h}.png — share it anywhere.`);
    return blob;
  }
  $('exportBtn').addEventListener('click', exportPng);

  rebuildPhotoSlots();
  syncChoiceButtons();
  syncPanelControls();
  syncHistoryButtons();
  redraw();

  return {
    state,
    images,
    names,
    redraw,
    commit,
    applySnapshot,
    loadSample,
    loadImage,
    exportPng,
    setState(next) {
      Object.assign(state, next);
      state.panels = panelDefaults(state.layout).map((d, i) => ({ ...d, ...(state.panels[i] || {}) }));
      applySnapshot(snapshotCover(state));
    },
  };
}
