import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Avatar } from "./ui";
import { api, setAuthUsername } from "../lib/api";
import "./flow-shell.css";

export function FlowShell() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        const profile = await api.getProfile(me.username);
        if (!cancelled) {
          setUsername(profile.username);
          setGithubUsername(profile.github_username);
          setAuthChecked(true);
        }
      } catch {
        // 로그인 안 됐거나(또는 세션이 가리키는 계정이 삭제됐거나) — 어느 쪽이든
        // /app 하위 페이지를 보여주지 않고 로그인 페이지로 보낸다.
        if (!cancelled) nav("/login", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  async function handleLogout() {
    try {
      await api.signout();
    } catch {
      /* already logged out */
    }
    setAuthUsername(null);
    nav("/login");
  }

  if (!authChecked) {
    return (
      <div className="flow-loading">
        <div className="flow-loading__card">
          <div className="flow-loading__spin" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="flow-shell">
      <header className="flow-shell__bar">
        <Link to="/app" className="flow-shell__brand">
          Proof Arena
        </Link>
        <div className="flow-shell__actions">
          <Link to="/app/ranking" className="flow-shell__logout">
            랭킹
          </Link>
          <Link to="/app" className="flow-shell__me">
            <Avatar name={username} githubUsername={githubUsername} size="sm" />
          </Link>
          <button type="button" className="flow-shell__logout" onClick={() => void handleLogout()}>
            로그아웃
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
