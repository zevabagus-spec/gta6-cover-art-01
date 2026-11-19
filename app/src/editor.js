// editor.js — wires the controls in index.html to the state and the canvas.
// Owns photo loading, panel selection, drag-to-pan, pickers, undo/redo and export.
import { LAYOUTS, LAYOUT_LABELS, GRADES, GRADE_LABELS, SIZES, SIZE_KEYS, makeHistory, snapshotState } from './state.js';
import { renderCover } from './render.js';
import { panelPolygons, polygonBounds } from './layouts.js';

const $ = (id) => document.getElementById(id);

export function createEditor(state) {
  const photos = []; // HTMLImageElement list, parallel to the photo picker
  const history = makeHistory(state);
  const canvas = $('coverCanvas');
  let drag = null; // {x, y, ox, oy} while a panel is being dragged
  let zoomBefore = null; // pre-change snapshot while the zoom slider moves
  let fontsReady = false;

  // Preview resolution: cap the long side so the live preview stays fast.
  function previewSize() {
    const s = SIZES[state.sizeKey] || SIZES.wide;
    const cap = 1280;
    const k = Math.min(1, cap / Math.max(s.w, s.h));
    return { w: Math.round(s.w * k), h: Math.round(s.h * k) };
  }

  function render() {
    const { w, h } = previewSize();
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    renderCover(canvas, state, photos);
  }

  function renderWhenFontsReady() {
    if (fontsReady) { render(); return; }
    const timeout = new Promise((res) => setTimeout(res, 1200));
    const loaded = Promise.all([
      document.fonts.load('100px Anton'),
      document.fonts.load('40px Pacifico'),
    ]).catch(() => undefined);
    Promise.race([loaded, timeout]).then(() => { fontsReady = true; render(); });
    render(); // first paint immediately with the fallback font, then re-paint
  }

  function setStatus(msg) { $('status').textContent = msg; }

  function refreshPickers() {
    $('layoutRow').innerHTML = '';
    for (const key of LAYOUTS) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = LAYOUT_LABELS[key];
      if (state.layout === key) b.classList.add('active');
      b.addEventListener('click', () => { history.push(); state.layout = key; refreshPickers(); render(); });
      $('layoutRow').appendChild(b);
    }
    $('gradeRow').innerHTML = '';
    for (const key of GRADES) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = GRADE_LABELS[key];
      if (state.grade === key) b.classList.add('active');
      b.addEventListener('click', () => { history.push(); state.grade = key; refreshPickers(); render(); });
      $('gradeRow').appendChild(b);
    }
    $('sizeRow').innerHTML = '';
    for (const key of SIZE_KEYS) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = SIZES[key].label;
      if (state.sizeKey === key) b.classList.add('active');
      b.addEventListener('click', () => {
        history.push(); state.sizeKey = key; refreshPickers(); render();
        $('sizeNote').textContent = `${SIZES[key].w} × ${SIZES[key].h}`;
      });
      $('sizeRow').appendChild(b);
    }
  }

  function refreshPanelControls() {
    const panel = state.panels[state.selected];
    $('selLabel').textContent = String(state.selected + 1);
    const sel = $('panelPhoto');
    sel.innerHTML = '';
    photos.forEach((img, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = `Photo ${i + 1}${img.dataset.name ? ' — ' + img.dataset.name : ''}`;
      sel.appendChild(o);
    });
    if (!photos.length) {
      const o = document.createElement('option');
      o.textContent = 'No photo yet';
      sel.appendChild(o);
    }
    sel.value = String(panel.photo);
    $('zoomSlider').value = String(Math.round(panel.zoom * 100));
    $('zoomVal').textContent = panel.zoom.toFixed(1) + '×';
    document.querySelectorAll('#thumbRow img').forEach((el, i) => {
      el.classList.toggle('sel', i === panel.photo);
    });
    $('undoBtn').disabled = !history.canUndo();
    $('redoBtn').disabled = !history.canRedo();
  }

  function refreshThumbs() {
    const row = $('thumbRow');
    row.innerHTML = '';
    photos.forEach((img, i) => {
      const t = document.createElement('img');
      t.src = img.src;
      t.alt = `Photo ${i + 1}`;
      t.addEventListener('click', () => {
        history.push();
        state.panels[state.selected].photo = i;
        refreshPanelControls(); render();
      });
      row.appendChild(t);
    });
  }

  function addPhoto(img, name, index) {
    img.dataset.name = name || '';
    // A fixed index keeps the sample photos in a stable order no matter which
    // one finishes loading first; user uploads just append.
    if (typeof index === 'number') photos[index] = img;
    else photos.push(img);
    refreshThumbs();
    refreshPanelControls();
    render();
  }

  function loadSample(url, name, index) {
    const img = new Image();
    img.onload = () => addPhoto(img, name, index);
    img.onerror = () => setStatus(`Sample ${name} failed to load — add a photo to begin.`);
    img.src = url;
  }

  // Which panel (if any) sits under a point in the preview canvas, in unit coords.
  function panelAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const x = (clientX - r.left) / r.width, y = (clientY - r.top) / r.height;
    const polys = panelPolygons(state.layout);
    const count = state.layout === 'full' ? 1 : 4;
    for (let i = 0; i < count; i++) {
      const b = polygonBounds(polys[i]);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
    }
    return -1;
  }

  function bindEvents() {
    canvas.addEventListener('pointerdown', (e) => {
      const i = panelAt(e.clientX, e.clientY);
      if (i < 0) return;
      state.selected = i;
      const panel = state.panels[i];
      drag = { x: e.clientX, y: e.clientY, ox: panel.ox, oy: panel.oy, moved: false, before: snapshotState(state) };
      canvas.classList.add('dragging');
      canvas.setPointerCapture(e.pointerId);
      refreshPanelControls();
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const r = canvas.getBoundingClientRect();
      const panel = state.panels[state.selected];
      const box = polygonBounds(panelPolygons(state.layout)[state.selected]);
      const dx = ((e.clientX - drag.x) / r.width) / box.w;
      const dy = ((e.clientY - drag.y) / r.height) / box.h;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
      panel.ox = drag.ox + dx;
      panel.oy = drag.oy + dy;
      render();
    });
    const endDrag = () => {
      if (drag && drag.moved) history.pushRaw(drag.before);
      drag = null;
      canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    $('photoInput').addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      history.push();
      files.forEach((f) => {
        const url = URL.createObjectURL(f);
        const img = new Image();
        img.onload = () => addPhoto(img, f.name);
        img.onerror = () => setStatus(`Could not read ${f.name} — try another image file.`);
        img.src = url;
      });
      e.target.value = '';
      setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added — click a panel, drag to pan.`);
    });

    $('panelPhoto').addEventListener('change', (e) => {
      history.push();
      state.panels[state.selected].photo = Number(e.target.value) || 0;
      refreshPanelControls(); render();
    });
    $('zoomSlider').addEventListener('input', (e) => {
      state.panels[state.selected].zoom = Number(e.target.value) / 100;
      $('zoomVal').textContent = state.panels[state.selected].zoom.toFixed(1) + '×';
      render();
    });
    $('zoomSlider').addEventListener('pointerdown', () => { zoomBefore = snapshotState(state); });
    $('zoomSlider').addEventListener('change', () => { if (zoomBefore) history.pushRaw(zoomBefore); zoomBefore = null; });
    $('fitBtn').addEventListener('click', () => {
      history.push();
      const p = state.panels[state.selected];
      p.zoom = 1; p.ox = 0; p.oy = 0;
      refreshPanelControls(); render();
    });
    $('centerBtn').addEventListener('click', () => {
      history.push();
      const p = state.panels[state.selected];
      p.ox = 0; p.oy = 0;
      refreshPanelControls(); render();
    });
    $('swapBtn').addEventListener('click', () => {
      if (photos.length < 2) { setStatus('Add a second photo to swap between photos.'); return; }
      history.push();
      const p = state.panels[state.selected];
      p.photo = (p.photo + 1) % photos.length;
      refreshPanelControls(); render();
    });

    const bindText = (id, key) => {
      $(id).addEventListener('input', (e) => { state[key] = e.target.value; render(); });
      $(id).addEventListener('change', () => history.push());
    };
    bindText('titleInput', 'title');
    bindText('subtitleInput', 'subtitle');
    bindText('taglineInput', 'tagline');
    $('grainToggle').addEventListener('change', (e) => { history.push(); state.grain = e.target.checked; render(); });
    $('vignetteToggle').addEventListener('change', (e) => { history.push(); state.vignette = e.target.checked; render(); });

    $('undoBtn').addEventListener('click', () => {
      if (history.undo()) { syncInputs(); render(); }
    });
    $('redoBtn').addEventListener('click', () => {
      if (history.redo()) { syncInputs(); render(); }
    });

    $('exportBtn').addEventListener('click', () => {
      const size = SIZES[state.sizeKey] || SIZES.wide;
      const off = document.createElement('canvas');
      off.width = size.w; off.height = size.h;
      renderCover(off, state, photos);
      off.toBlob((blob) => {
        if (!blob) { setStatus('Export failed in this browser — try again.'); return; }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sunset-strip-${size.w}x${size.h}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setStatus(`Exported PNG ${size.w} × ${size.h}.`);
      }, 'image/png');
    });
  }

  function syncInputs() {
    $('titleInput').value = state.title;
    $('subtitleInput').value = state.subtitle;
    $('taglineInput').value = state.tagline;
    $('grainToggle').checked = state.grain;
    $('vignetteToggle').checked = state.vignette;
    $('sizeNote').textContent = `${SIZES[state.sizeKey].w} × ${SIZES[state.sizeKey].h}`;
    refreshPickers();
    refreshPanelControls();
  }

  return {
    photos,
    start() {
      bindEvents();
      refreshPickers();
      syncInputs();
      // Sample photos ship with the app; one photo fills all four panels.
      loadSample('./samples/boulevard.jpg', 'boulevard', 0);
      loadSample('./samples/pier.jpg', 'pier', 1);
      renderWhenFontsReady();
    },
    render,
  };
}
