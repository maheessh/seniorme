import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { getUnreadNotificationCount } from "@/lib/server/services/notifications";

// Segment config is inherited by every nested layout/page. Previously the auth() session check
// here read cookies on every request, which forced this whole subtree to render dynamically as
// a side effect. With that gone, any page under (app)/ that doesn't itself read searchParams
// (dashboard, analytics, notifications) becomes eligible for Next's static optimization —
// meaning a production build would freeze its data (and this layout's own unread-count query)
// at build time instead of querying fresh per request. Forcing it here once, rather than on
// each individual page, means a future new page under (app)/ can't quietly regress into this.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const unreadNotificationCount = await getUnreadNotificationCount();

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
        <Topbar />
        <main id="main-content" className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
