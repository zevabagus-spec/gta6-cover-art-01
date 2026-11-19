// Neon Coast — Cover Studio renderer: one draw path for the live preview, the
// PNG export and the ?shot= screenshots, so what you see is what you share.
// Everything is drawn on a 2D canvas: panels, grades, halftone title band.

import { LAYOUTS, GRADES, EXPORT_SIZES } from './studio-state.js';

/** Small deterministic generator, so the grain looks the same on every draw. */
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Draw `img` into `rect` with cover-fit, then zoom around the centre and pan.
 *  Pan is clamped so the photo always covers the whole panel. */
export function drawPhotoPanel(ctx, img, rect, crop) {
  const { x, y, w, h } = rect;
  if (!img) {
    drawPlaceholderPanel(ctx, rect);
    return;
  }
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const base = Math.max(w / iw, h / ih);
  const scale = base * (crop.zoom || 1);
  const pw = iw * scale;
  const ph = ih * scale;
  const slackX = Math.max(0, (pw - w) / 2);
  const slackY = Math.max(0, (ph - h) / 2);
  const dx = x + (w - pw) / 2 - clamp(crop.panX || 0, -1, 1) * slackX;
  const dy = y + (h - ph) / 2 - clamp(crop.panY || 0, -1, 1) * slackY;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, pw, ph);
  ctx.restore();
}

