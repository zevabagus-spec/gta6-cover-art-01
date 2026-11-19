// Neon Coast — Cover Studio screenshot scenes: ?shot=cover draws the finished
// cover full-frame, ?shot=editor shows the workbench with a sample photo
// loaded. Both go through the same draw path as Export, and both set
// window.__shotReady once the fonts, the photo and the paint are done.

import { renderCoverTo } from './render.js';

function fontReady() {
  return Promise.all([
    document.fonts.load('90px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.ready,
  ]).catch(() => undefined);
}

function paintTwice() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

/** Run one scene. `studio` is the object initStudio returned. */
export async function runScene(scene, query, studio) {
  const caption = query.get('caption') ?? 'Neon Coast';
  const photoName = query.get('photo') ?? 'pier';
  const layout = query.get('layout');
  const grade = query.get('grade');
  const size = query.get('size');

  if (layout) studio.state.layout = layout;
  if (grade) studio.state.grade = grade;
  if (size) studio.state.size = size;
  studio.state.title = caption.toUpperCase();
  studio.state.subtitle = query.get('subtitle') ?? 'chasing the sunset';
  studio.state.tagline = query.get('tagline') ?? 'VICE CITY · EST. 2026';

  const loaded = await studio.loadSample(photoName);
  if (!loaded) {
    // No sample photo: the cover still draws, with sunset placeholders.
    studio.redraw();
  }

  if (scene === 'cover') {
    document.body.classList.add('shot-cover');
    const canvas = document.getElementById('preview');
    renderCoverTo(canvas, studio.state.size, studio.state, studio.images);
  } else {
    studio.redraw();
  }
  await fontReady();
  if (scene === 'cover') {
    const canvas = document.getElementById('preview');
    renderCoverTo(canvas, studio.state.size, studio.state, studio.images);
  } else {
    studio.redraw();
  }
  await paintTwice();
  window.__shotReady = true;
}
