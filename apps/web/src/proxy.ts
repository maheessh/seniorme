import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// UX-layer only: redirects unauthenticated visitors to /login. The real access check
// (which doesn't need Prisma either, since it's just JWT verification) also runs in
// `(app)/layout.tsx` on every request, since proxy/middleware isn't a security boundary.
const { auth } = NextAuth(authConfig);

export const proxy = auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
