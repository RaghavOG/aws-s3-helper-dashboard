// API route: GET /api/s3/buckets
// Lists S3 buckets using temporary credentials from AssumeRole
// Credentials are fetched dynamically from database and assumed per request

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assumeRole, listBuckets } from "@/lib/aws";

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

    // Get connectionId from query params (optional - uses first if not specified)
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get("connectionId");

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

    if (!connection.roleArn) {
      return NextResponse.json(
        { error: "AWS connection is not verified yet. Please paste a Role ARN and click Verify & Connect." },
        { status: 409 }
      );
    }

    // Assume role and get temporary credentials
    // This happens on EVERY request - no credentials stored
    const credentials = await assumeRole(connection.roleArn, connection.externalId);

    // List buckets using temporary credentials
    const buckets = await listBuckets(credentials);

    return NextResponse.json({
      success: true,
      buckets,
      connection: {
        id: connection.id,
        name: connection.name,
        roleArn: connection.roleArn,
      },
    });
  } catch (error) {
    console.error("Error in /api/s3/buckets:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to list buckets", details: errorMessage },
      { status: 500 }
    );
  }
}
