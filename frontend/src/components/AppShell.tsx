import { NavLink, Outlet, Link } from "react-router-dom";
import { Avatar } from "./ui";
import "./shell.css";

const NAV = [
  { to: "/app", end: true, label: "홈" },
  { to: "/app/explore", label: "탐색" },
  { to: "/app/portfolios", label: "포트폴리오" },
  { to: "/app/portfolios/new", label: "분석하기" },
  { to: "/app/battle", label: "대결" },
  { to: "/app/ranking", label: "랭킹" },
  { to: "/app/battles", label: "대결 기록" },
  { to: "/app/notifications", label: "알림" },
  { to: "/app/profile/demo", label: "내 프로필" },
  { to: "/app/settings", label: "설정" },
];

const MOBILE = [
  { to: "/app", end: true, label: "홈" },
  { to: "/app/portfolios", label: "포폴" },
  { to: "/app/battle", label: "대결" },
  { to: "/app/ranking", label: "랭킹" },
  { to: "/app/profile/demo", label: "프로필" },
];

export function AppShell() {
  return (
    <div className="shell">
      <header className="shell__top">
        <div className="shell__top-inner">
          <Link to="/app" className="shell__brand">
            Proof Arena
          </Link>
          <label className="shell__search">
            <span className="sr-only">검색</span>
            <input placeholder="개발자, 포트폴리오 검색" />
          </label>
          <div className="shell__right">
            <Link to="/app/portfolios/new" className="shell__cta">
              분석하기
            </Link>
            <Link to="/app/profile/demo">
              <Avatar name="demo" size="sm" />
            </Link>
          </div>
        </div>
      </header>

      <div className="shell__body">
        <aside className="shell__side">
          <nav>
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `shell__link ${isActive ? "is-active" : ""}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="shell__main">
          <Outlet />
        </main>
      </div>

      <nav className="shell__mobile">
        {MOBILE.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `shell__mlink ${isActive ? "is-active" : ""}`
            }
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
