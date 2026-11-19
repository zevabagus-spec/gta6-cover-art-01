// layouts.js — the four panel geometries, in unit coordinates (0..1 of the cover).
// Every panel is a polygon (array of [x, y] points). The white page shows through the
// gaps between polygons, so the diagonal layout gets bold white slashes for free.
export function panelPolygons(layout, panelCount = 4) {
  if (layout === 'grid') {
    const g = 0.012; // white gutter
    return [
      [[g, g], [0.5 - g, g], [0.5 - g, 0.5 - g], [g, 0.5 - g]],
      [[0.5 + g, g], [1 - g, g], [1 - g, 0.5 - g], [0.5 + g, 0.5 - g]],
      [[g, 0.5 + g], [0.5 - g, 0.5 + g], [0.5 - g, 1 - g], [g, 1 - g]],
      [[0.5 + g, 0.5 + g], [1 - g, 0.5 + g], [1 - g, 1 - g], [0.5 + g, 1 - g]],
    ];
  }
  if (layout === 'hero3') {
    const g = 0.012;
    const heroH = 0.62;
    const third = 1 / 3;
    return [
      [[g, g], [1 - g, g], [1 - g, heroH - g], [g, heroH - g]],
      [[g, heroH + g], [third - g, heroH + g], [third - g, 1 - g], [g, 1 - g]],
      [[third + g, heroH + g], [2 * third - g, heroH + g], [2 * third - g, 1 - g], [third + g, 1 - g]],
      [[2 * third + g, heroH + g], [1 - g, heroH + g], [1 - g, 1 - g], [2 * third + g, 1 - g]],
    ];
  }
  if (layout === 'full') {
    return [[ [0, 0], [1, 0], [1, 1], [0, 1] ]];
  }
  // 'diagonal' (default): one large hero parallelogram on the left, three stacked
  // parallelograms on the right. Their left edges all lean the same way, so the
  // white gaps between them read as bold diagonal slashes.
  const slant = 0.09; // how far a left edge leans from top to bottom of the cover
  const heroTop = 0.63;
  const heroBot = heroTop - slant;
  const sideTop = 0.675;
  const sideBot = sideTop - slant;
  const y1 = 0.315;
  const y2 = 0.665;
  const leftAt = (y) => sideTop - slant * y; // left edge of the right column at height y
  return [
    [[0, 0], [heroTop, 0], [heroBot, 1], [0, 1]],
    [[leftAt(0) + 0.035, 0], [1, 0], [1, y1], [leftAt(y1) + 0.035, y1]],
    [[leftAt(y1) + 0.035, y1 + 0.02], [1, y1 + 0.02], [1, y2], [leftAt(y2) + 0.035, y2]],
    [[leftAt(y2) + 0.035, y2 + 0.02], [1, y2 + 0.02], [1, 1], [leftAt(1) + 0.035, 1]],
  ].slice(0, panelCount);
}

// Bounding box of a polygon, in unit coordinates.
export function polygonBounds(poly) {
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
  for (const [x, y] of poly) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
