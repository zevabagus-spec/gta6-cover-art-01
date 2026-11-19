// Neon Coast — Cover Studio state: layouts, colour grades, and the undo/redo
// history. Nothing here touches the DOM; it only describes a cover so the
// renderer (render.js) and the editor (editor.js) can share one shape.

export const EXPORT_SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: '1080 × 1080' },
  '1080x1350': { w: 1080, h: 1350, label: '1080 × 1350' },
  '1920x1080': { w: 1920, h: 1080, label: '1920 × 1080' },
};

// Each layout names its panel slots as fractions of the cover (x, y, w, h).
// The title band always sits at the bottom; `titleH` is its height fraction.
export const LAYOUTS = {
  marquee: {
    name: 'Marquee',
    blurb: 'Hero photo up top, three below',
    titleH: 0.24,
    slots: [
      { x: 0.015, y: 0.015, w: 0.97, h: 0.5 },
      { x: 0.015, y: 0.53, w: 0.3167, h: 0.21 },
      { x: 0.3417, y: 0.53, w: 0.3167, h: 0.21 },
      { x: 0.6683, y: 0.53, w: 0.3167, h: 0.21 },
    ],
  },
  fourSquare: {
    name: 'Four Square',
    blurb: 'Classic 2 × 2 poster grid',
    titleH: 0.24,
    slots: [
      { x: 0.015, y: 0.015, w: 0.48, h: 0.36 },
      { x: 0.505, y: 0.015, w: 0.48, h: 0.36 },
      { x: 0.015, y: 0.385, w: 0.48, h: 0.36 },
      { x: 0.505, y: 0.385, w: 0.48, h: 0.36 },
    ],
  },
  sidekick: {
    name: 'Sidekick',
    blurb: 'Tall hero left, two stacked right',
    titleH: 0.24,
    slots: [
      { x: 0.015, y: 0.015, w: 0.58, h: 0.73 },
      { x: 0.605, y: 0.015, w: 0.38, h: 0.3575 },
      { x: 0.605, y: 0.3875, w: 0.38, h: 0.3575 },
    ],
  },
  tripleLane: {
    name: 'Triple Lane',
    blurb: 'Three vertical film strips',
    titleH: 0.24,
    slots: [
      { x: 0.015, y: 0.015, w: 0.3167, h: 0.73 },
      { x: 0.3417, y: 0.015, w: 0.3167, h: 0.73 },
      { x: 0.6683, y: 0.015, w: 0.3167, h: 0.73 },
    ],
  },
  soloBillboard: {
    name: 'Solo Billboard',
    blurb: 'One full-bleed photo, big type',
    titleH: 0.28,
    slots: [{ x: 0.015, y: 0.015, w: 0.97, h: 0.69 }],
  },
};

// A grade is a sky gradient, a warm wash, a cool wash, and the title ink.
// The renderer layers them so every photo gets the same sunset/neon treatment.
export const GRADES = {
  viceSunset: {
    name: 'Vice Sunset',
    blurb: 'Magenta dusk, orange horizon',
    sky: ['#2a1042', '#7a1e6e', '#e8436b', '#ff8a3d'],
    warm: 'rgba(255, 110, 60, 0.20)',
    cool: 'rgba(120, 40, 180, 0.16)',
    titleTop: '#fff7d6',
    titleBottom: '#ff9a3d',
    swatch: 'linear-gradient(90deg,#2a1042,#e8436b,#ff8a3d)',
  },
  neonVice: {
    name: 'Neon Vice',
    blurb: 'Hot pink against teal night',
    sky: ['#0d1030', '#3a1160', '#d63384', '#2ee6c8'],
    warm: 'rgba(255, 60, 160, 0.20)',
    cool: 'rgba(30, 220, 200, 0.18)',
    titleTop: '#ffffff',
    titleBottom: '#2ee6c8',
    swatch: 'linear-gradient(90deg,#0d1030,#d63384,#2ee6c8)',
  },
  goldenHour: {
    name: 'Golden Hour',
    blurb: 'Amber light, soft violet shade',
    sky: ['#3a1c4d', '#8a3d2e', '#e07b39', '#ffc46b'],
    warm: 'rgba(255, 170, 60, 0.22)',
    cool: 'rgba(90, 50, 140, 0.12)',
    titleTop: '#fffbe8',
    titleBottom: '#ffb347',
    swatch: 'linear-gradient(90deg,#3a1c4d,#e07b39,#ffc46b)',
  },
  midnightNeon: {
    name: 'Midnight Neon',
    blurb: 'Deep blue night, violet glow',
    sky: ['#060a24', '#1b1550', '#5b2a9e', '#ff5e8a'],
    warm: 'rgba(255, 94, 138, 0.16)',
    cool: 'rgba(80, 120, 255, 0.20)',
    titleTop: '#eaf6ff',
    titleBottom: '#b06bff',
    swatch: 'linear-gradient(90deg,#060a24,#5b2a9e,#ff5e8a)',
  },
  palmNoir: {
    name: 'Palm Noir',
    blurb: 'High contrast, warm monochrome',
    sky: ['#14100e', '#3a2a22', '#7a5a44', '#d8b28a'],
    warm: 'rgba(216, 178, 138, 0.18)',
    cool: 'rgba(20, 16, 14, 0.28)',
    titleTop: '#ffffff',
    titleBottom: '#d8b28a',
    swatch: 'linear-gradient(90deg,#14100e,#7a5a44,#d8b28a)',
  },
};

