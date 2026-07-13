import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar, Button, Input, RankPill } from "../components/ui";
import { DEMO, FIELDS, PORTFOLIO_FIELDS, SCORE_ITEMS, api } from "../lib/api";
import profileAvatar from "../assets/profile-card-avatar.jpg";
import profileBanner from "../assets/profile-card-banner.jpg";
import "./flow.css";

/** 메인(마이페이지): 넓은 프로필 카드 + 스크롤 시 랭크받기/대결하기 반반 */
export function MainPage() {
  const u = DEMO;
  const rankScore = Math.min(100, Math.max(0, u.player_rank_score));
  const battleRate = `${(u.battle_win_rate * 100).toFixed(1)}%`;
  const playerTier = "브론즈 II";
  const nextTier = "브론즈 III";
  const categoryChips = [
    u.main_field ?? FIELDS[0],
    ...FIELDS.filter((field) => field !== u.main_field),
  ].slice(0, 3);
  const profileStats = [
    { label: "사용자 이름", value: u.username },
    { label: "주분야", value: u.main_field ?? "미선택" },
    { label: "플레이어 랭크", value: playerTier },
    {
      label: "대결 승률",
      value: `${battleRate} (${u.wins}승 ${u.losses}패)`,
    },
    { label: "포폴 최고 랭크", value: u.portfolio_best_rank },
    { label: "포폴 평균 랭크", value: u.portfolio_avg_rank },
  ];

  return (
    <div className="flow-main">
      <section className="flow-hero" aria-label="메인 프로필">
        <article className="profile-card">
          <div className="profile-card__banner">
            <img src={profileBanner} alt="" />
            <div className="profile-card__rank">
              <span>PLAYER RANK</span>
              <strong>{playerTier}</strong>
            </div>
          </div>

          <div className="profile-card__body">
            <div className="profile-card__head">
              <div className="profile-card__avatar" aria-hidden>
                <img src={profileAvatar} alt="" />
              </div>

              <div className="profile-card__title">
                <p className="profile-card__eyebrow">MAIN PROFILE</p>
                <h1 className="profile-card__name">{u.username}</h1>
              </div>
            </div>

            <p className="profile-card__intro">{u.bio}</p>

            <div className="profile-card__chips" aria-label="기술 및 직무 카테고리">
              {categoryChips.map((field, index) => (
                <span
                  key={field}
                  className={`profile-card__chip ${
                    field === u.main_field ? "is-primary" : ""
                  }`}
                  data-tone={index % 4}
                >
                  # {field}
                </span>
              ))}
            </div>

            <dl className="profile-card__stats">
              {profileStats.map((item) => (
                <div key={item.label} className="profile-card__stat">
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>

            <div className="profile-card__meta">
              <a
                className="profile-card__github"
                href={u.github_url ?? undefined}
                target="_blank"
                rel="noreferrer"
              >
                @ {u.github_url ?? "GitHub URL을 등록해주세요"}
              </a>

              <div className="profile-card__meter" aria-label="플레이어 랭크 점수">
                <div>
                  <span>{nextTier}까지</span>
                  <strong>{rankScore}/100</strong>
                </div>
                <i>
                  <span style={{ width: `${rankScore}%` }} />
                </i>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="flow-split" aria-label="주요 시스템">
        <Link to="/app/rank" className="flow-split__btn flow-split__btn--rank">
          <span className="flow-split__eyebrow">Rank System</span>
          <span className="flow-split__label">랭크 시스템</span>
          <span className="flow-split__desc">분야 선택부터 GitHub 분석, 피드백, 점수 부여까지</span>
        </Link>
        <Link to="/app/battle" className="flow-split__btn flow-split__btn--battle">
          <span className="flow-split__eyebrow">Battle System</span>
          <span className="flow-split__label">대결 시스템</span>
          <span className="flow-split__desc">비슷한 랭크 매칭과 친구 대결로 포트폴리오 비교</span>
        </Link>
      </section>
    </div>
  );
}

/** 랭크 받기: 분야 선택 + 깃허브 URL + 분석 버튼(우하단) */
export function RankPage() {
  const nav = useNavigate();
  const [field, setField] = useState<(typeof PORTFOLIO_FIELDS)[number]>(
    PORTFOLIO_FIELDS[1],
  );
  const [github, setGithub] = useState("");
  const [error, setError] = useState("");

  function onAnalyze(e: FormEvent) {
    e.preventDefault();
    if (!github.trim()) {
      setError("GitHub URL을 입력하세요.");
      return;
    }
    sessionStorage.setItem(
      "pending-analyze",
      JSON.stringify({ field, github_url: github.trim() }),
    );
    nav("/app/rank/analyzing");
  }

  return (
    <div className="flow-rank">
      <div className="flow-rank__shape">
        <div className="flow-rank__inner">
          <p className="badge">Rank</p>
          <h1 className="t-h1" style={{ marginTop: 12 }}>
            랭크 받기
          </h1>
          <p className="t-body" style={{ marginTop: 8 }}>
            분야를 고르고 GitHub 저장소 링크를 넣어 주세요.
          </p>

          <form className="flow-rank__form" onSubmit={onAnalyze}>
            <p className="t-title" style={{ marginTop: 28 }}>
              분야 선택
            </p>
            <div className="chips" style={{ marginTop: 12 }}>
              {PORTFOLIO_FIELDS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`chip ${field === f ? "is-on" : ""}`}
                  onClick={() => setField(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            <div style={{ marginTop: 24 }}>
              <Input
                label="GitHub 링크"
                name="github"
                placeholder="https://github.com/user/repo"
                value={github}
                onChange={(e) => {
                  setGithub(e.target.value);
                  setError("");
                }}
              />
            </div>
            {error ? (
              <p style={{ color: "var(--color-semantic-down)", fontSize: 13 }}>
                {error}
              </p>
            ) : null}

            <div className="flow-rank__actions">
              <Button type="button" variant="secondary" onClick={() => nav("/app")}>
                뒤로
              </Button>
              <Button type="submit">분석</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

/** 분석 중 로딩 */
export function RankAnalyzingPage() {
  const nav = useNavigate();
  const startedRef = useRef(false);

  useEffect(() => {
    // Guards against React 19 StrictMode's dev-only double-invoke of effects,
    // which would otherwise fire api.createPortfolio() (a POST) twice per visit.
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function run() {
      const raw = sessionStorage.getItem("pending-analyze");
      let resultId = "1";

      if (raw) {
        try {
          const body = JSON.parse(raw) as { field: string; github_url: string };
          const res = await api.createPortfolio(body);
          resultId = String(res.portfolio_id);
          sessionStorage.setItem("last-analyze", JSON.stringify(res));
        } catch {
          sessionStorage.setItem(
            "last-analyze",
            JSON.stringify({
              portfolio_id: 1,
              total_score: 86,
              rank: "A",
              player_rank_score_gained: 13,
              feedback: {
                good: "CI 테스트와 배포 설정이 명확합니다.",
                improve: "OpenAPI 명세를 추가하면 문서화 점수를 올릴 수 있습니다.",
              },
              scores: {
                completeness: 26,
                structure: 8,
                tech: 12,
                docs: 3.5,
                test: 3.5,
                deploy: 12,
                github: 17,
              },
            }),
          );
        }
      }

      window.setTimeout(() => {
        if (!cancelled) nav(`/app/rank/result/${resultId}`, { replace: true });
      }, 1800);
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  return (
    <div className="flow-loading">
      <div className="flow-loading__card">
        <div className="flow-loading__spin" aria-hidden />
        <h1 className="t-h1">분석 중</h1>
        <p className="t-body">저장소 구조 · 문서 · 테스트 · 배포를 확인합니다.</p>
      </div>
    </div>
  );
}

/** 분석 결과 + 메인으로 돌아가기(우하단) */
export function RankResultPage() {
  const nav = useNavigate();
  const cached = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("last-analyze") ?? "null");
    } catch {
      return null;
    }
  })();

  const total = cached?.total_score ?? 86;
  const rank = cached?.rank ?? "A";
  const gained = cached?.player_rank_score_gained ?? 13;
  const good = cached?.feedback?.good ?? "CI 테스트와 배포 설정이 명확합니다.";
  const improve =
    cached?.feedback?.improve ??
    "OpenAPI 명세를 추가하면 문서화 점수를 올릴 수 있습니다.";

  const scoreRows = SCORE_ITEMS.map((item) => {
    const val = cached?.scores?.[item.key] ?? item.max * 0.8;
    return { ...item, value: val };
  });

  return (
    <div className="flow-result">
      <div className="flow-result__card">
        <p className="badge">Analysis</p>
        <div className="row" style={{ marginTop: 16, gap: 16 }}>
          <RankPill rank={rank} score={Math.round(total)} />
          <div>
            <p className="t-h1 num">{Math.round(total)}</p>
            <p className="t-cap">
              총점 · 랭크 {rank} · RP{" "}
              <span className="num up">+{gained}</span>
            </p>
          </div>
        </div>

        <div className="stack" style={{ marginTop: 28, gap: 14 }}>
          {scoreRows.map((s) => (
            <div key={s.key} className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="t-sm">
                  {s.label} <span className="t-cap">({s.pct}%)</span>
                </span>
                <span className="num t-sm">
                  {s.value}/{s.max}
                </span>
              </div>
              <div className="flow-bar">
                <i style={{ width: `${Math.min(100, (s.value / s.max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid-2" style={{ marginTop: 28 }}>
          <article className="flow-panel">
            <h3 className="t-title">좋은 점</h3>
            <p className="t-body" style={{ marginTop: 8 }}>
              {good}
            </p>
          </article>
          <article className="flow-panel">
            <h3 className="t-title">개선할 점</h3>
            <p className="t-body" style={{ marginTop: 8 }}>
              {improve}
            </p>
          </article>
        </div>
      </div>

      <button
        type="button"
        className="flow-fab"
        onClick={() => nav("/app")}
      >
        메인으로
      </button>
    </div>
  );
}

/** 대결: 매칭하기 / 친구와 대결하기 */
export function BattleHomePage() {
  return (
    <div className="flow-battle-home">
      <div className="flow-battle-home__card">
        <p className="badge">Battle</p>
        <h1 className="t-h1" style={{ marginTop: 12 }}>
          대결하기
        </h1>
        <p className="t-body" style={{ marginTop: 8 }}>
          승리 +8 · 패배 -3 · 같은 분야 · 랭크 ±1
        </p>

        <div className="flow-battle-home__stack">
          <Link to="/app/battle/match" className="flow-big-cta">
            매칭하기
          </Link>
          <Link to="/app/battle/friend" className="flow-big-cta flow-big-cta--soft">
            친구와 대결하기
          </Link>
        </div>

        <Link to="/app" className="t-cap" style={{ display: "inline-block", marginTop: 20 }}>
          ← 메인으로
        </Link>
      </div>
    </div>
  );
}

export function BattleMatchFlowPage() {
  const nav = useNavigate();
  const [phase, setPhase] = useState<"search" | "found">("search");

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("found"), 1600);
    return () => window.clearTimeout(t);
  }, []);

  if (phase === "search") {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <div className="flow-loading__spin" aria-hidden />
          <h1 className="t-h1">매칭 중</h1>
          <p className="t-body">같은 분야 · 랭크 차이 1 이내 상대 검색</p>
          <Button variant="secondary" onClick={() => nav("/app/battle")}>
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-loading">
      <div className="flow-loading__card" style={{ textAlign: "left" }}>
        <h1 className="t-h1">상대 발견</h1>
        <div className="row" style={{ marginTop: 16, gap: 12 }}>
          <Avatar name="opponent" />
          <div>
            <p className="t-title">opponent</p>
            <p className="t-cap">랭크 B · 승률 58%</p>
          </div>
        </div>
        <p className="t-body" style={{ marginTop: 12 }}>
          상세 점수는 시작 전 비공개입니다.
        </p>
        <div className="row" style={{ marginTop: 20 }}>
          <Button onClick={() => nav("/app/battle/fighting")}>대결 시작</Button>
          <Button variant="secondary" onClick={() => nav("/app/battle")}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}

export function BattleFriendFlowPage() {
  const nav = useNavigate();
  const [name, setName] = useState("");

  return (
    <div className="flow-battle-home">
      <form
        className="flow-battle-home__card stack"
        onSubmit={(e) => {
          e.preventDefault();
          nav("/app/battle/fighting");
        }}
      >
        <h1 className="t-h1">친구와 대결</h1>
        <Input
          label="상대 사용자 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Button type="submit">초대 후 대결</Button>
        <Button type="button" variant="secondary" onClick={() => nav("/app/battle")}>
          뒤로
        </Button>
      </form>
    </div>
  );
}

/** 대결 분석 로딩 → 결과 */
export function BattleFightingPage() {
  const nav = useNavigate();
  useEffect(() => {
    const t = window.setTimeout(() => nav("/app/battle/result", { replace: true }), 1800);
    return () => window.clearTimeout(t);
  }, [nav]);

  return (
    <div className="flow-loading">
      <div className="flow-loading__card">
        <div className="flow-loading__spin" aria-hidden />
        <h1 className="t-h1">대결 분석 중</h1>
        <div className="row" style={{ justifyContent: "center", gap: 28, marginTop: 8 }}>
          <div>
            <Avatar name="demo" size="lg" />
            <p className="t-sm">demo</p>
          </div>
          <span className="muted">VS</span>
          <div>
            <Avatar name="opponent" size="lg" />
            <p className="t-sm">opponent</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const COMPARE = [
  { label: "프로젝트 완성도", a: 8, b: 5 },
  { label: "코드 구조", a: 4, b: 5 },
  { label: "기술 활용", a: 7, b: 6 },
  { label: "문서화", a: 5, b: 5 },
  { label: "테스트", a: 4, b: 7 },
  { label: "배포", a: 8, b: 6 },
  { label: "GitHub 활용", a: 9, b: 7 },
];

/** 위에 크게 승/패 → 스크롤로 분석 결과 */
export function BattleOutcomePage() {
  const nav = useNavigate();
  const r1 = COMPARE.reduce((s, r) => s + (r.a > r.b ? r.a - r.b : 0), 0);
  const r2 = COMPARE.reduce((s, r) => s + (r.b > r.a ? r.b - r.a : 0), 0);
  const won = r1 >= r2;

  return (
    <div className="flow-outcome">
      <section className={`flow-outcome__banner ${won ? "is-win" : "is-lose"}`}>
        <p className="flow-outcome__verdict">{won ? "승리" : "패배"}</p>
        <p className="t-body" style={{ color: "inherit", opacity: 0.85 }}>
          {won ? (
            <>
              플레이어 점수 <span className="num">+8</span>
            </>
          ) : (
            <>
              플레이어 점수 <span className="num">-3</span>
            </>
          )}
        </p>
        <p className="t-cap" style={{ color: "inherit", opacity: 0.65, marginTop: 12 }}>
          아래로 스크롤 · 분석 결과
        </p>
      </section>

      <section className="flow-outcome__detail">
        <div className="grid-2">
          <article className="flow-panel stack" style={{ alignItems: "center" }}>
            <Avatar name="demo" />
            <p className="t-title">demo</p>
            <p className="t-h1 num">{r1}</p>
          </article>
          <article className="flow-panel stack" style={{ alignItems: "center" }}>
            <Avatar name="opponent" />
            <p className="t-title">opponent</p>
            <p className="t-h1 num">{r2}</p>
          </article>
        </div>

        <div className="flow-panel" style={{ marginTop: 20, overflowX: "auto" }}>
          <h2 className="t-title" style={{ marginBottom: 12 }}>
            항목별 비교
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th>항목</th>
                <th>demo</th>
                <th>opponent</th>
                <th>우세</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="num">{r.a}</td>
                  <td className="num">{r.b}</td>
                  <td>{r.a === r.b ? "동점" : r.a > r.b ? "demo" : "opponent"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid-2" style={{ marginTop: 20 }}>
          <article className="flow-panel">
            <h3 className="t-title">좋았던 점</h3>
            <p className="t-body" style={{ marginTop: 8 }}>
              배포·GitHub 활용에서 앞섰습니다.
            </p>
          </article>
          <article className="flow-panel">
            <h3 className="t-title">개선할 점</h3>
            <p className="t-body" style={{ marginTop: 8 }}>
              테스트 구성을 보강하면 좋습니다.
            </p>
          </article>
        </div>

        <div className="row" style={{ marginTop: 28, flexWrap: "wrap" }}>
          <Button onClick={() => nav("/app")}>메인으로</Button>
          <Button variant="secondary" onClick={() => nav("/app/battle")}>
            다시 대결
          </Button>
        </div>
      </section>
    </div>
  );
}
