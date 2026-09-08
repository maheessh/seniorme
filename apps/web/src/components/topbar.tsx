import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(app)/actions";
import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export function Topbar({ email }: { email: string }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
      <span className="text-sm text-muted-foreground">{email}</span>
      <div className="flex items-center gap-1">
        <CommandPalette />
        <ThemeToggle />
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  );
}
