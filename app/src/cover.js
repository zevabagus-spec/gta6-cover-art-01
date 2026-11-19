// Neon Coast cover engine: draws a multi-panel GTA-poster-style cover on a
// 2D canvas. Everything here is original work for this entry. No Rockstar
// logo, artwork or font is used anywhere: the lettering is Anton and Pacifico,
// both SIL OFL fonts shipped under app/fonts/.

/** The seven panel layouts the editor offers, keyed by id. */
export const LAYOUTS = {
  nine: { name: 'Nine Panel', panels: 9 },
  hero3: { name: 'Hero + Three', panels: 4 },
  four: { name: 'Four Panel', panels: 4 },
  tilt: { name: 'Tilted Snapshots', panels: 3 },
  bleed: { name: 'Full Bleed', panels: 1 },
  duo: { name: 'Split Duo', panels: 2 },
  strip: { name: 'Story Strip', panels: 4 },
};

/** The six colour grades: a canvas photo filter plus overlay wash colours. */
export const GRADES = {
  sunset: { name: 'Vice Sunset', filter: 'saturate(1.35) contrast(1.08)', top: '#ff7a18', mid: '#ff2d78', bottom: '#7b2ff7' },
  neon: { name: 'Neon Nights', filter: 'saturate(1.55) contrast(1.12)', top: '#ff2ea6', mid: '#7b2ff7', bottom: '#00e5ff' },
  golden: { name: 'Golden Hour', filter: 'sepia(0.35) saturate(1.45) contrast(1.05)', top: '#ffd319', mid: '#ff9a3d', bottom: '#c94b2d' },
  noir: { name: 'Teal Noir', filter: 'grayscale(0.85) contrast(1.25) brightness(1.05)', top: '#9be8ff', mid: '#2b6f7e', bottom: '#0b1c26' },
  pink: { name: 'Hot Pink', filter: 'hue-rotate(-18deg) saturate(1.6) contrast(1.08)', top: '#ff5da2', mid: '#ff2e88', bottom: '#a3136b' },
  mono: { name: 'Mono Chrome', filter: 'grayscale(1) contrast(1.18)', top: '#f2f2f2', mid: '#9a9a9a', bottom: '#222222' },
};

/** The three export sizes, keyed by id. */
export const SIZES = {
  square: { name: 'Square 1080 x 1080', w: 1080, h: 1080 },
  portrait: { name: 'Portrait 1080 x 1350', w: 1080, h: 1350 },
  wide: { name: 'Wide 1920 x 1080', w: 1920, h: 1080 },
};

/** Returns the photo-area rects for a layout, in canvas pixels. */
export function layoutPanels(layout, w, h, titleH) {
  const area = { x: 0, y: 0, w, h: h - titleH };
  const gap = Math.max(4, Math.round(w * 0.006));
  const grid = (cols, rows, x, y, gw, gh) => {
    const out = [];
    const cw = (gw - gap * (cols - 1)) / cols;
    const ch = (gh - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        out.push({ x: x + c * (cw + gap), y: y + r * (ch + gap), w: cw, h: ch, rot: 0 });
      }
    }
    return out;
  };
  switch (layout) {
    case 'nine': return grid(3, 3, area.x, area.y, area.w, area.h);
    case 'hero3': {
      const heroW = area.w * 0.62 - gap / 2;
      const sideW = area.w * 0.38 - gap / 2;
      const side = grid(1, 3, area.w - sideW, area.y, sideW, area.h);
      return [{ x: area.x, y: area.y, w: heroW, h: area.h, rot: 0 }, ...side];
    }
    case 'four': return grid(2, 2, area.x, area.y, area.w, area.h);
    case 'duo': return grid(2, 1, area.x, area.y, area.w, area.h);
    case 'strip': return grid(4, 1, area.x, area.y, area.w, area.h);
    case 'bleed': return [{ x: 0, y: 0, w, h, rot: 0 }];
    case 'tilt': {
      const pw = area.w * 0.44;
      const ph = area.h * 0.72;
      const cy = area.y + (area.h - ph) / 2;
      return [
        { x: area.w * 0.03, y: cy + area.h * 0.05, w: pw, h: ph, rot: -0.07 },
        { x: area.w * 0.28, y: cy - area.h * 0.04, w: pw, h: ph, rot: 0.02 },
        { x: area.w * 0.53, y: cy + area.h * 0.03, w: pw, h: ph, rot: 0.06 },
      ];
    }
    default: return grid(2, 2, area.x, area.y, area.w, area.h);
  }
}

