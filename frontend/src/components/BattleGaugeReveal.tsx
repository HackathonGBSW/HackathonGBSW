import { useEffect, useState, type CSSProperties } from "react";
import {
  BATTLE_SCORE_KEYS,
  type BattleScores,
} from "../lib/api";
import "./charts.css";

type Row = {
  key: (typeof BATTLE_SCORE_KEYS)[number]["key"];
  label: string;
  left: number;
  right: number;
};

type Props = {
  leftName: string;
  rightName: string;
  leftScores: BattleScores;
  rightScores: BattleScores;
  /** Called once every row has finished its settle animation. */
  onComplete?: () => void;
};

const SWING_MS = 1100;
const REVEAL_STEP_MS = SWING_MS + 420;

function settlePercent(left: number, right: number) {
  // Battle item scores are 0–10. Map difference to 8%…92% of the track.
  const diff = Math.max(-10, Math.min(10, left - right));
  return 50 - (diff / 10) * 42;
}

function GaugeRow({ row, active }: { row: Row; active: boolean }) {
  const [phase, setPhase] = useState<"idle" | "swing" | "settled">("idle");
  const target = settlePercent(row.left, row.right);
  const lean =
    row.left === row.right ? "tie" : row.left > row.right ? "left" : "right";

  useEffect(() => {
    if (!active) return;
    setPhase("swing");
    const t = window.setTimeout(() => setPhase("settled"), SWING_MS);
    return () => window.clearTimeout(t);
  }, [active]);

  if (!active && phase === "idle") {
    return (
      <div className="battle-gauge__row is-hidden" aria-hidden>
        <p className="battle-gauge__item">{row.label}</p>
        <div className="battle-gauge__track" />
      </div>
    );
  }

  const needleStyle =
    phase === "settled"
      ? ({ "--needle-x": `${target}%` } as CSSProperties)
      : undefined;

  return (
    <div
      className={`battle-gauge__row is-in ${phase === "settled" ? `is-${lean}` : ""}`}
    >
      <div className="battle-gauge__item-row">
        <p className="battle-gauge__item">{row.label}</p>
        <p className="battle-gauge__nums num">
          <span>{row.left}</span>
          <span className="battle-gauge__sep">:</span>
          <span>{row.right}</span>
        </p>
      </div>
      <div className="battle-gauge__track" role="img" aria-label={`${row.label} 비교`}>
        <span
          className={`battle-gauge__needle ${phase === "swing" ? "is-swing" : "is-settle"}`}
          style={needleStyle}
        />
      </div>
    </div>
  );
}

/**
 * Duel reveal: usernames on both sides, center needle swings then settles
 * left/right per item, revealing from top to bottom.
 */
export function BattleGaugeReveal({
  leftName,
  rightName,
  leftScores,
  rightScores,
  onComplete,
}: Props) {
  const rows: Row[] = BATTLE_SCORE_KEYS.map((item) => ({
    key: item.key,
    label: item.label,
    left: leftScores?.[item.key] ?? 0,
    right: rightScores?.[item.key] ?? 0,
  }));

  const [visibleCount, setVisibleCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visibleCount >= rows.length) return;
    const t = window.setTimeout(
      () => setVisibleCount((n) => n + 1),
      visibleCount === 0 ? 280 : REVEAL_STEP_MS,
    );
    return () => window.clearTimeout(t);
  }, [visibleCount, rows.length]);

  useEffect(() => {
    if (done || visibleCount < rows.length) return;
    const t = window.setTimeout(() => {
      setDone(true);
      onComplete?.();
    }, SWING_MS + 200);
    return () => window.clearTimeout(t);
  }, [visibleCount, rows.length, done, onComplete]);

  return (
    <div className="battle-gauge">
      <header className="battle-gauge__heads">
        <div className="battle-gauge__side is-left">
          <span className="battle-gauge__tag">YOU</span>
          <strong>{leftName}</strong>
        </div>
        <span className="battle-gauge__vs">VS</span>
        <div className="battle-gauge__side is-right">
          <span className="battle-gauge__tag">FOE</span>
          <strong>{rightName}</strong>
        </div>
      </header>

      <div className="battle-gauge__list">
        {rows.map((row, i) => (
          <GaugeRow key={row.key} row={row} active={i < visibleCount} />
        ))}
      </div>

      {!done ? (
        <p className="battle-gauge__hint t-cap">항목을 하나씩 공개하는 중…</p>
      ) : (
        <p className="battle-gauge__hint t-cap">결과 공개</p>
      )}
    </div>
  );
}
