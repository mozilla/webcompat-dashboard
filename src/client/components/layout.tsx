import { Link, Outlet } from "@tanstack/react-router";

import lightbulb from "../assets/img/lightbulb.svg";

export default function Layout() {
  return (
    <>
      <header>
        <div className="page-title">
          <img src={lightbulb} width="50" height="50" alt="the WebCompat light bulb!" />
          <h1>wckbng</h1>
        </div>
        <nav>
          <ul>
            <li>
              <Link to="/user_reports">User Reports</Link>
            </li>
            <li>
              <Link to="/domain_rank">Domain Rank</Link>
            </li>
            <li>
              <Link to="/inconsistent_entries">Inconsistent Entries</Link>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
