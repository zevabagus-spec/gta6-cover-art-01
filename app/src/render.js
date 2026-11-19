// render.js — draws the whole cover onto a canvas: panels, grades, lettering, grain.
// Pure canvas 2D; the same function paints the live preview and the exported PNG.
import { panelPolygons, polygonBounds } from './layouts.js';

const TITLE_GRADIENT = ['#ffb347', '#ff7a3d', '#ff4d8d', '#b04dff', '#7b2ff7'];

// Grade overlays: [gradient stops, blend mode, strength]. Drawn over each panel.
const GRADES = {
  sunset: { stops: ['rgba(255,122,26,0.30)', 'rgba(255,77,141,0.22)', 'rgba(123,47,247,0.28)'], mode: 'soft-light' },
  neon: { stops: ['rgba(255,0,128,0.34)', 'rgba(0,229,255,0.18)', 'rgba(255,0,128,0.30)'], mode: 'overlay' },
  teal: { stops: ['rgba(0,200,190,0.28)', 'rgba(255,196,77,0.16)', 'rgba(0,80,120,0.30)'], mode: 'soft-light' },
  rose: { stops: ['rgba(255,170,150,0.30)', 'rgba(255,120,160,0.22)', 'rgba(180,90,120,0.26)'], mode: 'soft-light' },
  mono: { stops: ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.18)', 'rgba(255,255,255,0.08)'], mode: 'overlay' },
};

let grainTile = null;
function getGrainTile() {
  if (grainTile) return grainTile;
  const t = document.createElement('canvas');
  t.width = 128; t.height = 128;
  const c = t.getContext('2d');
  const img = c.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  grainTile = t;
  return t;
}

function pathPolygon(ctx, poly, W, H) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => {
    const px = x * W, py = y * H;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
}

// Cover-fit draw of one photo inside a polygon's bounding box, with zoom + pan.
// Offsets are clamped so the photo always covers the whole box.
function drawPhotoInBox(ctx, img, box, panel, W, H) {
  const bw = box.w * W, bh = box.h * H, bx = box.x * W, by = box.y * H;
  const base = Math.max(bw / img.naturalWidth, bh / img.naturalHeight);
  const scale = base * Math.max(1, panel.zoom || 1);
  const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  const maxOx = Math.max(0, (dw - bw) / 2), maxOy = Math.max(0, (dh - bh) / 2);
  const ox = Math.max(-maxOx, Math.min(maxOx, (panel.ox || 0) * bw));
  const oy = Math.max(-maxOy, Math.min(maxOy, (panel.oy || 0) * bh));
  ctx.drawImage(img, bx + (bw - dw) / 2 + ox, by + (bh - dh) / 2 + oy, dw, dh);
}

