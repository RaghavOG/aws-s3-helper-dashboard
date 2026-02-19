"use client";

// Page for viewing objects in a specific bucket
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface S3Object {
  key: string;
  size?: number;
  lastModified?: Date;
  etag?: string;
}

interface ObjectsResponse {
  success: boolean;
  bucket: string;
  objects: S3Object[];
  isTruncated: boolean;
  error?: string;
  details?: string;
}

export default function BucketPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const bucket = params.bucket as string;
  const [objects, setObjects] = useState<S3Object[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session && bucket) {
      fetchObjects();
    }
  }, [session, bucket]);

  const fetchObjects = async () => {
    if (!bucket) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/s3/objects?bucket=${encodeURIComponent(bucket)}`);
      const data: ObjectsResponse = await response.json();

      if (!response.ok) {
        setError(data.error || data.details || "Failed to fetch objects");
        setObjects([]);
        return;
      }

      setObjects(data.objects || []);
    } catch (err) {
      setError("An unexpected error occurred");
      setObjects([]);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-zinc-600 dark:text-zinc-400">Please sign in.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              ← Back to Buckets
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Bucket: {bucket}
          </h1>
          <button
            onClick={fetchObjects}
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          {loading && objects.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">Loading objects...</p>
          ) : objects.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400">No objects found.</p>
          ) : (
            <div className="space-y-2">
              {objects.map((object) => (
                <div
                  key={object.key}
                  className="flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {object.key}
                    </p>
                    <div className="mt-1 flex gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                      {object.size !== undefined && (
                        <span>
                          Size: {(object.size / 1024).toFixed(2)} KB
                        </span>
                      )}
                      {object.lastModified && (
                        <span>
                          Modified: {new Date(object.lastModified).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
