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
