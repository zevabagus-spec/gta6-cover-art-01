// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded; ?shot=cover shows the cover alone at its export size. Query params:
// layout, grade, size, title, subtitle, photo, photo2, heat.
// window.__shotReady is set once the cover is painted with fonts loaded.

/** Waits until the display fonts are ready, then flags the shot done. */
export async function markShotReady() {
  try {
    await Promise.all([
      document.fonts.load('80px Anton'),
      document.fonts.load('40px Pacifico'),
    ]);
    await document.fonts.ready;
  } catch { /* fall back to system fonts */ }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}

/** Sets up a fixed scene; `api` is the editor hooks object from main.js. */
export async function runShot(shot, query, api) {
  const state = api.state;
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('size')) state.size = query.get('size');
  if (query.get('title')) {
    state.title = query.get('title');
    const caption = document.getElementById('caption');
    if (caption) caption.value = state.title;
  }
  if (query.get('subtitle') !== null) {
    state.subtitle = query.get('subtitle') || '';
    const subtitle = document.getElementById('subtitle');
    if (subtitle) subtitle.value = state.subtitle;
  }
  if (query.get('heat') !== null) state.heat = Number(query.get('heat') || 0);
  document.querySelectorAll('#layouts button').forEach((b) => b.classList.toggle('active', b.dataset.layout === state.layout));
  document.querySelectorAll('#grades button').forEach((b) => b.classList.toggle('active', b.dataset.grade === state.grade));
  document.querySelectorAll('#sizes button').forEach((b) => b.classList.toggle('active', b.dataset.size === state.size));
  const first = query.get('photo') || 'boulevard';
  const second = query.get('photo2') || 'pier';
  const loaded = [];
  for (const name of [first, second]) {
    try { loaded.push(await api.loadImage(`samples/${name}.jpg`)); } catch { /* sample missing */ }
  }
  if (loaded.length) {
    api.setPhotos(loaded);
    state.panels.forEach((slot, i) => { slot.photo = i % loaded.length; });
    state.panels[0].photo = 0;
  }
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const zoom = document.getElementById('zoom');
  const panx = document.getElementById('panx');
  const pany = document.getElementById('pany');
  if (zoom) zoom.value = String(state.panels[state.selected].zoom || 1);
  if (panx) panx.value = String(state.panels[state.selected].ox || 0);
  if (pany) pany.value = String(state.panels[state.selected].oy || 0);
  api.redraw();
  await markShotReady();
  api.redraw();
  await markShotReady();
}
