import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@ccc/db";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Comma-separated allowlist of emails that should have admin access. Admin status is derived
// from config rather than hand-edited in the DB, so a fresh production account becomes admin
// on its first sign-in without a manual migration.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      const uid = token.uid as string | undefined;
      if (session.user && uid) session.user.id = uid;
      return session;
    },
  },
  events: {
    // Runs after a successful sign-in (Node runtime, so Prisma is available). Promotes any
    // allowlisted email to admin, idempotently — admin checks read isAdmin from the DB, so the
    // promotion takes effect on the very next request without needing a fresh token.
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (email && ADMIN_EMAILS.has(email) && user.id) {
        await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } }).catch(() => {});
      }
    },
  },
});
