import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { getUnreadNotificationCount } from "@/lib/server/services/notifications";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const unreadNotificationCount = await getUnreadNotificationCount();

  return (
    <div className="flex h-screen w-full">
      <Sidebar unreadNotificationCount={unreadNotificationCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar email={session.user.email ?? ""} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
