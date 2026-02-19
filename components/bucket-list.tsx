"use client";

// Component for listing and displaying S3 buckets
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Bucket {
  name: string;
  creationDate?: Date;
}

interface BucketListResponse {
  success: boolean;
  buckets: Bucket[];
  connection?: {
    id: string;
    name: string;
    roleArn: string;
  };
  error?: string;
  details?: string;
}

export function BucketList() {
  const { data: session } = useSession();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [connectionInfo, setConnectionInfo] = useState<{
    id: string;
    name: string;
    roleArn: string;
  } | null>(null);

  const fetchBuckets = async () => {
    if (!session) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/s3/buckets");
      const data: BucketListResponse = await response.json();

      if (!response.ok) {
        setError(data.error || data.details || "Failed to fetch buckets");
        setBuckets([]);
        return;
      }

      setBuckets(data.buckets || []);
      if (data.connection) {
        setConnectionInfo(data.connection);
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setBuckets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchBuckets();
    }
  }, [session]);

  if (!session) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          Please sign in to view buckets.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          S3 Buckets
        </h2>
        <button
          onClick={fetchBuckets}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {connectionInfo && (
        <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm dark:bg-blue-900/20">
          <p className="font-medium text-blue-900 dark:text-blue-300">
            Connected via: {connectionInfo.name}
          </p>
          <p className="mt-1 font-mono text-xs text-blue-700 dark:text-blue-400">
            {connectionInfo.roleArn}
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {loading && buckets.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">Loading buckets...</p>
      ) : buckets.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          No buckets found. Make sure your IAM role has S3 read permissions.
        </p>
      ) : (
        <div className="space-y-2">
          {buckets.map((bucket) => (
            <div
              key={bucket.name}
              className="flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {bucket.name}
                </p>
                {bucket.creationDate && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Created: {new Date(bucket.creationDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <a
                href={`/buckets/${encodeURIComponent(bucket.name)}`}
                className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
