// Cover state for Neon Coast: the defaults, the undo/redo history, and the
// small helpers the editor leans on. State is plain JSON, so one history entry
// is one JSON string. Nothing here touches the network or the disk.

import { LAYOUTS } from './cover.js';

/** Nine panel slots — the biggest layout uses all nine. */
export function defaultPanels() {
  return Array.from({ length: 9 }, () => ({ photo: 0, zoom: 1, ox: 0, oy: 0 }));
}

/** The state a fresh visitor starts with. */
export function defaultState() {
  return {
    layout: 'nine',
    grade: 'sunset',
    size: 'wide',
    title: 'NEON COAST',
    subtitle: 'Sunset Heist',
    titleScale: 1,
    heat: 4,
    frame: true,
    grain: true,
    vignette: true,
    selected: 0,
    panels: defaultPanels(),
  };
}

/** Deep-copies a state object through JSON (safe: state holds only numbers,
strings, booleans and plain slot objects). */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/** How many panels the current layout actually shows. */
export function panelCount(state) {
  return (LAYOUTS[state.layout] || LAYOUTS.nine).panels;
}

/** Keeps the selection, heat and title scale inside their legal ranges. */
export function clampSelection(state) {
  state.selected = Math.max(0, Math.min(panelCount(state) - 1, state.selected || 0));
  state.heat = Math.max(0, Math.min(5, state.heat || 0));
  state.titleScale = Math.max(0.7, Math.min(1.3, state.titleScale || 1));
  return state;
}

/** A small undo/redo history over JSON snapshots of the state. */
export class CoverHistory {
  constructor(initial) {
    this.past = [];
    this.future = [];
    this.present = JSON.stringify(initial);
  }

  /** Records a new state after a committed change. */
  push(state) {
    const snap = JSON.stringify(state);
    if (snap === this.present) return;
    this.past.push(this.present);
    if (this.past.length > 60) this.past.shift();
    this.present = snap;
    this.future = [];
  }

  /** Steps back one change, returning the state or null. */
  undo() {
    if (!this.past.length) return null;
    this.future.push(this.present);
    this.present = this.past.pop();
    return JSON.parse(this.present);
  }

  /** Steps forward one change, returning the state or null. */
  redo() {
    if (!this.future.length) return null;
    this.past.push(this.present);
    this.present = this.future.pop();
    return JSON.parse(this.present);
  }

  canUndo() { return this.past.length > 0; }
  canRedo() { return this.future.length > 0; }
}