/** A fresh cover state: title, subtitle, tagline, layout, grade, size and one
 *  crop setting per panel slot (photo index, zoom 1–3, pan −1…1). */
export function freshCoverState() {
  return {
    layout: 'marquee',
    grade: 'viceSunset',
    size: '1080x1080',
    title: 'NEON COAST',
    subtitle: 'chasing the sunset',
    tagline: 'VICE CITY · EST. 2026',
    selected: 0,
    panels: panelDefaults('marquee'),
  };
}

export function panelDefaults(layoutKey) {
  return LAYOUTS[layoutKey].slots.map((_, i) => ({
    photo: i % 2 === 0 ? 0 : 1,
    zoom: 1,
    panX: 0,
    panY: 0,
  }));
}

/** Rebuild the panel list when the layout changes, keeping each slot's photo
 *  where a slot with the same index existed before. */
export function remapPanels(oldPanels, layoutKey) {
  return LAYOUTS[layoutKey].slots.map((_, i) => {
    const prior = oldPanels[i];
    return prior
      ? { photo: prior.photo, zoom: prior.zoom, panX: prior.panX, panY: prior.panY }
      : { photo: 0, zoom: 1, panX: 0, panY: 0 };
  });
}

/** The serialisable part of a state (photos are runtime images, not state). */
export function snapshotCover(state) {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    size: state.size,
    title: state.title,
    subtitle: state.subtitle,
    tagline: state.tagline,
    selected: state.selected,
    panels: state.panels,
  });
}

export function restoreCover(state, snapshot) {
  const data = JSON.parse(snapshot);
  // Guard against a stale or hand-edited snapshot: unknown keys fall back to
  // the defaults instead of breaking the renderer, and a panel list that no
  // longer matches its layout is rebuilt from the layout's slots.
  if (!LAYOUTS[data.layout]) data.layout = 'marquee';
  if (!GRADES[data.grade]) data.grade = 'viceSunset';
  if (!EXPORT_SIZES[data.size]) data.size = '1080x1080';
  if (!Array.isArray(data.panels) || data.panels.length !== LAYOUTS[data.layout].slots.length) {
    data.panels = panelDefaults(data.layout);
  }
  data.panels = data.panels.map((p) => ({
    photo: Number.isInteger(p.photo) && p.photo >= -1 && p.photo <= 2 ? p.photo : 0,
    zoom: typeof p.zoom === 'number' ? Math.min(3, Math.max(1, p.zoom)) : 1,
    panX: typeof p.panX === 'number' ? Math.min(1, Math.max(-1, p.panX)) : 0,
    panY: typeof p.panY === 'number' ? Math.min(1, Math.max(-1, p.panY)) : 0,
  }));
  Object.assign(state, data);
}

/** Bounded undo/redo history over snapshots. */
export function makeHistory(limit = 50) {
  const past = [];
  const future = [];
  return {
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    commit(snapshot) {
      past.push(snapshot);
      if (past.length > limit) past.shift();
      future.length = 0;
    },
    undo(current) {
      if (!past.length) return null;
      future.push(current);
      return past.pop();
    },
    redo(current) {
      if (!future.length) return null;
      past.push(current);
      return future.pop();
    },
  };
}