/** Draws one photo cover-fit into a rect, with zoom and pan offsets. */
export function drawPhotoInPanel(ctx, img, rect, zoom, ox, oy) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const scale = Math.max(rect.w / iw, rect.h / ih) * (zoom || 1);
  const pw = iw * scale;
  const ph = ih * scale;
  const cx = rect.x + rect.w / 2 + (ox || 0) * rect.w * 0.25;
  const cy = rect.y + rect.h / 2 + (oy || 0) * rect.h * 0.25;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
}

/** Paints a grade's overlay washes over one panel rect. */
export function applyGradeWash(ctx, rect, grade) {
  const g = GRADES[grade] || GRADES.sunset;
  const wash = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  wash.addColorStop(0, g.top);
  wash.addColorStop(0.55, g.mid);
  wash.addColorStop(1, g.bottom);
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.28;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  const shade = ctx.createLinearGradient(0, rect.y + rect.h * 0.55, 0, rect.y + rect.h);
  shade.addColorStop(0, 'rgba(20, 4, 40, 0)');
  shade.addColorStop(1, 'rgba(20, 4, 40, 0.38)');
  ctx.fillStyle = shade;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** A cached film-grain tile, generated once per page load. */
let grainTile = null;
export function getGrainTile() {
  if (grainTile) return grainTile;
  grainTile = document.createElement('canvas');
  grainTile.width = 180;
  grainTile.height = 180;
  const g = grainTile.getContext('2d');
  const data = g.createImageData(180, 180);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = 118 + Math.floor(Math.random() * 40) - 20;
    data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  return grainTile;
}

/** Draws film grain and a vignette over the whole canvas. */
export function applyGrainAndVignette(ctx, w, h, grain, vignette) {
  if (grain) {
    const tile = getGrainTile();
    const pattern = ctx.createPattern(tile, 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  if (vignette) {
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(10, 2, 24, 0.42)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }
}

/** Fits a string to a width by shrinking the font, returns the size used. */
export function fitTitleFont(ctx, text, maxWidth, startSize, family, weight) {
  let size = startSize;
  const set = () => { ctx.font = `${weight} ${size}px ${family}`; };
  set();
  while (size > 14 && ctx.measureText(text).width > maxWidth) {
    size = Math.max(14, size - 2);
    set();
  }
  return size;
}

/** Draws the halftone dot rows along the top of the title band. */
export function drawHalftoneBand(ctx, x, y, w, grade) {
  const g = GRADES[grade] || GRADES.sunset;
  const cols = Math.floor(w / 26);
  for (let row = 0; row < 3; row++) {
    const r = 7 - row * 2;
    const yy = y + 10 + row * 13;
    for (let c = 0; c < cols; c++) {
      const xx = x + 13 + c * 26 + (row % 2 ? 13 : 0);
      if (xx > x + w - 8) continue;
      ctx.fillStyle = row === 0 ? g.top : row === 1 ? g.mid : g.bottom;
      ctx.globalAlpha = 0.85 - row * 0.22;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Draws the title block: halftone band, gradient title, neon script subtitle. */
export function drawTitleBlock(ctx, w, h, titleH, state) {
  const y0 = h - titleH;
  const band = ctx.createLinearGradient(0, y0, 0, h);
  band.addColorStop(0, '#241040');
  band.addColorStop(1, '#0d0518');
  ctx.fillStyle = band;
  ctx.fillRect(0, y0, w, titleH);
  drawHalftoneBand(ctx, 0, y0, w, state.grade);
  const title = (state.title || 'NEON COAST').trim().toUpperCase() || 'NEON COAST';
  const base = Math.min(w * 0.115, titleH * 0.52) * (state.titleScale || 1);
  const size = fitTitleFont(ctx, title, w * 0.92, base, 'Anton, "Arial Black", sans-serif', '400');
  const grad = ctx.createLinearGradient(0, y0 + titleH * 0.28, 0, y0 + titleH * 0.82);
  grad.addColorStop(0, '#ffd319');
  grad.addColorStop(0.5, '#ff2975');
  grad.addColorStop(1, '#8c1eff');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try { ctx.letterSpacing = `${Math.round(size * 0.03)}px`; } catch { /* older canvas */ }
  ctx.lineWidth = Math.max(2, size * 0.06);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeText(title, w / 2, y0 + titleH * 0.58);
  ctx.fillStyle = grad;
  ctx.fillText(title, w / 2, y0 + titleH * 0.58);
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  const sub = (state.subtitle || '').trim();
  if (sub) {
    const subSize = Math.max(18, titleH * 0.2);
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#ff7ad9';
    ctx.shadowColor = '#ff2ea6';
    ctx.shadowBlur = subSize * 0.55;
    ctx.fillText(sub, w / 2, y0 + titleH * 0.2);
    ctx.shadowBlur = 0;
  }
}

/** Draws the heat badge ribbon and star meter in the photo area's top corner. */
export function drawHeatBadge(ctx, w, titleH, state) {
  const heat = Math.max(0, Math.min(5, state.heat || 0));
  const label = `HEAT ${'★'.repeat(heat)}${'☆'.repeat(5 - heat)}`;
  const size = Math.max(16, Math.round(w * 0.022));
  ctx.save();
  ctx.font = `bold ${size}px Anton, "Arial Black", sans-serif`;
  const tw = ctx.measureText(label).width + size * 1.6;
  const th = size * 1.9;
  const x = w - tw - w * 0.02;
  const y = w * 0.02;
  ctx.translate(x + tw / 2, y + th / 2);
  ctx.rotate(-0.03);
  ctx.fillStyle = '#ffd319';
  ctx.strokeStyle = '#1d0b2e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -th / 2, tw, th, th / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#1d0b2e';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

/** Draws the whole cover onto `canvas` from photos and state. */
export function drawCoverArt(canvas, photos, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const g = GRADES[state.grade] || GRADES.sunset;
  const titleH = state.layout === 'bleed' ? Math.round(h * 0.2) : Math.round(h * 0.21);
  ctx.clearRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, w, h);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.55, '#7b2ff7');
  sky.addColorStop(1, '#ff2d78');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const rects = layoutPanels(state.layout, w, h, state.layout === 'bleed' ? 0 : titleH);
  const gap = Math.max(4, Math.round(w * 0.006));
  rects.forEach((rect, i) => {
    const slot = state.panels[i] || { photo: 0, zoom: 1, ox: 0, oy: 0 };
    const img = photos.length ? photos[(slot.photo ?? 0) % photos.length] : null;
    if (rect.rot) {
      ctx.save();
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2 + w * 0.012);
      ctx.rotate(rect.rot);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h);
      ctx.restore();
    }
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    } else {
      ctx.translate(rect.x, rect.y);
    }
    const local = { x: 0, y: 0, w: rect.w, h: rect.h };
    ctx.beginPath();
    ctx.rect(0, 0, rect.w, rect.h);
    ctx.clip();
    if (img) {
      ctx.filter = g.filter;
      drawPhotoInPanel(ctx, img, local, slot.zoom, slot.ox, slot.oy);
      ctx.filter = 'none';
      applyGradeWash(ctx, local, state.grade);
    } else {
      const ph = ctx.createLinearGradient(0, 0, rect.w, rect.h);
      ph.addColorStop(0, g.top);
      ph.addColorStop(1, g.bottom);
      ctx.fillStyle = ph;
      ctx.fillRect(0, 0, rect.w, rect.h);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = `bold ${Math.round(rect.w * 0.06)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('ADD A PHOTO', rect.w / 2, rect.h / 2);
    }
    ctx.restore();
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.rot);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    } else {
      ctx.translate(rect.x, rect.y);
    }
    ctx.lineWidth = state.layout === 'tilt' ? Math.max(6, w * 0.008) : Math.max(2, gap * 0.5);
    ctx.strokeStyle = state.layout === 'tilt' ? '#ffffff' : 'rgba(255,255,255,0.9)';
    ctx.strokeRect(0, 0, rect.w, rect.h);
    ctx.restore();
  });
  if (state.layout === 'bleed') {
    const scrim = ctx.createLinearGradient(0, h - titleH * 1.6, 0, h);
    scrim.addColorStop(0, 'rgba(13,5,24,0)');
    scrim.addColorStop(1, 'rgba(13,5,24,0.82)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, h - titleH * 1.6, w, titleH * 1.6);
    drawTitleBlock(ctx, w, h, titleH, state);
  } else {
    drawTitleBlock(ctx, w, h, titleH, state);
  }
  if (state.heat > 0) drawHeatBadge(ctx, w, titleH, state);
  if (state.frame) {
    ctx.lineWidth = Math.max(6, Math.round(w * 0.01));
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
  }
  applyGrainAndVignette(ctx, w, h, state.grain !== false, state.vignette !== false);
}

/** Renders a cover at an exact size into a fresh canvas and returns it. */
export function renderCoverToCanvas(photos, state, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  drawCoverArt(canvas, photos, state);
  return canvas;
}
