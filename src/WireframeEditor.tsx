import React, { useEffect, useRef, useState } from 'react';
import * as pc from 'polygon-clipping';
import {
    createWallRectangle,
    edgesOf,
    nearestPointOnSegment,
    pickVertex,
    pickWall,
    Point,
    polygonTranslate,
    snapToGrid
} from './geometry';

type ArchitecturalPlan = {
    walls: Array<{ boundary: Array<Point> }>;
    doors: Array<{ boundary: Array<Point> }>;
    windows: Array<{ boundary: Array<Point> }>;
    rooms: Array<{ name: string; type: string; boundary: Array<Point> }>;
    dimensions: { width: number; height: number };
};

type Tool = 'select' | 'draw' | 'delete' | 'stretch' | 'move' | 'extend';

export function WireframeEditor({
    plan,
    onChange,
    size, // overlay pixel size { width, height }
}: {
    plan: ArchitecturalPlan;
    onChange: (p: ArchitecturalPlan) => void;
    size: { width: number; height: number };
}) {
    const svgRef = useRef<SVGSVGElement | null>(null);

    const [tool, setTool] = useState<Tool>('select');
    const [wallThickness, setWallThickness] = useState<number>(20);
    const [snap, setSnap] = useState<boolean>(true);

    const [hover, setHover] = useState<{ wall: number; vertex?: number } | null>(null);
    const [selection, setSelection] = useState<{ wall: number; vertex?: number } | null>(null);

    const [drag, setDrag] = useState<{
        kind: 'move-wall' | 'move-vertex' | 'draw';
        startPt: Point;
        currPt?: Point;            // live mouse point for draw preview
        startWall?: number;
        vertex?: number;
    } | null>(null);

    const [extendStart, setExtendStart] = useState<{ wall: number; vertex: number } | null>(null);

    // ---- Screen -> SVG coordinate conversion (GUARDED) ----
    function clientToSvgPoint(evt: React.MouseEvent | MouseEvent): Point {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };

        const ctm = svg.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 }; // prevents occasional null CTM crash

        const pt = svg.createSVGPoint();
        const e = evt as MouseEvent;
        pt.x = typeof e.clientX === 'number' ? e.clientX : 0;
        pt.y = typeof e.clientY === 'number' ? e.clientY : 0;

        const sp = pt.matrixTransform(ctm.inverse());
        return { x: sp.x, y: sp.y };
    }

    function commit(next: ArchitecturalPlan) {
        onChange(next);
    }

    function handleMouseMove(e: React.MouseEvent) {
        const p = clientToSvgPoint(e);

        // Keep live draw preview updated
        if (drag?.kind === 'draw') {
            setDrag({ ...drag, currPt: p });
        }

        // Dragging a wall or a vertex
        if (drag) {
            if (drag.kind === 'move-wall' && selection?.wall != null) {
                const d = { x: p.x - drag.startPt.x, y: p.y - drag.startPt.y };
                const moved = plan.walls.map((w, i) => {
                    if (i !== selection.wall) return w;
                    return { boundary: polygonTranslate(w.boundary, snap ? snapToGrid(d, 1) : d) };
                });
                commit({ ...plan, walls: moved });
                setDrag({ ...drag, startPt: p });
            } else if (drag.kind === 'move-vertex' && selection?.wall != null && drag.vertex != null) {
                const d = { x: p.x, y: p.y };
                const walls = plan.walls.map((w, i) => {
                    if (i !== selection.wall) return w;
                    const nb = w.boundary.slice();
                    nb[drag.vertex!] = snap ? snapToGrid(d) : d;
                    return { boundary: nb };
                });
                commit({ ...plan, walls });
            }
            return;
        }

        // Hover logic (only when not dragging)
        const wallIndex = pickWall(plan.walls.map(w => w.boundary), p, 8);
        if (wallIndex >= 0) {
            if (tool === 'stretch') {
                const v = pickVertex(plan.walls[wallIndex].boundary, p, 8);
                setHover({ wall: wallIndex, vertex: v >= 0 ? v : undefined });
            } else {
                setHover({ wall: wallIndex });
            }
        } else {
            setHover(null);
        }
    }

    function handleMouseDown(e: React.MouseEvent) {
        const p = clientToSvgPoint(e);

        if (tool === 'select') {
            const wi = pickWall(plan.walls.map(w => w.boundary), p, 8);
            if (wi >= 0) {
                setSelection({ wall: wi });
                setDrag({ kind: 'move-wall', startPt: p, startWall: wi });
            } else {
                setSelection(null);
            }
            return;
        }

        if (tool === 'delete') {
            const wi = pickWall(plan.walls.map(w => w.boundary), p, 8);
            if (wi >= 0) {
                const walls = plan.walls.slice();
                walls.splice(wi, 1);
                commit({ ...plan, walls });
            }
            return;
        }

        if (tool === 'stretch') {
            const wi = pickWall(plan.walls.map(w => w.boundary), p, 8);
            if (wi >= 0) {
                const vi = pickVertex(plan.walls[wi].boundary, p, 8);
                if (vi >= 0) {
                    setSelection({ wall: wi, vertex: vi });
                    setDrag({ kind: 'move-vertex', startPt: p, startWall: wi, vertex: vi });
                }
            }
            return;
        }

        if (tool === 'draw') {
            setDrag({ kind: 'draw', startPt: p, currPt: p });
            return;
        }

        if (tool === 'extend') {
            if (!extendStart) {
                const wi = pickWall(plan.walls.map(w => w.boundary), p, 8);
                if (wi >= 0) {
                    const vi = pickVertex(plan.walls[wi].boundary, p, 8);
                    if (vi >= 0) setExtendStart({ wall: wi, vertex: vi });
                }
            } else {
                // second click: target edge on another wall
                const targetWall = pickWall(plan.walls.map(w => w.boundary), p, 8);
                if (targetWall >= 0) {
                    const src = extendStart;
                    const srcPt = plan.walls[src.wall].boundary[src.vertex];

                    // find closest edge on target wall
                    const edges = edgesOf(plan.walls[targetWall].boundary);
                    let bestEdgeIdx = 0,
                        bestD = Infinity,
                        bestQ: Point = p;
                    for (let i = 0; i < edges.length; i++) {
                        const [a, b] = edges[i];
                        const { q } = nearestPointOnSegment(srcPt, a, b);
                        const d2 = (q.x - srcPt.x) ** 2 + (q.y - srcPt.y) ** 2;
                        if (d2 < bestD) {
                            bestD = d2;
                            bestEdgeIdx = i;
                            bestQ = q;
                        }
                    }

                    // project vertex to that edge point
                    const walls = plan.walls.map((w, wi) => {
                        if (wi !== src.wall) return w;
                        const nb = w.boundary.slice();
                        nb[src.vertex] = snap ? snapToGrid(bestQ) : bestQ;
                        return { boundary: nb };
                    });
                    commit({ ...plan, walls });
                }
                setExtendStart(null);
            }
        }
    }

    function handleMouseUp(e: React.MouseEvent) {
        const p = clientToSvgPoint(e);

        if (drag?.kind === 'draw') {
            const end = drag.currPt ?? p;
            const rect = createWallRectangle(drag.startPt, end, wallThickness);
            const walls = plan.walls.concat([{ boundary: rect }]);
            commit({ ...plan, walls });
        }

        setDrag(null);
    }

    // keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'v' || e.key === 'V') setTool('select');
            if (e.key === 'd' || e.key === 'D') setTool('draw');
            if (e.key === 'x' || e.key === 'X' || e.key === 'Delete') setTool('delete');
            if (e.key === 's' || e.key === 'S') setTool('stretch');
            if (e.key === 'm' || e.key === 'M') setTool('move');     // reserved if you add a pure move mode later
            if (e.key === 't' || e.key === 'T') setTool('extend');
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    return (
        <div
            className="wf-editor"
            style={{
                position: 'absolute',
                width: `${size.width}px`,
                height: `${size.height}px`,
                pointerEvents: 'auto'
            }}
        >
            {/* Toolbar */}
            <div className="wf-toolbar">
                <button className={`wf-btn ${tool === 'select' ? 'active' : ''}`} onClick={() => setTool('select')} title="Select/Move (V)">
                    Select
                </button>
                <button className={`wf-btn ${tool === 'draw' ? 'active' : ''}`} onClick={() => setTool('draw')} title="Draw Wall (D)">
                    Draw
                </button>
                <button className={`wf-btn ${tool === 'stretch' ? 'active' : ''}`} onClick={() => setTool('stretch')} title="Stretch Vertex (S)">
                    Stretch
                </button>
                <button className={`wf-btn ${tool === 'extend' ? 'active' : ''}`} onClick={() => setTool('extend')} title="Extend/Trim to Edge (T)">
                    Extend
                </button>
                <button className={`wf-btn ${tool === 'delete' ? 'active' : ''}`} onClick={() => setTool('delete')} title="Delete Wall (Del/X)">
                    Delete
                </button>
                <div className="wf-sep" />
                <label className="wf-label">
                    Thickness
                    <input
                        type="range"
                        min={4}
                        max={100}
                        value={wallThickness}
                        onChange={(e) => setWallThickness(parseInt(e.target.value, 10))}
                    />
                    <span className="wf-val">{wallThickness}</span>
                </label>
                <label className="wf-label">
                    <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap
                </label>
            </div>

            {/* SVG interactive layer */}
            <svg
                ref={svgRef}
                width="100%"
                height="100%"
                viewBox={`0 0 ${plan.dimensions.width} ${plan.dimensions.height}`}
                preserveAspectRatio="none"
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                style={{
                    touchAction: 'none',
                    cursor: tool === 'draw' ? 'crosshair' : tool === 'delete' ? 'not-allowed' : 'default'
                }}
            >
                {/* Walls */}
                {plan.walls.map((w, i) => (
                    <g
                        key={i}
                        className={`wf-wall ${hover?.wall === i ? 'hover' : ''} ${selection?.wall === i ? 'selected' : ''}`}
                    >
                        <polygon
                            points={w.boundary.map((p) => `${p.x},${p.y}`).join(' ')}
                            className="wall-shape"
                            vectorEffect="non-scaling-stroke"
                        />
                        {/* Vertex handles (stretch tool) */}
                        {tool === 'stretch' &&
                            w.boundary.map((p, vi) => (
                                <circle
                                    key={vi}
                                    cx={p.x}
                                    cy={p.y}
                                    r={6}
                                    className={`wf-handle ${hover?.wall === i && hover?.vertex === vi ? 'hover' : ''}`}
                                />
                            ))}
                    </g>
                ))}

                {/* Windows/Doors (read-only in this version) */}
                {plan.windows.map((wd, i) => (
                    <polyline
                        key={`win-${i}`}
                        points={wd.boundary.map((p) => `${p.x},${p.y}`).join(' ')}
                        className="window-shape"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}
                {plan.doors.map((dr, i) => (
                    <polyline
                        key={`door-${i}`}
                        points={dr.boundary.map((p) => `${p.x},${p.y}`).join(' ')}
                        className="door-shape"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}

                {/* Draw preview */}
                {drag?.kind === 'draw' && (
                    <polygon
                        className="wf-preview"
                        points={createWallRectangle(
                            drag.startPt,
                            drag.currPt ?? drag.startPt,
                            wallThickness
                        )
                            .map((p) => `${p.x},${p.y}`)
                            .join(' ')}
                    />
                )}
            </svg>
        </div>
    );
}