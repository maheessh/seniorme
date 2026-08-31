import { CommandPalette } from "@/components/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-end border-b border-border px-6">
      <div className="flex items-center gap-1">
        <CommandPalette />
        <ThemeToggle />
      </div>
    </header>
  );
}
