
// geometry.ts - lightweight geometry helpers for wall editing

export type Point = { x: number; y: number };
export type Polygon = Point[];

export const dist2 = (a: Point, b: Point) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx*dx + dy*dy;
};

export const dist = (a: Point, b: Point) => Math.sqrt(dist2(a,b));

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point) => a.x*b.x + a.y*b.y;
export const perp = (v: Point): Point => ({ x: -v.y, y: v.x });

export function polygonTranslate(poly: Polygon, d: Point): Polygon {
  return poly.map(p => add(p, d));
}

export function pointInPolygon(pt: Point, poly: Polygon): boolean {
  // ray cast
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function nearestPointOnSegment(p: Point, a: Point, b: Point): { q: Point, t: number } {
  const ab = sub(b, a);
  const len2 = dot(ab, ab) || 1e-12;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2));
  const q = add(a, mul(ab, t));
  return { q, t };
}

export function segmentIntersection(a1: Point, a2: Point, b1: Point, b2: Point): { hit: boolean, p?: Point, ta?: number, tb?: number } {
  // line-line intersection parameterized; clamp later if needed
  const r = sub(a2, a1);
  const s = sub(b2, b1);
  const rxs = r.x * s.y - r.y * s.x;
  const qpxr = (b1.x - a1.x) * r.y - (b1.y - a1.y) * r.x;
  if (Math.abs(rxs) < 1e-12 && Math.abs(qpxr) < 1e-12) return { hit: false }; // colinear
  if (Math.abs(rxs) < 1e-12) return { hit: false }; // parallel
  const t = ((b1.x - a1.x) * s.y - (b1.y - a1.y) * s.x) / rxs;
  const u = ((b1.x - a1.x) * r.y - (b1.y - a1.y) * r.x) / rxs;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { hit: true, p: add(a1, mul(r, t)), ta: t, tb: u };
  }
  return { hit: false };
}

export function createWallRectangle(p1: Point, p2: Point, thickness: number): Polygon {
  // rectangle centered on segment p1->p2 with width = thickness
  const dir = sub(p2, p1);
  const len = Math.sqrt(dir.x*dir.x + dir.y*dir.y) || 1e-9;
  const n = { x: -dir.y/len, y: dir.x/len }; // unit normal
  const off = { x: n.x * (thickness/2), y: n.y * (thickness/2) };
  return [
    add(p1, off),
    sub(p1, off),
    sub(p2, off),
    add(p2, off),
  ];
}

export function snapToGrid(p: Point, grid = 5): Point {
  return { x: Math.round(p.x / grid) * grid, y: Math.round(p.y / grid) * grid };
}

export function edgesOf(poly: Polygon): Array<[Point, Point]> {
  const edges: Array<[Point, Point]> = [];
  for (let i = 0; i < poly.length; i++) {
    edges.push([poly[i], poly[(i+1) % poly.length]]);
  }
  return edges;
}

// Find closest wall index to a point within pixel->svg tolerance
export function pickWall(polys: Polygon[], pt: Point, tol = 8): number {
  // inside polygon wins; else nearest edge within tol
  let best = -1;
  let bestDist2 = Infinity;
  for (let i = 0; i < polys.length; i++) {
    const poly = polys[i];
    if (pointInPolygon(pt, poly)) return i;
    // edge distance
    for (const [a,b] of edgesOf(poly)) {
      const { q } = nearestPointOnSegment(pt, a, b);
      const d2 = dist2(pt, q);
      if (d2 < bestDist2) {
        bestDist2 = d2;
        best = i;
      }
    }
  }
  const tol2 = tol * tol;
  return bestDist2 <= tol2 ? best : -1;
}

export function pickVertex(poly: Polygon, pt: Point, tol = 8): number {
  let best = -1, bestD2 = Infinity;
  for (let i=0;i<poly.length;i++) {
    const d2 = dist2(poly[i], pt);
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return bestD2 <= tol*tol ? best : -1;
}
