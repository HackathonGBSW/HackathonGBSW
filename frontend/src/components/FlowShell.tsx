import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { Avatar } from "./ui";
import { api, setAuthUsername } from "../lib/api";
import "./flow-shell.css";

export function FlowShell() {
  const nav = useNavigate();
  const [username, setUsername] = useState("demo");
  const [githubUsername, setGithubUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await api.me();
        const profile = await api.getProfile(me.username);
        if (!cancelled) {
          setUsername(profile.username);
          setGithubUsername(profile.github_username);
        }
      } catch {
        /* preview / not logged in */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    try {
      await api.signout();
    } catch {
      /* already logged out */
    }
    setAuthUsername(null);
    nav("/login");
  }

  return (
    <div className="flow-shell">
      <header className="flow-shell__bar">
        <Link to="/app" className="flow-shell__brand">
          Proof Arena
        </Link>
        <div className="flow-shell__actions">
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
