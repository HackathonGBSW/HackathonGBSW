import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BattleGaugeReveal } from "../components/BattleGaugeReveal";
import { ScoreRadar } from "../components/ScoreRadar";
import { Button, Input, RankPill } from "../components/ui";
import {
  DEMO,
  FIELDS,
  PORTFOLIO_FIELDS,
  SCORE_ITEMS,
  api,
  formatRankTier,
  githubProfileUrl,
  isBattle,
  setAuthUsername,
  toSafeHttpUrl,
  toPortfolioDetail,
  type Battle,
  type Portfolio,
  type PortfolioScores,
  type Profile,
  type Rank,
} from "../lib/api";
import profileAvatar from "../assets/profile-card-avatar.jpg";
import profileBanner from "../assets/profile-card-banner.jpg";
import "./flow.css";

const LAST_BATTLE_KEY = "last-battle";
const PENDING_ANALYZE_KEY = "pending-analyze";
const LAST_ANALYZE_KEY = "last-analyze";
const PENDING_BATTLE_KEY = "pending-battle";

const DEMO_RADAR_SCORES: PortfolioScores = {
  completeness: 24,
  structure: 7,
  tech: 11,
  docs: 3,
  test: 3,
  deploy: 10,
  github: 15,
};

const PLAYER_DIVISION = "II";
const NEXT_PLAYER_DIVISION = "III";

function formatPlayerTier(rank: Rank) {
  return `${formatRankTier(rank)} ${PLAYER_DIVISION}`;
}

function formatNextPlayerTier(rank: Rank) {
  return `${formatRankTier(rank)} ${NEXT_PLAYER_DIVISION}`;
}

function formatWinRate(rate: number | null, wins: number, losses: number) {
  if (rate == null || wins + losses === 0) return `기록 없음 (0승 0패)`;
  return `${(rate * 100).toFixed(1)}% (${wins}승 ${losses}패)`;
}

