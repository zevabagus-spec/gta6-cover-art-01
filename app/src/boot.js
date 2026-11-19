// Neon Coast — Cover Studio entry point: build the editor, then either run a
// ?shot= scene for screenshots or settle into the interactive workbench.

import { initStudio } from './editor.js';
import { runScene } from './scenes.js';

const canvas = document.getElementById('preview');
const studio = initStudio(canvas);
window.__studio = studio;
// False until a ?shot= scene (or the first font-ready redraw) finishes, so
// screenshot tooling can tell "not ready yet" apart from "ready".
window.__shotReady = false;

const query = new URLSearchParams(location.search);
const scene = query.get('shot');
if (scene) {
  runScene(scene, query, studio).catch(() => {
    window.__shotReady = true;
  });
} else {
  document.fonts.load('90px Anton').catch(() => undefined);
  document.fonts.load('40px Pacifico').catch(() => undefined);
  document.fonts.ready.then(() => studio.redraw()).catch(() => undefined);
}
