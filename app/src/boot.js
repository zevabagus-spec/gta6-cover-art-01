// boot.js — entry point. Default mode is the editor; ?shot=cover, ?shot=cover-wide
// and ?shot=cover-portrait render a finished cover full-frame for screenshots.
import { defaultState, SIZES } from './state.js';
import { createEditor } from './editor.js';
import { renderCover } from './render.js';

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const state = defaultState();

function renderShot(kind) {
  document.body.classList.add('shot-cover');
  const canvas = document.getElementById('shotCanvas');
  if (kind === 'cover-portrait') {
    state.sizeKey = 'portrait';
    state.layout = 'diagonal';
    state.grade = 'sunset';
  } else if (kind === 'cover-wide') {
    state.sizeKey = 'wide';
    state.layout = 'hero3';
    state.grade = 'neon';
    // The hero strip is short and wide: zoom out and pan up so the face shows.
    state.panels[0].zoom = 1.0;
    state.panels[0].oy = 1.15;
  } else {
    state.sizeKey = 'wide';
    state.layout = 'diagonal';
    state.grade = 'sunset';
  }
  const size = SIZES[state.sizeKey];
  canvas.width = size.w;
  canvas.height = size.h;
  const photos = [];
  const done = { count: 0 };
  const draw = () => { renderCover(canvas, state, photos); };
  const load = (url, index) => {
    const img = new Image();
    img.onload = () => { photos[index] = img; done.count += 1; draw(); };
    img.onerror = () => { done.count += 1; draw(); };
    img.src = url;
  };
  // Wait for the display fonts, then paint; fall back after a short timeout.
  // If the fonts fail to load entirely, the canvas still paints with the fallback.
  const fonts = Promise.all([
    document.fonts.load('100px Anton'),
    document.fonts.load('40px Pacifico'),
  ]).catch(() => undefined);
  const timeout = new Promise((res) => setTimeout(res, 1500));
  Promise.race([fonts, timeout]).then(draw);
  load('./samples/boulevard.jpg', 0);
  load('./samples/pier.jpg', 1);
  draw(); // first paint immediately, re-painted as photos and fonts arrive
}

if (shot === 'cover' || shot === 'cover-wide' || shot === 'cover-portrait') {
  renderShot(shot);
} else {
  createEditor(state).start();
}