/** 메인(마이페이지): 넓은 프로필 카드 + 스크롤 시 랭크받기/대결하기 반반 */
export function MainPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [latestScores, setLatestScores] = useState<PortfolioScores | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarFailed, setAvatarFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        setAuthUsername(me.username);
        const p = await api.getProfile(me.username);
        const portfolios = await api.listPortfolios().catch(() => []);
        const latestPortfolio = [...portfolios].sort((a, b) => b.id - a.id)[0];
        if (!cancelled) {
          setProfile(p);
          setLatestScores(latestPortfolio ? toPortfolioDetail(latestPortfolio).scores : null);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setLatestScores(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const u = profile ?? DEMO;
  const isDemo = !profile;
  const rankScore = Math.min(100, Math.max(0, u.player_rank_score));
  const playerTier = formatPlayerTier(u.player_rank);
  const nextPlayerTier = formatNextPlayerTier(u.player_rank);
  const radarScores = latestScores ?? DEMO_RADAR_SCORES;
  const githubHref = githubProfileUrl(u.github_username);
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
      value: formatWinRate(u.battle_win_rate, u.battle_win, u.battle_lose),
    },
    { label: "포폴 최고 랭크", value: formatRankTier(u.portfolio_best_rank) },
    { label: "포폴 평균 랭크", value: formatRankTier(u.portfolio_avg_rank) },
  ];

  return (
    <div className="flow-main">
      <section className="flow-hero" aria-label="메인 프로필">
        {loading ? (
          <p className="t-cap" style={{ padding: 24 }}>
            프로필 불러오는 중…
          </p>
        ) : null}
        {isDemo && !loading ? (
          <p className="t-cap" style={{ padding: "0 24px 12px" }}>
            미리보기 모드 — 로그인하면 실제 프로필이 표시됩니다.
          </p>
        ) : null}
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
                <img
                  src={
                    u.github_username && !avatarFailed
                      ? `https://github.com/${encodeURIComponent(u.github_username)}.png`
                      : profileAvatar
                  }
                  alt=""
                  onError={() => setAvatarFailed(true)}
                />
              </div>

              <div className="profile-card__title">
                <p className="profile-card__eyebrow">MAIN PROFILE</p>
                <h1 className="profile-card__name">{u.username}</h1>
              </div>
            </div>

            <p className="profile-card__intro">
              {isDemo ? DEMO.bio : "근거 기반 포트폴리오로 실력을 증명합니다."}
            </p>

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

            <section className="profile-card__analysis" aria-label="포트폴리오 분석 지표">
              <div className="profile-card__analysis-copy">
                <span>Portfolio Analysis</span>
                <strong>7개 항목 분석</strong>
                <p>대결 기준으로 쓰이는 핵심 항목을 한 번에 비교합니다.</p>
              </div>
              <ScoreRadar
                scores={radarScores}
                size={260}
                className="profile-card__radar"
              />
            </section>

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
                href={githubHref}
                target="_blank"
                rel="noreferrer"
              >
                @ {u.github_username || "GitHub를 등록해주세요"}
              </a>

              <div className="profile-card__meter" aria-label="플레이어 랭크 점수">
                <div>
                  <span>{nextPlayerTier}까지</span>
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

/** 랭크 받기: 분야 선택 + 깃허브 URL + 분석 버튼 */
export function RankPage() {
  const nav = useNavigate();
  const [field, setField] = useState<(typeof PORTFOLIO_FIELDS)[number]>(
    PORTFOLIO_FIELDS[1],
  );
  const [github, setGithub] = useState("");
  const [error, setError] = useState("");

  function onAnalyze(e: FormEvent) {
    e.preventDefault();
    const repository = github.trim();
    if (!repository) {
      setError("GitHub URL을 입력하세요.");
      return;
    }
    if (!toSafeHttpUrl(repository)) {
      setError("올바른 http(s) GitHub URL을 입력하세요.");
      return;
    }
    sessionStorage.setItem(
      PENDING_ANALYZE_KEY,
      JSON.stringify({ field, repository }),
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

async function submitPendingAnalyze(): Promise<string> {
  const raw = sessionStorage.getItem(PENDING_ANALYZE_KEY);
  if (!raw) throw new Error("분석할 저장소 정보가 없습니다.");

  const body = JSON.parse(raw) as { field: string; repository: string };
  const res = await api.createPortfolio(body);
  sessionStorage.setItem(LAST_ANALYZE_KEY, JSON.stringify(res));
  sessionStorage.removeItem(PENDING_ANALYZE_KEY);
  return String(res.portfolio_id);
}

export function RankAnalyzingPage() {
  const nav = useNavigate();
  const [error, setError] = useState("");
  const requestRef = useRef<Promise<string> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (!requestRef.current) {
          requestRef.current = submitPendingAnalyze();
        }
        const resultId = await requestRef.current;
        if (!cancelled) nav(`/app/rank/result/${resultId}`, { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "분석에 실패했습니다.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  if (error) {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <h1 className="t-h1">분석 실패</h1>
          <p className="t-body">{error}</p>
          <Button onClick={() => nav("/app/rank")}>다시 시도</Button>
        </div>
      </div>
    );
  }

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

export function RankResultPage() {
  const nav = useNavigate();
  const cached = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(LAST_ANALYZE_KEY) ?? "null");
    } catch {
      return null;
    }
  })();

  const total = cached?.total_score ?? 0;
  const rank = (cached?.rank ?? "F") as Rank;
  const rankLabel = formatRankTier(rank);
  const gained = cached?.player_rank_score_gained ?? 0;
  const good = cached?.feedback?.good ?? "—";
  const improve = cached?.feedback?.improve ?? "—";

  const scores: PortfolioScores = {
    completeness: cached?.scores?.completeness ?? 0,
    structure: cached?.scores?.structure ?? 0,
    tech: cached?.scores?.tech ?? 0,
    docs: cached?.scores?.docs ?? 0,
    test: cached?.scores?.test ?? 0,
    deploy: cached?.scores?.deploy ?? 0,
    github: cached?.scores?.github ?? 0,
  };

  const scoreRows = SCORE_ITEMS.map((item) => {
    const val = scores[item.key] ?? 0;
    return { ...item, value: val };
  });

  return (
    <div className="flow-result">
      <div className="flow-result__card">
        <p className="badge">Analysis</p>

        <div className="flow-result__radar">
          <ScoreRadar scores={scores} />
        </div>

        <div className="row" style={{ marginTop: 8, gap: 16 }}>
          <RankPill rank={rankLabel} score={Math.round(total)} />
          <div>
            <p className="t-h1 num">{Math.round(total)}</p>
            <p className="t-cap">
              총점 · 랭크 {rankLabel} · RP{" "}
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

      <button type="button" className="flow-fab" onClick={() => nav("/app")}>
        메인으로
      </button>
    </div>
  );
}

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

function useMyPortfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.listPortfolios();
        if (!cancelled) setPortfolios(rows);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "포트폴리오를 불러오지 못했습니다. 로그인하세요.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { portfolios, error, loading };
}

