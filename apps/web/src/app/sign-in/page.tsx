import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { signInWithGitHub, signInWithGoogle } from "./actions";
import { GitHubIcon, GoogleIcon } from "./oauth-icons";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="hero-surface flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-8 text-center shadow-xl">
        <h1 className="font-display text-2xl">Senior Me</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Sign in to your career &amp; senior-year command center.
        </p>
        <div className="flex flex-col gap-3">
          <form action={signInWithGoogle}>
            <Button type="submit" variant="outline" size="lg" className="w-full">
              <GoogleIcon /> Continue with Google
            </Button>
          </form>
          <form action={signInWithGitHub}>
            <Button type="submit" variant="outline" size="lg" className="w-full">
              <GitHubIcon /> Continue with GitHub
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
