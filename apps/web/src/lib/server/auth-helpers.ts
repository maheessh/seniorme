import { prisma } from "@ccc/db";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// Server Components/Actions that need the signed-in user's id call this instead of
// `auth()` directly — it fails closed (redirects to /sign-in) rather than letting a
// caller forget to check `session?.user` and silently query with an undefined id.
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/sign-in");
  }
  return session.user.id;
}

/** True if the signed-in user is an admin. Reads from the DB (not the JWT) so an
 * allowlist promotion takes effect immediately, without a fresh token. Returns false when
 * signed out rather than redirecting — callers that need to gate use requireAdmin. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  return user?.isAdmin ?? false;
}

/** Gate for /admin routes and admin-only actions. Redirects non-admins to the dashboard
 * (a signed-out user is bounced to sign-in first). Returns the admin's user id. */
export async function requireAdmin(): Promise<string> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) {
    redirect("/dashboard");
  }
  return userId;
}
