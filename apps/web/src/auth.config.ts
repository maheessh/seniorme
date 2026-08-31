import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Edge-safe half of the auth config. Middleware runs on the Edge runtime, which can't
// load node-postgres (used by @ccc/db's Prisma driver adapter) — so this file must never
// import `@ccc/db` or `bcryptjs`. The real `authorize()` that checks the database lives in
// `auth.ts`, which is only ever imported from Node-runtime route handlers/server actions.
export const authConfig = {
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
