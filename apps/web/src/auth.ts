import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@ccc/db";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

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
});
