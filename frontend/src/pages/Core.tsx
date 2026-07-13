import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input, PageHeader, Avatar, RankPill } from "../components/ui";
import { api, DEMO, FIELDS } from "../lib/api";

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--color-surface-soft)",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 420 }}>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.signin(username, password);
      const profile = await api.getProfile(username).catch(() => null);
      if (profile && !profile.main_field) nav("/onboarding");
      else nav("/app");
    } catch {
      setError("로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <form className="stack" onSubmit={onSubmit}>
        <Link to="/" style={{ color: "var(--color-ink)", fontWeight: 600 }}>
          Proof Arena
        </Link>
        <h1 className="t-h1">로그인</h1>
        <p className="t-cap">GitHub 또는 계정으로 로그인</p>
        <Button type="button" variant="secondary" onClick={() => nav("/onboarding")}>
          GitHub로 로그인
        </Button>
        <Input
          label="아이디"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          label="비밀번호"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? (
          <p style={{ color: "var(--color-semantic-down)", fontSize: 13 }}>{error}</p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? "로그인 중…" : "로그인"}
        </Button>
        <p className="t-cap" style={{ textAlign: "center" }}>
          <Link to="/signup">회원가입</Link> · 비밀번호 찾기
        </p>
        <button
          type="button"
          onClick={() => nav("/app")}
          style={{
            border: 0,
            background: "none",
            color: "var(--color-muted)",
            fontSize: 13,
            textDecoration: "underline",
          }}
        >
          미리보기 (백엔드 없이)
        </button>
      </form>
    </AuthShell>
  );
}

export function SignupPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.signup(username, password);
    } catch {
      setError("가입 실패 — 이미 존재하는 아이디일 수 있습니다.");
      return;
    }
    try {
      await api.signin(username, password);
      nav("/onboarding");
    } catch {
      nav("/login");
    }
  }

  return (
    <AuthShell>
      <form className="stack" onSubmit={onSubmit}>
        <Link to="/" style={{ color: "var(--color-ink)", fontWeight: 600 }}>
          Proof Arena
        </Link>
        <h1 className="t-h1">회원가입</h1>
        <Button type="button" variant="secondary" onClick={() => nav("/onboarding")}>
          GitHub로 가입
        </Button>
        <Input
          label="사용자 이름"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          label="비밀번호"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error ? (
          <p style={{ color: "var(--color-semantic-down)", fontSize: 13 }}>{error}</p>
        ) : null}
        <Button type="submit">다음</Button>
        <p className="t-cap" style={{ textAlign: "center" }}>
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function OnboardingPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState(DEMO.username);
  const [field, setField] = useState<string>(FIELDS[1]);
  const [github, setGithub] = useState("");
  const [bio, setBio] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.updateProfile({
        main_field: field,
        github_url: github || undefined,
      });
    } catch {
      /* demo */
    }
    nav("/app");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "var(--color-surface-soft)",
      }}
    >
      <form className="card stack" onSubmit={onSubmit} style={{ width: "100%", maxWidth: 480 }}>
        <span className="badge">초기 설정</span>
        <h1 className="t-h1">프로필 설정</h1>
        <p className="t-cap">신규 사용자: 플레이어 점수 0 · 랭크 F</p>
        <Input
          label="사용자 이름"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <div className="stack" style={{ gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>주 분야</span>
          <div className="chips">
            {FIELDS.map((f) => (
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
        </div>
        <Input
          label="GitHub URL"
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          placeholder="https://github.com/user"
        />
        <label className="field">
          <span className="field__label">자기소개</span>
          <textarea
            className="field__input"
            style={{ height: "auto", minHeight: 96, resize: "vertical" }}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <Button type="submit">저장하고 시작</Button>
      </form>
    </div>
  );
}

export function DashboardPage() {
  const u = DEMO;
  const battles = u.wins + u.losses;
  return (
    <div className="stack" style={{ gap: 28 }}>
      <PageHeader
        title="홈"
        description="활동 요약과 빠른 실행"
        actions={
          <Link to="/app/portfolios/new">
            <Button>포트폴리오 분석하기</Button>
          </Link>
        }
      />
      <section className="card">
        <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
          <Avatar name={u.username} size="lg" />
          <div className="stack" style={{ gap: 6, flex: 1 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 className="t-title">{u.username}</h2>
              <RankPill rank={u.player_rank} score={u.player_rank_score} />
            </div>
            <p className="t-sm">{u.main_field}</p>
            <p className="t-cap">
              승률{" "}
              <span className="num">{(u.battle_win_rate * 100).toFixed(1)}%</span> · 최고{" "}
              {u.portfolio_best_rank} · 평균 {u.portfolio_avg_rank}
            </p>
          </div>
        </div>
      </section>
      <section className="grid-3">
        <div className="card card--soft">
          <p className="t-cap">포트폴리오</p>
          <p className="t-h2 num">6</p>
        </div>
        <div className="card card--soft">
          <p className="t-cap">대결</p>
          <p className="t-title num">
            {battles}전 {u.wins}승 {u.losses}패
          </p>
        </div>
        <div className="card card--soft">
          <p className="t-cap">최근 점수</p>
          <p className="t-h2 num up">+13</p>
        </div>
      </section>
      <section className="stack">
        <h2 className="t-title">빠른 실행</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <Link to="/app/portfolios/new">
            <Button>분석하기</Button>
          </Link>
          <Link to="/app/battle/match">
            <Button variant="secondary">랜덤 매칭</Button>
          </Link>
          <Link to="/app/battle/friend">
            <Button variant="secondary">친구와 대결</Button>
          </Link>
          <Link to="/app/portfolios">
            <Button variant="secondary">내 포트폴리오</Button>
          </Link>
          <Link to="/app/battles">
            <Button variant="secondary">대결 기록</Button>
          </Link>
        </div>
      </section>
      <section className="stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 className="t-title">최근 포트폴리오</h2>
          <Link to="/app/portfolios">전체</Link>
        </div>
        <div className="grid-2">
          {[
            { id: 1, name: "Secure API Gateway", field: "백엔드", score: 86, rank: "A" },
            { id: 2, name: "Realtime Chat Core", field: "풀스택", score: 78, rank: "C" },
          ].map((p) => (
            <article key={p.id} className="card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="t-cap">{p.field}</span>
                <RankPill rank={p.rank} score={p.score} />
              </div>
              <h3 className="t-title" style={{ marginTop: 10 }}>
                <Link to={`/app/portfolios/${p.id}`}>{p.name}</Link>
              </h3>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
