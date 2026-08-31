import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="hero-surface flex min-h-screen items-center justify-center p-6">
      <div className="glass-panel w-full max-w-sm rounded-2xl p-8 shadow-xl">
        <h1 className="font-display text-2xl">Command Center</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Sign in to your career &amp; senior-year command center.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
