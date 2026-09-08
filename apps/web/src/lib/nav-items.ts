import {
  BarChart3,
  Bell,
  Building2,
  FolderKanban,
  Inbox,
  Kanban,
  LayoutDashboard,
  LifeBuoy,
  Target,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

// Appended to the nav only for admins (see Sidebar). Separate from NAV_ITEMS so a non-admin
// never even receives it in their rendered markup.
export const ADMIN_NAV_ITEM = {
  href: "/admin/scraper-requests",
  label: "Scraper requests",
  icon: LifeBuoy,
};
