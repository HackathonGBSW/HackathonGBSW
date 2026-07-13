import { SCORE_ITEMS, type PortfolioScores } from "../lib/api";
import "./charts.css";

type Axis = {
  key: (typeof SCORE_ITEMS)[number]["key"];
  label: string;
  max: number;
};

const AXES: Axis[] = SCORE_ITEMS.map((s) => ({
  key: s.key,
  label: s.label,
  max: s.max,
}));

function polar(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/** Regular heptagon points; angleOffset puts first vertex at top. */
function heptagonPoints(
  cx: number,
  cy: number,
  r: number,
  angleOffset = -Math.PI / 2,
) {
  return AXES.map((_, i) => {
    const a = angleOffset + (i * 2 * Math.PI) / AXES.length;
    return polar(cx, cy, r, a);
  });
}

function toPolygon(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

type Props = {
  scores: PortfolioScores;
  size?: number;
  className?: string;
};

/**
 * 7-axis radar (heptagon) for portfolio analysis scores.
 * Each axis is normalized by its own max (30/10/15/5/5/15/20).
 */
export function ScoreRadar({ scores, size = 320, className = "" }: Props) {
  const pad = 52;
  const cx = size / 2;
  const cy = size / 2;
  const rMax = size / 2 - pad;
  const rings = [0.25, 0.5, 0.75, 1];

  const valuePoints = AXES.map((axis, i) => {
    const raw = scores[axis.key] ?? 0;
    const t = Math.max(0, Math.min(1, raw / axis.max));
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
    return polar(cx, cy, rMax * t, a);
  });

  const labelPoints = AXES.map((axis, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
    const p = polar(cx, cy, rMax + 28, a);
    return { ...p, ...axis, a };
  });

  return (
    <div className={`score-radar ${className}`.trim()}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        role="img"
        aria-label="항목별 점수 7각형 차트"
      >
        {rings.map((t) => (
          <polygon
            key={t}
            className="score-radar__ring"
            points={toPolygon(heptagonPoints(cx, cy, rMax * t))}
          />
        ))}

        {AXES.map((_, i) => {
          const tip = heptagonPoints(cx, cy, rMax)[i];
          return (
            <line
              key={i}
              className="score-radar__axis"
              x1={cx}
              y1={cy}
              x2={tip.x}
              y2={tip.y}
            />
          );
        })}

        <polygon
          className="score-radar__fill"
          points={toPolygon(valuePoints)}
        />
        <polygon
          className="score-radar__stroke"
          points={toPolygon(valuePoints)}
        />

        {valuePoints.map((p, i) => (
          <circle key={i} className="score-radar__dot" cx={p.x} cy={p.y} r={3.5} />
        ))}

        {labelPoints.map((p) => {
          const anchor =
            Math.abs(Math.cos(p.a)) < 0.2
              ? "middle"
              : Math.cos(p.a) > 0
                ? "start"
                : "end";
          return (
            <text
              key={p.key}
              className="score-radar__label"
              x={p.x}
              y={p.y}
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              <tspan x={p.x} dy="-0.35em">
                {p.label}
              </tspan>
              <tspan className="score-radar__label-score" x={p.x} dy="1.25em">
                {(scores[p.key] ?? 0).toFixed(1)}/{p.max}
              </tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}