export function BattleMatchFlowPage() {
  const nav = useNavigate();
  const { portfolios, error: loadError, loading } = useMyPortfolios();
  const [portfolioId, setPortfolioId] = useState<number | "">("");
  const [phase, setPhase] = useState<"form" | "search" | "error">("form");
  const [error, setError] = useState("");
  const [statusText, setStatusText] = useState("같은 분야 · 랭크 차이 1 이내 상대 검색");
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (portfolios.length && portfolioId === "") {
      setPortfolioId(portfolios[0].id);
    }
  }, [portfolios, portfolioId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  async function startMatch() {
    const selected = portfolios.find((p) => p.id === portfolioId);
    if (!selected) {
      setError("대결에 사용할 포트폴리오를 선택하세요.");
      return;
    }
    setPhase("search");
    setError("");
    setStatusText("매칭 중…");

    try {
      const result = await api.createMatch({
        field: selected.field,
        portfolio_id: selected.id,
      });

      if (isBattle(result)) {
        sessionStorage.setItem(LAST_BATTLE_KEY, JSON.stringify(result));
        nav("/app/battle/fighting", { replace: true });
        return;
      }

      setStatusText("대기열에 등록됨 — 상대를 기다리는 중…");
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await api.getMatchStatus();
          if (status.status === "matched" && status.matched_battle_id) {
            if (pollRef.current) window.clearInterval(pollRef.current);
            const battle = await api.getBattle(status.matched_battle_id);
            sessionStorage.setItem(LAST_BATTLE_KEY, JSON.stringify(battle));
            nav("/app/battle/fighting", { replace: true });
          }
        } catch {
          /* keep polling */
        }
      }, 2000);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "매칭에 실패했습니다.");
    }
  }

  async function cancel() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    try {
      await api.cancelMatch();
    } catch {
      /* ignore */
    }
    nav("/app/battle");
  }

  if (loading) {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <div className="flow-loading__spin" aria-hidden />
          <p className="t-body">포트폴리오 불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (loadError || portfolios.length === 0) {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <h1 className="t-h1">매칭 불가</h1>
          <p className="t-body">
            {loadError || "먼저 랭크 받기에서 포트폴리오를 등록하세요."}
          </p>
          <Button onClick={() => nav("/app/rank")}>랭크 받으러 가기</Button>
        </div>
      </div>
    );
  }

  if (phase === "search") {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <div className="flow-loading__spin" aria-hidden />
          <h1 className="t-h1">매칭 중</h1>
          <p className="t-body">{statusText}</p>
          <Button variant="secondary" onClick={() => void cancel()}>
            취소
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-battle-home">
      <div className="flow-battle-home__card stack">
        <h1 className="t-h1">매칭하기</h1>
        <p className="t-body">내 포트폴리오를 고르면 같은 분야·유사 랭크 상대와 매칭합니다.</p>
        <label className="field">
          <span className="field__label">내 포트폴리오</span>
          <select
            className="field__input"
            value={portfolioId}
            onChange={(e) => setPortfolioId(Number(e.target.value))}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                [{formatRankTier(p.rank)}] {p.field} — {p.repository}
              </option>
            ))}
          </select>
        </label>
        {error || phase === "error" ? (
          <p style={{ color: "var(--color-semantic-down)", fontSize: 13 }}>{error}</p>
        ) : null}
        <Button onClick={() => void startMatch()}>매칭 시작</Button>
        <Button type="button" variant="secondary" onClick={() => nav("/app/battle")}>
          뒤로
        </Button>
      </div>
    </div>
  );
}

