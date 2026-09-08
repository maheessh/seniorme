import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { getUnreadNotificationCount } from "@/lib/server/services/notifications";

// Segment config is inherited by every nested layout/page. auth()'s cookie read below
// already forces this whole subtree to render dynamically as a side effect, but keeping
// this explicit means a future refactor that changes how the session is read can't
// quietly regress a page under (app)/ into build-time static optimization.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/sign-in");
  }

  const unreadNotificationCount = await getUnreadNotificationCount(session.user.id);

  return (
    <div className="flex h-screen w-full">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Sidebar unreadNotificationCount={unreadNotificationCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={session.user.email ?? ""} />
        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
