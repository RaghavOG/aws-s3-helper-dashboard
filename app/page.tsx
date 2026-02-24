"use client";

import { useSession, signOut } from "next-auth/react";
import { AwsConnectionForm } from "@/components/aws-connection-form";
import { BucketList } from "@/components/bucket-list";
import { useState } from "react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Cloud, ShieldCheck } from "lucide-react";

export default function Home() {
  const { data: session, status } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleConnectionSuccess = () => {
    setRefreshKey((prev) => prev + 1);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading dashboard…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold tracking-tight">
                S3 Helper
              </span>
            </div>
            <ModeToggle />
          </div>

          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Secure S3 dashboard
              </CardTitle>
              <CardDescription>
                STS AssumeRole, zero long-term keys stored, principle of least
                privilege by design.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create an account to connect AWS via a cross-account IAM role.
                We generate a secure External ID and use temporary credentials
                only.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <a href="/auth/signin">Sign In</a>
                </Button>
                <Button asChild variant="outline">
                  <a href="/auth/signup">Create Account</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-primary" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight">
                S3 Helper
              </span>
              <span className="text-xs text-muted-foreground">
                Secure S3 dashboard
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {session.user?.email}
            </span>
            <ModeToggle />
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="text-xs sm:text-sm"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <AwsConnectionForm
            key={refreshKey}
            onSuccess={handleConnectionSuccess}
          />
          <BucketList key={`bucket-list-${refreshKey}`} />
        </section>
      </main>
    </div>
  );
}

