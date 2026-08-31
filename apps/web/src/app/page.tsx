import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// No metadata export here — the root layout's default title ("Senior Me") already applies
// cleanly; setting one here would run through the parent's "%s · Senior Me" template and
// produce "Senior Me · Senior Me".
export default function LandingPage() {
  return (
    <div className="hero-surface flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-8 text-center shadow-xl">
        <h1 className="font-display text-3xl">Senior Me</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          Your personal career &amp; senior-year command center — companies, applications, and
          projects, all in one place.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/dashboard">
            Enter <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
