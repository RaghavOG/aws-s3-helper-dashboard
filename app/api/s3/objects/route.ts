// API route: GET /api/s3/objects?bucket=BUCKET_NAME&prefix=PREFIX&maxKeys=MAX
// Lists objects in an S3 bucket using temporary credentials from AssumeRole

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assumeRole, listObjects } from "@/lib/aws";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const bucket = searchParams.get("bucket");
    const prefix = searchParams.get("prefix") || undefined;
    const maxKeysParam = searchParams.get("maxKeys");
    const connectionId = searchParams.get("connectionId");
    const maxKeys = maxKeysParam ? parseInt(maxKeysParam, 10) : undefined;

    // Validate bucket parameter
    if (!bucket) {
      return NextResponse.json(
        { error: "bucket parameter is required" },
        { status: 400 }
      );
    }

    // Fetch AWS connection from database
    let connection;
    if (connectionId) {
      connection = await prisma.awsConnection.findFirst({
        where: {
          id: connectionId,
          userId: session.user.id,
        },
      });
    } else {
      // Use the most recent connection if no ID specified
      connection = await prisma.awsConnection.findFirst({
        where: {
          userId: session.user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    if (!connection) {
      return NextResponse.json(
        { error: "No AWS connection found. Please configure a connection first." },
        { status: 404 }
      );
    }

    // Assume role and get temporary credentials
    const credentials = await assumeRole(connection.roleArn, connection.externalId);

    // List objects using temporary credentials
    const result = await listObjects(bucket, prefix, maxKeys, credentials);

    return NextResponse.json({
      success: true,
      bucket,
      prefix: prefix || "",
      objects: result.objects,
      isTruncated: result.isTruncated,
      nextContinuationToken: result.nextContinuationToken,
      connection: {
        id: connection.id,
        name: connection.name,
      },
    });
  } catch (error) {
    console.error("Error in /api/s3/objects:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list objects", details: errorMessage },
      { status: 500 }
    );
  }
}
