"use client";

// Form component for connecting AWS account via IAM Role
import { useEffect, useMemo, useState, FormEvent } from "react";

interface AwsConnectionFormProps {
  onSuccess?: () => void;
}

export function AwsConnectionForm({ onSuccess }: AwsConnectionFormProps) {
  const [roleArn, setRoleArn] = useState("");
  const [externalId, setExternalId] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const canSubmit = useMemo(() => {
    return Boolean(roleArn && externalId && connectionId);
  }, [roleArn, externalId, connectionId]);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const res = await fetch("/api/aws/bootstrap");
        const data = (await res.json()) as
          | { success: true; connectionId: string; externalId: string }
          | { error: string };

        if (!res.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Failed to bootstrap");
        }

        if (!cancelled) {
          setExternalId(data.externalId);
          setConnectionId(data.connectionId);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load External ID";
        if (!cancelled) setError(msg);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const response = await fetch("/api/aws/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleArn,
          name: name || undefined,
          connectionId: connectionId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || data.details || "Failed to verify AWS connection");
        return;
      }

      setSuccess(true);
      setRoleArn("");
      setName("");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Connect AWS Account
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Use this External ID while creating the IAM Role in AWS. Do not modify it.
        No AWS credentials are stored — we use temporary credentials via STS AssumeRole.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="externalId"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            External ID (read-only)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="externalId"
              type="text"
              value={externalId ?? "Loading..."}
              readOnly
              className="block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm shadow-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={async () => {
                if (!externalId) return;
                await navigator.clipboard.writeText(externalId);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              disabled={!externalId}
              className="shrink-0 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            The service generates and manages this External ID to prevent confused deputy attacks.
          </p>
        </div>
        <div>
          <label
            htmlFor="roleArn"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            IAM Role ARN *
          </label>
          <input
            id="roleArn"
            type="text"
            value={roleArn}
            onChange={(e) => setRoleArn(e.target.value)}
            placeholder="arn:aws:iam::123456789012:role/MyRole"
            required
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Connection Name (optional)
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Production AWS Account"
            className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50"
          />
        </div>
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-400">
            AWS connection verified and saved successfully!
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {loading ? "Verifying..." : "Verify & Connect"}
        </button>
      </form>
    </div>
  );
}
