import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui";
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
      await api.signin(username, password);
      nav("/onboarding");
    } catch {
      setError("가입 실패 — 이미 존재하는 아이디일 수 있습니다.");
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
