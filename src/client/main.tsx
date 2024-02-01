import "inter-ui/inter.css";
import "./assets/css/main.scss";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RootRoute, Route, Router, RouterProvider } from "@tanstack/react-router";
import DomainRank from "./routes/domain_rank";
import InconsistentEntries from "./routes/inconsistent_entries";
import Layout from "./components/layout";
import NotFound from "./routes/not_found";
import React from "react";
import ReactDOM from "react-dom/client";
import UserReports from "./routes/user_reports";

const rootRoute = new RootRoute({
  component: Layout,
});

const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: () => {
    router.navigate({ to: "/user_reports" });
  },
});

const domainRankRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/domain_rank",
  component: DomainRank,
});

const inconsistentEntriesRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/inconsistent_entries",
  component: InconsistentEntries,
});

const userReportsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/user_reports",
  component: UserReports,
});

const notFoundRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "/*",
  component: NotFound,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  domainRankRoute,
  inconsistentEntriesRoute,
  userReportsRoute,
  notFoundRoute,
]);
const router = new Router({ routeTree });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // TanStack Query, by default, refreshes the data when a user moves away
      // from the tab/window and then comes back. While this is usually a great
      // feature, it might cause unexpected state changes in our use-cases, so
      // let's disable that.
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
