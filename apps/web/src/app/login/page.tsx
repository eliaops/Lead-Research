"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[hsl(222,47%,6%)]">
        <div className="grid-pattern absolute inset-0" />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <circle cx="11" cy="14" r="3" />
                <path d="m14 17 2 2" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">BidToGo</span>
          </div>

          {/* Hero text */}
          <div className="max-w-lg">
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Procurement Intelligence<br />
              <span className="text-blue-400">for North America</span>
            </h1>
            <p className="mt-4 text-base text-slate-400 leading-relaxed">
              Discover, analyze, and pursue public tender opportunities across Canada and the United States. AI-powered bid analysis for window covering and textile professionals.
            </p>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-3 gap-6">
              <div>
                <div className="text-2xl font-bold text-white text-tabular">300+</div>
                <div className="text-xs text-slate-500 mt-0.5">Public Sources</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white text-tabular">2,000+</div>
                <div className="text-xs text-slate-500 mt-0.5">Weekly Opportunities</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white text-tabular">AI</div>
                <div className="text-xs text-slate-500 mt-0.5">Bid Analysis</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-xs text-slate-600">
            &copy; {new Date().getFullYear()} BidToGo. Internal use only.
          </div>
        </div>

        {/* Decorative gradient */}
        <div className="absolute -right-32 top-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute -left-16 bottom-0 w-[300px] h-[300px] rounded-full bg-blue-600/5 blur-3xl" />
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col justify-center px-6 sm:px-12 lg:px-16 bg-background">
        {/* Mobile brand header */}
        <div className="lg:hidden mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <circle cx="11" cy="14" r="3" />
                <path d="m14 17 2 2" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">BidToGo</span>
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto lg:mx-0">
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Enter your credentials to access the dashboard
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="admin@sunnyshutter.ca"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>
            <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-8 text-xs text-muted-foreground">
            Internal access only. Contact your administrator for credentials.
          </p>
        </div>
      </div>
    </div>
  );
}
