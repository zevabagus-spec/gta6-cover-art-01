// state.js — the cover's single source of truth, plus undo/redo snapshots.
// Photos live outside the snapshot (they are Image objects); panels store an index.
export const LAYOUTS = ['diagonal', 'grid', 'hero3', 'full'];
export const LAYOUT_LABELS = {
  diagonal: 'Diagonal Strip',
  grid: 'Grid 2x2',
  hero3: 'Hero + 3',
  full: 'Full Bleed',
};
export const GRADES = ['sunset', 'neon', 'teal', 'rose', 'mono'];
export const GRADE_LABELS = {
  sunset: 'Sunset',
  neon: 'Neon Night',
  teal: 'Teal Dawn',
  rose: 'Rose Gold',
  mono: 'Mono Noir',
};
export const SIZES = {
  square: { label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  wide: { label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
};
export const SIZE_KEYS = ['square', 'portrait', 'wide'];

// Default per-panel crops: one photo fills all four panels with different crops;
// when a second photo is loaded the side panels use it for variety.
const DEFAULT_PANELS = [
  { photo: 0, zoom: 1.15, ox: 0, oy: 0.12 },
  { photo: 1, zoom: 1.2, ox: 0.1, oy: -0.05 },
  { photo: 0, zoom: 1.3, ox: -0.18, oy: 0.06 },
  { photo: 1, zoom: 1.2, ox: -0.08, oy: 0.1 },
];

export function defaultState() {
  return {
    layout: 'diagonal',
    grade: 'sunset',
    sizeKey: 'wide',
    title: 'SUNSET STRIP',
    subtitle: 'golden hour run',
    tagline: 'GOLDEN HOUR · EST. 2026',
    grain: true,
    vignette: true,
    selected: 0,
    // One entry per panel: which photo, zoom (1 = fit), pan offsets in panel fractions.
    panels: DEFAULT_PANELS.map((p) => ({ ...p })),
  };
}

export function snapshotState(state) {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    sizeKey: state.sizeKey,
    title: state.title,
    subtitle: state.subtitle,
    tagline: state.tagline,
    grain: state.grain,
    vignette: state.vignette,
    selected: state.selected,
    panels: state.panels,
  });
}

export function restoreState(state, snap) {
  const data = JSON.parse(snap);
  Object.assign(state, data);
  // Guard against stale or invalid keys from an old snapshot.
  if (!LAYOUTS.includes(state.layout)) state.layout = 'diagonal';
  if (!GRADES.includes(state.grade)) state.grade = 'sunset';
  if (!SIZES[state.sizeKey]) state.sizeKey = 'wide';
  if (!Array.isArray(state.panels) || state.panels.length !== 4) {
    state.panels = defaultState().panels;
  }
}

// Undo/redo: stacks of JSON snapshots, capped so memory stays small.
export function makeHistory(state) {
  const undo = [];
  const redo = [];
  return {
    push() {
      undo.push(snapshotState(state));
      if (undo.length > 60) undo.shift();
      redo.length = 0;
    },
    // Push a snapshot taken BEFORE a change (drag, zoom) so undo restores it.
    pushRaw(snap) {
      undo.push(snap);
      if (undo.length > 60) undo.shift();
      redo.length = 0;
    },
    canUndo() { return undo.length > 0; },
    canRedo() { return redo.length > 0; },
    undo() {
      if (!undo.length) return false;
      redo.push(snapshotState(state));
      restoreState(state, undo.pop());
      return true;
    },
    redo() {
      if (!redo.length) return false;
      undo.push(snapshotState(state));
      restoreState(state, redo.pop());
      return true;
    },
  };
}
