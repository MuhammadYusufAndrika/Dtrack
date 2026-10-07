import { useEffect, useMemo, useRef, useState } from 'react';

export function useCountUp(target, duration = 900) {
    const isNum = typeof target === 'string' && /^\d+$/.test(String(target).trim());
    const to = isNum ? parseInt(target, 10) : 0;
    const [val, setVal] = useState(isNum ? 0 : null);
    const rafRef = useRef(null);

    useEffect(() => {
        if (!isNum) { setVal(null); return; }
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { setVal(to); return; }
        const start = performance.now();
        const tick = (now) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setVal(Math.round(to * eased));
            if (p < 1) rafRef.current = requestAnimationFrame(tick);
        };
        setVal(0);
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [to, isNum, duration]);

    return isNum ? (val ?? 0) : null;
}

/* ---------------- Area / line chart (SVG, animated draw) ---------------- */

function buildPath(pts) {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
}

export function AreaChart({ data, color = '#2563eb', height = 200, formatValue, renderTooltip }) {
    const [active, setActive] = useState(null);
    const n = data.length;
    const max = Math.max(...data.map((d) => d.value), 0);

    const { pts, line, area } = useMemo(() => {
        const W = 640, H = 200, top = 16, bottom = 12;
        const usable = H - top - bottom;
        const points = data.map((d, i) => ({
            x: ((i + 0.5) / n) * W,
            y: max > 0 ? top + (1 - d.value / max) * usable : H - bottom,
        }));
        const l = buildPath(points);
        const a = points.length
            ? `${l} L ${points[points.length - 1].x} ${H} L ${points[0].x} ${H} Z`
            : '';
        return { pts: points, line: l, area: a };
    }, [data, max, n]);

    if (n === 0 || max === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-10 px-4" style={{ height }}>
                <div className="w-10 h-10 rounded-xl bg-dark-100 flex items-center justify-center mb-2.5">
                    <svg className="w-5 h-5 text-dark-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m7 14 4-4 4 3 5-6" /></svg>
                </div>
                <p className="text-sm font-semibold text-dark-500">Belum ada aktivitas</p>
                <p className="text-xs text-dark-400 mt-0.5">Trip akan muncul di grafik ini setelah dimulai.</p>
            </div>
        );
    }

    const activePt = active != null ? pts[active] : null;
    const tooltipLeft = active != null ? Math.min(Math.max(((active + 0.5) / n) * 100, 10), 90) : 0;
    const tooltipTop = activePt ? (activePt.y / 200) * 100 : 0;

    return (
        <div className="relative select-none" style={{ height }} onMouseLeave={() => setActive(null)}>
            <svg viewBox="0 0 640 200" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id={`areaFill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                </defs>
                <g className="chart-grid">
                    {[0.25, 0.5, 0.75].map((f) => (
                        <line key={f} x1="0" x2="640" y1={16 + f * 172} y2={16 + f * 172} stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
                    ))}
                </g>
                <path d={area} fill={`url(#areaFill-${color.replace('#', '')})`} className="chart-area" />
                <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" vectorEffect="non-scaling-stroke" className="chart-line" />
                {pts.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill="#fff"
                        stroke={color}
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        className="chart-dot"
                        style={{ animationDelay: `${0.25 + (i / n) * 1.3}s` }}
                    />
                ))}
            </svg>

            {/* hover columns */}
            <div className="absolute inset-0 flex">
                {data.map((d, i) => (
                    <div key={i} className="flex-1 cursor-default" onMouseEnter={() => setActive(i)} />
                ))}
            </div>

            {active != null && (
                <div
                    className="absolute z-10 pointer-events-none glass-strong rounded-xl px-3 py-2 whitespace-nowrap"
                    style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%`, transform: 'translate(-50%, calc(-100% - 12px))', animation: 'fade-in .15s ease both' }}
                >
                    <p className="text-[10px] font-bold uppercase tracking-wider text-dark-400">{data[active].label}</p>
                    <p className="font-display text-sm font-bold text-dark-900">
                        {formatValue ? formatValue(data[active]) : data[active].value}
                    </p>
                    {renderTooltip && <p className="text-[11px] text-dark-500">{renderTooltip(data[active])}</p>}
                </div>
            )}

            {/* x labels */}
            <div className="absolute left-0 right-0 flex" style={{ bottom: -22 }}>
                {data.map((d, i) => (
                    <span key={i} className={`flex-1 text-center text-[10px] font-semibold uppercase tracking-wide ${i === active ? 'text-dark-900' : 'text-dark-400'}`}>
                        {d.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

/* ---------------- Donut chart ---------------- */

export function DonutChart({ segments, total, unit = '', size = 172, strokeWidth = 20 }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const t = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(t);
    }, []);

    const r = (size - strokeWidth) / 2;
    const C = 2 * Math.PI * r;
    const sum = segments.reduce((s, x) => s + x.value, 0) || 1;
    const centerCount = useCountUp(String(total ?? sum));

    let acc = 0;
    const arcs = segments.map((s, i) => {
        const frac = s.value / sum;
        const arc = { ...s, dash: frac * C, offset: -acc * C, i };
        acc += frac;
        return arc;
    });

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: size, height: size }}>
                <svg width={size} height={size} className="-rotate-90">
                    <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8edf4" strokeWidth={strokeWidth} />
                    {arcs.map((a) => (
                        <circle
                            key={a.label}
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            fill="none"
                            stroke={a.color}
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            strokeDasharray={mounted ? `${Math.max(a.dash - 3, 0)} ${C}` : `0 ${C}`}
                            strokeDashoffset={a.offset}
                            className="donut-seg"
                            style={{ transitionDelay: `${a.i * 0.12}s` }}
                        />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="font-display text-3xl font-bold text-dark-900 leading-none">{centerCount ?? total}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-dark-400 mt-1">{unit}</p>
                </div>
            </div>
            <div className="w-full space-y-2">
                {segments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-dark-500 flex-1 truncate">{s.label}</span>
                        <span className="font-display font-bold text-dark-900">{s.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ---------------- Horizontal bar list ---------------- */

export function BarList({ items }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        const t = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(t);
    }, []);

    const max = Math.max(...items.map((i) => i.value), 1);

    if (!items.length) {
        return <p className="text-sm text-dark-400 py-6 text-center">Belum ada data.</p>;
    }

    return (
        <div className="space-y-3.5">
            {items.map((it, i) => (
                <div key={it.label}>
                    <div className="flex items-baseline justify-between mb-1.5 gap-2">
                        <span className="text-xs font-semibold text-dark-500 truncate">{it.label}</span>
                        <span className="font-display text-sm font-bold text-dark-900 tabular-nums">
                            {it.value}
                            {it.suffix && <span className="text-[11px] font-medium text-dark-400 ml-0.5">{it.suffix}</span>}
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-dark-100 overflow-hidden">
                        <div
                            className="h-full rounded-full bar-fill"
                            style={{
                                width: mounted ? `${Math.max((it.value / max) * 100, 2)}%` : '0%',
                                background: `linear-gradient(90deg, ${it.color}, ${it.color}cc)`,
                                transitionDelay: `${i * 0.08}s`,
                            }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}
