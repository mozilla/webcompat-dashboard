import dotenv from "dotenv";
dotenv.config();

import { Strategy as Auth0Strategy } from "passport-auth0";
import { Strategy as GitHubStrategy } from "passport-github2";
import bodyParser from "body-parser";
import express, { Request, Response, NextFunction } from "express";
import passport from "passport";
import session from "express-session";
import ViteExpress from "vite-express";

import { endWithStatusAndBody } from "./helpers/http";
import handleUserReports from "./routes/user_reports";
import handleTrackAction from "./routes/track_action";

const app = express();
app.use(bodyParser.json());

let auth_config = {
  provider: "",
  params: {},
};

if (process.env.SKIP_AUTH !== "true") {
  app.use(
    session({
      proxy: true,
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: { secure: true, sameSite: "none", httpOnly: true, maxAge: 60 * 60 * 24 * 30 },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  if (process.env.AUTH_DOMAIN == "github.com") {
    auth_config.provider = "github";
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.AUTH_CLIENT_ID!,
          clientSecret: process.env.AUTH_CLIENT_SECRET!,
          callbackURL: `${process.env.BACKEND_WEB_ROOT}/callback`,
        },
        (_accessToken: any, _refreshToken: any, profile: any, done: any) => {
          process.nextTick(function () {
            return done(null, profile);
          });
        },
      ),
    );
  } else if (process.env.AUTH_DOMAIN?.endsWith(".auth0.com")) {
    auth_config.provider = "auth0";
    auth_config.params = { scope: 'openid email' };
    passport.use(
      new Auth0Strategy(
        {
          domain: process.env.AUTH_DOMAIN!,
          clientID: process.env.AUTH_CLIENT_ID!,
          clientSecret: process.env.AUTH_CLIENT_SECRET!,
          callbackURL: `${process.env.BACKEND_WEB_ROOT}/callback`,
        },
        (_accessToken: any, _refreshToken: any, _extra: any, profile: any, done: any) => {
          process.nextTick(function () {
            return done(null, profile);
          });
        },
      ),
    );
  } else {
    throw "NYI: Other providers"
  }
}

/**
 * Usually, you'd do a bit more logic here, like storing user data in a database
 * or something. However, this is really only here to allow validating the
 * authenticated username against an allowlist, so only having the username is
 * good enough.
 */
passport.serializeUser((user: any, done) => {
  if (auth_config.provider == "github") {
    done(null, user.username);
  } else if (auth_config.provider == "auth0") {
    let email = user.emails[0].value;
    done(null, email);
  }
});
passport.deserializeUser((obj: any, done) => {
  done(null, obj);
});

/**
 * Simple handlers for starting the login flow from the frontend, and handling
 * the response we get from GitHub/Auth0. Ultimately, after login, this just redirects
 * back into the fronend, because the backend doesn't actualy have any UI.
 */
app.get("/login", passport.authenticate(auth_config.provider, auth_config.params), () => { });
app.get("/callback", passport.authenticate(
  auth_config.provider,
  { ...auth_config.params, failureRedirect: "/login" }),
  (_req, res) => { res.redirect(process.env.FRONTEND_WEB_ROOT!); });

/**
 * Simple middleware to check if the authenticated user is one contained in the
 * allowlist. If not, it just returns a 401 response, and the frontend needs
 * to take care of more.
 */
function ensureAuth(req: Request, res: Response, next: NextFunction) {
  // For local development, it's easier if we don't have to deal with auth.
  if (process.env.SKIP_AUTH == "true") {
    return next();
  }

  // If authentication is enabled, make sure the authenticated user is
  // part of the allowlist. This is particularly important for general
  // auth providers like GitHub.
  if (req.user) {
    if (process.env.AUTH_ALLOWED_USERS!.split(",").includes(req.user as string)) {
      return next();
    } else {
      return endWithStatusAndBody(res, 403, "user not allowed");
    }
  }

  return endWithStatusAndBody(res, 401, "unauthorized");
}

/**
 * This middleware for /api/* has two important features:
 *
 * 1. It makes sure the response Content-Type is always set to json.
 * 2. It sets the correct CORS headers. As this backend sets a session cookie
 *    to handle user auth, we need to set Access-Control-Allow-Credentials to
 *    true. However, this means that we can't just set the origin to `*`, or
 *    that header won't work. So this middleware checks if the origin is either
 *    the set frontend URL, or one of configurable extra origins (for localhost
 *    development, for example)
 */
const ALLOWED_CORS_ORIGINS = [process.env.FRONTEND_WEB_ROOT, ...process.env.ADDITIONAL_CORS_ORIGINS!.split(",")];
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || ["/app/version.json", "/__version__"].includes(req.path)) {
    res.setHeader("Content-Type", "application/json");

    if (req.header("origin")) {
      const origin = req.header("origin")!.toLowerCase();
      if (ALLOWED_CORS_ORIGINS.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }
    }
  }

  next();
});

app.get("/api/user_reports.json", ensureAuth, async (req, res) => {
  return await handleUserReports(req, res);
});

app.post("/api/track_action.json", ensureAuth, async (req, res) => {
  return await handleTrackAction(req, res);
});

app.get(["/app/version.json", "/__version__"], (_req, res) => {
  // See https://github.com/mozilla-services/Dockerflow/blob/main/docs/version_object.md
  res.end(
    JSON.stringify({
      source: "https://github.com/webcompat/wckbng-dashboard",
      version: "ToDo",
      commit: "ToDo",
      build: "ToDo",
    }),
  );
});

app.get(["/__heartbeat__", "/__lbheartbeat__"], (_req, res) => {
  return res.end("success");
});

const listenPort = (process.env.LISTEN_PORT && parseInt(process.env.LISTEN_PORT)) || 3000;
const server = app.listen(listenPort, () => {
  console.log(`Listening to 0.0.0.0:${listenPort}`);
});

ViteExpress.bind(app, server);
