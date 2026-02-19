// AWS STS AssumeRole utility functions
// NEVER stores credentials - uses temporary credentials per request
// Credentials are read ONLY from environment variables

import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { S3Client, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Base AWS credentials from environment (for assuming roles)
// These should be configured in Vercel environment variables
const getBaseCredentials = () => {
  // AWS credentials MUST come from environment variables only
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set in environment variables"
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    region,
  };
};

// Assume an IAM role and return temporary credentials
// This is the core security mechanism - no long-term keys stored
export async function assumeRole(
  roleArn: string,
  externalId: string
): Promise<{
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
}> {
  const baseCreds = getBaseCredentials();
  const stsClient = new STSClient({
    credentials: {
      accessKeyId: baseCreds.accessKeyId,
      secretAccessKey: baseCreds.secretAccessKey,
    },
    region: baseCreds.region,
  });

  try {
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `s3-helper-${Date.now()}`,
      ExternalId: externalId,
      DurationSeconds: 3600, // 1 hour - adjust as needed
    });

    const response = await stsClient.send(command);

    if (!response.Credentials) {
      throw new Error("Failed to assume role: No credentials returned");
    }

    return {
      accessKeyId: response.Credentials.AccessKeyId!,
      secretAccessKey: response.Credentials.SecretAccessKey!,
      sessionToken: response.Credentials.SessionToken!,
      expiration: response.Credentials.Expiration!,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to assume role: ${errorMessage}`);
  }
}

// Create S3 client with temporary credentials from AssumeRole
export function createS3Client(credentials: {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region?: string;
}): S3Client {
  return new S3Client({
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
      sessionToken: credentials.sessionToken,
    },
    region: credentials.region || process.env.AWS_REGION || "us-east-1",
  });
}

// List all S3 buckets using temporary credentials
export async function listBuckets(credentials: {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region?: string;
}): Promise<Array<{ name: string; creationDate?: Date }>> {
  const s3Client = createS3Client(credentials);
  const command = new ListBucketsCommand({});

  try {
    const response = await s3Client.send(command);
    return (
      response.Buckets?.map((bucket) => ({
        name: bucket.Name!,
        creationDate: bucket.CreationDate,
      })) || []
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to list buckets: ${errorMessage}`);
  }
}

// List objects in a bucket
export async function listObjects(
  bucket: string,
  prefix?: string,
  maxKeys?: number,
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    region?: string;
  }
): Promise<{
  objects: Array<{
    key: string;
    size?: number;
    lastModified?: Date;
    etag?: string;
  }>;
  isTruncated: boolean;
  nextContinuationToken?: string;
}> {
  if (!credentials) {
    throw new Error("Credentials are required to list objects");
  }

  const s3Client = createS3Client(credentials);
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  try {
    const response = await s3Client.send(command);
    return {
      objects:
        response.Contents?.map((object) => ({
          key: object.Key!,
          size: object.Size,
          lastModified: object.LastModified,
          etag: object.ETag,
        })) || [],
      isTruncated: response.IsTruncated || false,
      nextContinuationToken: response.NextContinuationToken,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to list objects: ${errorMessage}`);
  }
}

// Generate presigned URL for PUT (upload) operations
// Browser uploads directly to S3, bypassing backend
export async function generatePresignedUploadUrl(
  bucket: string,
  key: string,
  contentType?: string,
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    region?: string;
  },
  expiresIn: number = 3600
): Promise<string> {
  if (!credentials) {
    throw new Error("Credentials are required to generate presigned URL");
  }

  const s3Client = createS3Client(credentials);
  const putCommand = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  try {
    const url = await getSignedUrl(s3Client, putCommand, { expiresIn });
    return url;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to generate presigned URL: ${errorMessage}`);
  }
}
