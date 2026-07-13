import { useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { Avatar } from "./ui";
import { api } from "../lib/api";
import "./flow-shell.css";

export function FlowShell() {
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

  return (
    <div className="flow-shell">
      <header className="flow-shell__bar">
        <Link to="/app" className="flow-shell__brand">
          Proof Arena
        </Link>
        <Link to="/app" className="flow-shell__me">
          <Avatar name={username} githubUsername={githubUsername} size="sm" />
        </Link>
      </header>
      <Outlet />
    </div>
  );
}