export function BattleFriendFlowPage() {
  const nav = useNavigate();
  const { portfolios, error: loadError, loading } = useMyPortfolios();
  const [portfolioId, setPortfolioId] = useState<number | "">("");
  const [opponent, setOpponent] = useState("");
  const [opponentPortfolioId, setOpponentPortfolioId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (portfolios.length && portfolioId === "") {
      setPortfolioId(portfolios[0].id);
    }
  }, [portfolios, portfolioId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const selected = portfolios.find((p) => p.id === portfolioId);
    const oppId = Number(opponentPortfolioId);
    if (!selected || !opponent.trim() || !oppId) {
      setError("상대 이름과 양쪽 포트폴리오를 모두 입력하세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const battle = await api.createFriendBattle({
        field: selected.field,
        opponent_username: opponent.trim(),
        portfolio_id: selected.id,
        opponent_portfolio_id: oppId,
      });
      sessionStorage.setItem(LAST_BATTLE_KEY, JSON.stringify(battle));
      sessionStorage.setItem(
        PENDING_BATTLE_KEY,
        JSON.stringify({ me: selected.username, opponent: opponent.trim() }),
      );
      nav("/app/battle/fighting", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "대결에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <div className="flow-loading__spin" aria-hidden />
          <p className="t-body">포트폴리오 불러오는 중…</p>
        </div>
      </div>
    );
  }

  if (loadError || portfolios.length === 0) {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <h1 className="t-h1">대결 불가</h1>
          <p className="t-body">
            {loadError || "먼저 랭크 받기에서 포트폴리오를 등록하세요."}
          </p>
          <Button onClick={() => nav("/app/rank")}>랭크 받으러 가기</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-battle-home">
      <form className="flow-battle-home__card stack" onSubmit={(e) => void onSubmit(e)}>
        <h1 className="t-h1">친구와 대결</h1>
        <label className="field">
          <span className="field__label">내 포트폴리오</span>
          <select
            className="field__input"
            value={portfolioId}
            onChange={(e) => setPortfolioId(Number(e.target.value))}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                [{formatRankTier(p.rank)}] {p.field} — {p.repository}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="상대 사용자 이름"
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          required
        />
        <Input
          label="상대 포트폴리오 ID"
          value={opponentPortfolioId}
          onChange={(e) => setOpponentPortfolioId(e.target.value)}
          placeholder="숫자 ID"
          required
        />
        {error ? (
          <p style={{ color: "var(--color-semantic-down)", fontSize: 13 }}>{error}</p>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "대결 중…" : "대결 시작"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => nav("/app/battle")}>
          뒤로
        </Button>
      </form>
    </div>
  );
}

export function BattleFightingPage() {
  const nav = useNavigate();
  const battle = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(LAST_BATTLE_KEY) ?? "null") as Battle | null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (battle) return;
    const t = window.setTimeout(() => nav("/app/battle/result", { replace: true }), 400);
    return () => window.clearTimeout(t);
  }, [nav, battle]);

  if (!battle) {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <div className="flow-loading__spin" aria-hidden />
          <h1 className="t-h1">대결 분석 중</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-battle-fighting">
      <section className="flow-battle-fighting__card">
        <p className="badge">Battle Scan</p>
        <h1 className="t-h1" style={{ marginTop: 12 }}>
          항목별 비교 공개
        </h1>
        <p className="t-body" style={{ marginTop: 8 }}>
          중앙 게이지가 흔들린 뒤, 위 항목부터 차례대로 승부를 공개합니다.
        </p>
        <div className="flow-battle-fighting__gauge">
          <BattleGaugeReveal
            leftName={battle.username1}
            rightName={battle.username2}
            leftScores={battle.scores1}
            rightScores={battle.scores2}
            onComplete={() => {
              window.setTimeout(() => nav("/app/battle/result", { replace: true }), 500);
            }}
          />
        </div>
      </section>
    </div>
  );
}

