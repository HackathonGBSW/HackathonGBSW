import { Link, Outlet } from "react-router-dom";
import { Avatar } from "./ui";
import "./flow-shell.css";

export function FlowShell() {
  return (
    <div className="flow-shell">
      <header className="flow-shell__bar">
        <Link to="/app" className="flow-shell__brand">
          Proof Arena
        </Link>
        <Link to="/app" className="flow-shell__me">
          <Avatar name="demo" size="sm" />
        </Link>
      </header>
      <Outlet />
    </div>
  );
}