/** Stand-in for an empty panel: sunset sky, a sun, and a little skyline. */
export function drawPlaceholderPanel(ctx, rect) {
  const { x, y, w, h } = rect;
  const sky = ctx.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, '#3a1c5e');
  sky.addColorStop(0.55, '#c94b7a');
  sky.addColorStop(1, '#ff9a3d');
  ctx.fillStyle = sky;
  ctx.fillRect(x, y, w, h);
  const sunR = Math.min(w, h) * 0.22;
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.42, sunR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(30, 8, 40, 0.85)';
  const base = y + h;
  const bars = [0.62, 0.45, 0.72, 0.52, 0.66, 0.4];
  bars.forEach((bh, i) => {
    const bw = w / bars.length;
    ctx.fillRect(x + i * bw, base - h * bh, bw * 0.82, h * bh);
  });
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = `600 ${Math.max(12, Math.round(h * 0.07))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('ADD A PHOTO', x + w / 2, y + h * 0.3);
}

/** Rows of halftone dots whose size swells and shrinks across the band. */
export function drawHalftoneDots(ctx, x, y, w, h, colour) {
  const step = Math.max(10, Math.round(h * 0.16));
  ctx.fillStyle = colour;
  for (let row = 0; row * step < h; row += 1) {
    for (let col = 0; col * step < w; col += 1) {
      const cx = x + col * step + (row % 2 ? step / 2 : 0);
      const cy = y + row * step + step / 2;
      const swell = 0.5 + 0.5 * Math.sin((cx / w) * Math.PI * 2.2 + row * 0.7);
      const r = step * (0.1 + 0.26 * swell);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function fitTitleSize(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `${size}px Anton, sans-serif`;
  while (size > 18 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = `${size}px Anton, sans-serif`;
  }
  return size;
}

/** The title band: halftone strip, gradient Anton title, Pacifico subtitle. */
export function drawTitleBand(ctx, W, H, state, grade) {
  const layout = LAYOUTS[state.layout];
  const bandH = H * layout.titleH;
  const bandY = H - bandH;
  const grad = ctx.createLinearGradient(0, bandY, 0, H);
  grad.addColorStop(0, grade.sky[0]);
  grad.addColorStop(1, '#12081e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY, W, bandH);
  drawHalftoneDots(ctx, 0, bandY, W, bandH * 0.2, 'rgba(255, 255, 255, 0.14)');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(W * 0.04, bandY + bandH * 0.2, W * 0.92, Math.max(2, H * 0.004));

  const title = (state.title || 'NEON COAST').toUpperCase();
  const titleSize = fitTitleSize(ctx, title, W * 0.92, Math.round(bandH * 0.52));
  const ink = ctx.createLinearGradient(0, bandY + bandH * 0.22, 0, bandY + bandH * 0.72);
  ink.addColorStop(0, grade.titleTop);
  ink.addColorStop(1, grade.titleBottom);
  ctx.font = `${titleSize}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, titleSize * 0.06);
  ctx.strokeStyle = 'rgba(20, 6, 30, 0.9)';
  const titleY = bandY + bandH * 0.5;
  ctx.strokeText(title, W / 2, titleY);
  ctx.fillStyle = ink;
  ctx.fillText(title, W / 2, titleY);

  const sub = (state.subtitle || '').trim();
  if (sub) {
    // Pacifico's swashes and descenders run deep, so the subtitle sits
    // higher and smaller than the tagline's band, with a clear gap.
    const subSize = Math.round(bandH * 0.15);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ffe9f2';
    ctx.fillText(sub, W / 2, bandY + bandH * 0.79);
  }
  const tag = (state.tagline || '').trim();
  if (tag) {
    const tagSize = Math.max(10, Math.round(bandH * 0.09));
    ctx.font = `700 ${tagSize}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    const spaced = tag.toUpperCase().split('').join(' ');
    // Alphabetic baseline, a few pixels clear of the frame stroke so the
    // tagline can never collide with the script subtitle above it or the
    // white border drawn around the cover after this band.
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(spaced, W / 2, bandY + bandH * 0.95);
    ctx.textBaseline = 'middle';
  }
  ctx.textBaseline = 'alphabetic';
}

/** Speckled grain + a soft vignette, identical on every render. */
export function drawGrainAndVignette(ctx, W, H) {
  const rand = seededRandom(20261119);
  ctx.save();
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < Math.round((W * H) / 9000); i += 1) {
    const shade = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(rand() * W, rand() * H, 1.6, 1.6);
  }
  ctx.restore();
  const vig = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(10, 4, 18, 0.42)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/** The whole cover: sky, panels, grade washes, title band, grain. This is the
 *  one function the preview, the export and the screenshots all call. The
 *  teal selection outline is a preview-only aid: exports and screenshots
 *  render through renderCoverTo, which hides it, so a shared PNG never shows
 *  the editor's selection box. */
export function drawCoverArt(ctx, W, H, state, images, { showSelection = true } = {}) {
  const grade = GRADES[state.grade] || GRADES.viceSunset;
  const layout = LAYOUTS[state.layout] || LAYOUTS.marquee;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  grade.sky.forEach((stop, i) => sky.addColorStop(i / (grade.sky.length - 1), stop));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const gutter = Math.round(Math.min(W, H) * 0.008);
  layout.slots.forEach((slot, i) => {
    const rect = {
      x: slot.x * W + gutter / 2,
      y: slot.y * H + gutter / 2,
      w: slot.w * W - gutter,
      h: slot.h * H - gutter,
    };
    const crop = state.panels[i] || { photo: 0, zoom: 1, panX: 0, panY: 0 };
    const img = images[crop.photo] || null;
    drawPhotoPanel(ctx, img, rect, crop);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = Math.max(2, Math.min(W, H) * 0.004);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    if (showSelection && state.selected === i) {
      ctx.strokeStyle = '#2ee6c8';
      ctx.lineWidth = Math.max(3, Math.min(W, H) * 0.006);
      ctx.strokeRect(rect.x - 2, rect.y - 2, rect.w + 4, rect.h + 4);
    }
  });

  ctx.fillStyle = grade.warm;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = grade.cool;
  ctx.fillRect(0, 0, W, H);
  drawTitleBand(ctx, W, H, state, grade);
  drawGrainAndVignette(ctx, W, H);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = Math.max(3, Math.min(W, H) * 0.006);
  ctx.strokeRect(
    Math.max(2, Math.min(W, H) * 0.006),
    Math.max(2, Math.min(W, H) * 0.006),
    W - Math.max(4, Math.min(W, H) * 0.012),
    H - Math.max(4, Math.min(W, H) * 0.012),
  );
}

/** Render the current state onto `canvas` at one of the export sizes, with
 *  the editor's selection outline hidden, exactly as Export PNG does. */
export function renderCoverTo(canvas, sizeKey, state, images) {
  const size = EXPORT_SIZES[sizeKey] || EXPORT_SIZES['1080x1080'];
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d');
  drawCoverArt(ctx, size.w, size.h, state, images, { showSelection: false });
  return size;
}