export function BattleOutcomePage() {
  const nav = useNavigate();
  const [me, setMe] = useState("me");

  useEffect(() => {
    api.me()
      .then((u) => setMe(u.username))
      .catch(() => {
        /* preview */
      });
  }, []);

  const battle = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(LAST_BATTLE_KEY) ?? "null") as Battle | null;
    } catch {
      return null;
    }
  })();

  if (!battle) {
    return (
      <div className="flow-outcome">
        <section className="flow-outcome__banner is-lose">
          <p className="flow-outcome__verdict">결과 없음</p>
          <p className="t-body" style={{ color: "inherit", opacity: 0.85 }}>
            대결 기록을 찾을 수 없습니다.
          </p>
          <Button onClick={() => nav("/app/battle")} style={{ marginTop: 16 }}>
            대결로
          </Button>
        </section>
      </div>
    );
  }

  const iAmUser1 = battle.username1 === me;
  const myName = iAmUser1 ? battle.username1 : battle.username2;
  const oppName = iAmUser1 ? battle.username2 : battle.username1;
  const myResult = iAmUser1 ? battle.result1 : battle.result2;
  const oppResult = iAmUser1 ? battle.result2 : battle.result1;
  const myFeedback = iAmUser1 ? battle.feedback1 : battle.feedback2;
  const draw = battle.winner == null;
  const won = !draw && battle.winner === myName;

  return (
    <div className="flow-outcome">
      <section
        className={`flow-outcome__banner battle-gauge__verdict-enter ${
          draw ? "is-lose" : won ? "is-win" : "is-lose"
        }`}
      >
        <p className="flow-outcome__verdict">
          {draw ? "무승부" : won ? "승리" : "패배"}
        </p>
        <p className="t-body" style={{ color: "inherit", opacity: 0.85 }}>
          {draw ? (
            "랭크 점수 변동 없음"
          ) : won ? (
            <>
              플레이어 점수 <span className="num">+8</span>
            </>
          ) : (
            <>
              플레이어 점수 <span className="num">-3</span>
            </>
          )}
        </p>
        <div className="row" style={{ marginTop: 20, gap: 28, justifyContent: "center" }}>
          <div>
            <p className="t-cap" style={{ color: "inherit", opacity: 0.7 }}>
              {myName}
            </p>
            <p className="t-h1 num" style={{ color: "inherit" }}>
              {myResult}
            </p>
          </div>
          <span style={{ opacity: 0.5 }}>VS</span>
          <div>
            <p className="t-cap" style={{ color: "inherit", opacity: 0.7 }}>
              {oppName}
            </p>
            <p className="t-h1 num" style={{ color: "inherit" }}>
              {oppResult}
            </p>
          </div>
        </div>
      </section>

      <section className="flow-outcome__detail">
        <div className="grid-2" style={{ marginTop: 8 }}>
          <article className="flow-panel">
            <h3 className="t-title">피드백</h3>
            <p className="t-body" style={{ marginTop: 8 }}>
              {myFeedback || "—"}
            </p>
          </article>
          <article className="flow-panel">
            <h3 className="t-title">상대 피드백</h3>
            <p className="t-body" style={{ marginTop: 8 }}>
              {(iAmUser1 ? battle.feedback2 : battle.feedback1) || "—"}
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
