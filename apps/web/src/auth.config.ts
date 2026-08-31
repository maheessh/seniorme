import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Edge-safe half of the auth config. Middleware runs on the Edge runtime, which can't
// load node-postgres (used by @ccc/db's Prisma driver adapter) — so this file must never
// import `@ccc/db` or `bcryptjs`. The real `authorize()` that checks the database lives in
// `auth.ts`, which is only ever imported from Node-runtime route handlers/server actions.
export const authConfig = {
  // Auth.js only auto-trusts the request Host header in development — in production it
  // rejects every request with "UntrustedHost" unless told otherwise. This app is
  // self-hosted for a single user (not a multi-tenant service routing arbitrary external
  // hosts to it), so trusting the host it's actually deployed behind is the standard,
  // correct choice here — see https://errors.authjs.dev#untrustedhost.
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async () => null,
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = request.nextUrl.pathname.startsWith("/login");

      if (isOnLogin) {
        return isLoggedIn ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }

      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