function placeholderGradient(ctx, box, W, H, seed) {
  const g = ctx.createLinearGradient(box.x * W, box.y * H, (box.x + box.w) * W, (box.y + box.h) * H);
  const hues = [[255, 122, 61], [255, 77, 141], [123, 47, 247], [55, 224, 216]];
  const a = hues[seed % hues.length], b = hues[(seed + 1) % hues.length];
  g.addColorStop(0, `rgb(${a[0]},${a[1]},${a[2]})`);
  g.addColorStop(1, `rgb(${b[0]},${b[1]},${b[2]})`);
  ctx.fillStyle = g;
  ctx.fillRect(box.x * W, box.y * H, box.w * W, box.h * H);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `700 ${Math.round(box.h * H * 0.16)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ADD PHOTO', (box.x + box.w / 2) * W, (box.y + box.h / 2) * H);
}

function applyGrade(ctx, box, grade, W, H) {
  const def = GRADES[grade] || GRADES.sunset;
  const g = ctx.createLinearGradient(box.x * W, box.y * H, (box.x + box.w) * W, (box.y + box.h) * H);
  g.addColorStop(0, def.stops[0]);
  g.addColorStop(0.5, def.stops[1]);
  g.addColorStop(1, def.stops[2]);
  ctx.save();
  ctx.globalCompositeOperation = def.mode;
  ctx.fillStyle = g;
  ctx.fillRect(box.x * W, box.y * H, box.w * W, box.h * H);
  ctx.restore();
  if (grade === 'mono') {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'rgba(128,128,128,1)';
    ctx.fillRect(box.x * W, box.y * H, box.w * W, box.h * H);
    ctx.restore();
  }
}

function drawTitleBand(ctx, state, W, H) {
  const bandH = H * 0.26;
  const bandY = H - bandH;
  // Dark scrim so the lettering pops over any photo.
  const scrim = ctx.createLinearGradient(0, bandY - H * 0.08, 0, H);
  scrim.addColorStop(0, 'rgba(10,4,20,0)');
  scrim.addColorStop(0.35, 'rgba(10,4,20,0.72)');
  scrim.addColorStop(1, 'rgba(10,4,20,0.92)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, bandY - H * 0.08, W, bandH + H * 0.08);

  const title = (state.title || 'SUNSET STRIP').toUpperCase();
  const cx = W / 2;
  // Fit the title to 92% of the width, shrinking the font until it fits.
  let size = H * 0.135;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const measure = (s) => { ctx.font = `${s}px Anton, "Arial Black", sans-serif`; return ctx.measureText(title).width; };
  while (size > H * 0.04 && measure(size) > W * 0.92) size *= 0.94;
  const titleY = bandY + bandH * 0.52;
  const grad = ctx.createLinearGradient(cx - measure(size) / 2, 0, cx + measure(size) / 2, 0);
  TITLE_GRADIENT.forEach((c, i) => grad.addColorStop(i / (TITLE_GRADIENT.length - 1), c));
  ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(16,6,28,0.95)';
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeText(title, cx, titleY);
  ctx.fillStyle = grad;
  ctx.fillText(title, cx, titleY);

  // Neon script subtitle, glowing.
  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(H * 0.028, size * 0.32);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.shadowColor = '#ff4dd2'; ctx.shadowBlur = subSize * 0.55;
    ctx.fillStyle = '#ffe9f7';
    ctx.fillText(sub, cx, titleY + subSize * 1.25);
    ctx.shadowBlur = 0;
  }

  // Tagline, small caps with wide tracking, gold.
  const tag = (state.tagline || '').trim();
  if (tag) {
    const tagSize = Math.max(10, H * 0.018);
    ctx.font = `700 ${tagSize}px system-ui, sans-serif`;
    ctx.fillStyle = '#ffc44d';
    const spaced = tag.split('').join('\u2009');
    ctx.fillText(spaced, cx, H - H * 0.028);
  }
}

// Main entry: paint the cover for `state` onto `canvas` at its own pixel size.
export function renderCover(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  // White page: the gaps between panels are the bold white slashes.
  ctx.save();
  ctx.fillStyle = '#fdf7f2';
  ctx.fillRect(0, 0, W, H);

  const polys = panelPolygons(state.layout);
  const count = state.layout === 'full' ? 1 : 4;
  for (let i = 0; i < count; i++) {
    const poly = polys[i];
    const box = polygonBounds(poly);
    ctx.save();
    pathPolygon(ctx, poly, W, H);
    ctx.clip();
    const panel = state.panels[i] || { photo: 0, zoom: 1.15, ox: 0, oy: 0 };
    // A panel naming a photo that is not loaded yet falls back to the first photo,
    // so one photo still fills all four panels instead of showing a placeholder.
    const img = photos[panel.photo] || photos[0];
    if (img && img.complete && img.naturalWidth > 0) {
      drawPhotoInBox(ctx, img, box, panel, W, H);
    } else {
      placeholderGradient(ctx, box, W, H, i);
    }
    applyGrade(ctx, box, state.grade, W, H);
    ctx.restore();
    // Crisp white edge around every panel.
    ctx.save();
    pathPolygon(ctx, poly, W, H);
    ctx.strokeStyle = '#fdf7f2';
    ctx.lineWidth = Math.max(2, W * 0.004);
    ctx.stroke();
    ctx.restore();
  }

  drawTitleBand(ctx, state, W, H);

  // Thin white poster frame around the whole cover.
  ctx.save();
  ctx.strokeStyle = '#fdf7f2';
  ctx.lineWidth = Math.max(3, W * 0.006);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
  ctx.restore();

  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.10;
    ctx.globalCompositeOperation = 'overlay';
    const tile = getGrainTile();
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(10,2,18,0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
