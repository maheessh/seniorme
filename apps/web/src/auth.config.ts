import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

// Edge-safe half of the auth config. Middleware runs on the Edge runtime, which can't
// load node-postgres (used by @ccc/db's Prisma driver adapter) — so this file must never
// import `@ccc/db`. The full setup (PrismaAdapter, session/jwt callbacks) lives in
// `auth.ts`, which is only ever imported from Node-runtime route handlers/server components.
export const authConfig = {
  // Auth.js only auto-trusts the request Host header in development — in production it
  // rejects every request with "UntrustedHost" unless told otherwise. Every deployment of
  // this app is a single, known origin (not a multi-tenant service routing arbitrary
  // external hosts to it), so trusting the host it's actually deployed behind is the
  // standard, correct choice here — see https://errors.authjs.dev#untrustedhost.
  trustHost: true,
  pages: { signIn: "/sign-in" },
  // GitHub is optional — only registered once its OAuth app credentials exist, so the app
  // works with Google alone until (if ever) a GitHub app is set up.
  providers: [
    Google,
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET ? [GitHub] : []),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnSignIn = request.nextUrl.pathname.startsWith("/sign-in");

      if (isOnSignIn) {
        return isLoggedIn ? Response.redirect(new URL("/dashboard", request.nextUrl)) : true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
