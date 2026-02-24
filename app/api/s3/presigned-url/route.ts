// API route: POST /api/s3/presigned-url
// Generates presigned URL for direct browser-to-S3 uploads
// Browser uploads directly to S3, bypassing backend (no proxy)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assumeRole, generatePresignedUploadUrl } from "@/lib/aws";

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { bucket, key, contentType, connectionId, expiresIn } = body;

    // Validate required parameters
    if (!bucket || !key) {
      return NextResponse.json(
        { error: "bucket and key are required" },
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

    if (!connection.roleArn) {
      return NextResponse.json(
        { error: "AWS connection is not verified yet. Please paste a Role ARN and click Verify & Connect." },
        { status: 409 }
      );
    }

    // Assume role and get temporary credentials
    const credentials = await assumeRole(connection.roleArn, connection.externalId);

    // Generate presigned URL (valid for 1 hour by default)
    const url = await generatePresignedUploadUrl(
      bucket,
      key,
      contentType,
      credentials,
      expiresIn || 3600
    );

    return NextResponse.json({
      success: true,
      url,
      bucket,
      key,
      expiresIn: expiresIn || 3600,
    });
  } catch (error) {
    console.error("Error in /api/s3/presigned-url:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate presigned URL", details: errorMessage },
      { status: 500 }
    );
  }
}
