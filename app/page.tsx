"use client";

// Main dashboard page
import { useSession, signOut } from "next-auth/react";
import { AwsConnectionForm } from "@/components/aws-connection-form";
import { BucketList } from "@/components/bucket-list";
import { useEffect, useState } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleConnectionSuccess = () => {
    // Trigger refresh of bucket list
    setRefreshKey((prev) => prev + 1);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-2xl rounded-lg border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <h1 className="mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            S3 Helper
          </h1>
          <p className="mb-6 text-zinc-600 dark:text-zinc-400">
            Secure AWS S3 dashboard using STS AssumeRole. No AWS credentials stored.
          </p>
          <div className="flex gap-4">
            <a
              href="/auth/signin"
              className="rounded-md bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
            >
              Sign In
            </a>
            <a
              href="/auth/signup"
              className="rounded-md border border-zinc-300 px-6 py-3 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Sign Up
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              S3 Helper
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <AwsConnectionForm key={refreshKey} onSuccess={handleConnectionSuccess} />
          <BucketList key={`bucket-list-${refreshKey}`} />
        </div>
      </main>
    </div>
  );
}
