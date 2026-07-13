import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui";
import { api, FIELDS, getAuthUsername, setAuthUsername } from "../lib/api";

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
      const me = await api.signin(username, password);
      setAuthUsername(me.username);
      const profile = await api.getProfile(me.username).catch(() => null);
      if (profile && !profile.main_field) nav("/onboarding");
      else nav("/app");
    } catch {
      setError("로그인에 실패했습니다. 아이디·비밀번호를 확인하세요.");
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
        <p className="t-cap">계정으로 로그인</p>
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
          <Link to="/signup">회원가입</Link>
        </p>
        <button
          type="button"
          onClick={() => {
            setAuthUsername(null);
            nav("/app");
          }}
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
  const [githubUsername, setGithubUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.signup(username, password, githubUsername.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "가입에 실패했습니다.");
      setLoading(false);
      return;
    }
    try {
      const me = await api.signin(username, password);
      setAuthUsername(me.username);
      nav("/onboarding");
    } catch {
      nav("/login");
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
        <h1 className="t-h1">회원가입</h1>
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
        <Input
          label="GitHub 사용자명"
          name="github_username"
          value={githubUsername}
          onChange={(e) => setGithubUsername(e.target.value)}
          placeholder="octocat"
          required
        />
        {error ? (
          <p style={{ color: "var(--color-semantic-down)", fontSize: 13 }}>{error}</p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? "가입 중…" : "다음"}
        </Button>
        <p className="t-cap" style={{ textAlign: "center" }}>
          이미 계정이 있나요? <Link to="/login">로그인</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function OnboardingPage() {
  const nav = useNavigate();
  const [username, setUsername] = useState(getAuthUsername() ?? "");
  const [field, setField] = useState<string>(FIELDS[1]);
  const [github, setGithub] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        if (!cancelled) {
          setUsername(me.username);
          setAuthUsername(me.username);
          const profile = await api.getProfile(me.username);
          if (!cancelled && profile.github_username) {
            setGithub(profile.github_username);
          }
          if (!cancelled && profile.main_field) {
            setField(profile.main_field);
          }
        }
      } catch {
        /* preview / not logged in */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.updateProfile({
        main_field: field,
        github_username: github.trim() || undefined,
      });
      nav("/app");
    } catch {
      setError("프로필 저장에 실패했습니다. 로그인 상태를 확인하세요.");
    } finally {
      setLoading(false);
    }
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
        <div className="stack" style={{ gap: 4 }}>
          <span className="field__label">사용자 이름</span>
          <p className="t-sm">{username || "—"}</p>
        </div>
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
          label="GitHub 사용자명"
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          placeholder="octocat"
        />
        {error ? (
          <p style={{ color: "var(--color-semantic-down)", fontSize: 13 }}>{error}</p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? "저장 중…" : "저장하고 시작"}
        </Button>
      </form>
    </div>
  );
}
