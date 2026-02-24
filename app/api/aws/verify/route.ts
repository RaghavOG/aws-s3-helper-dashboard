// API route: POST /api/aws/verify
// Verifies AWS IAM Role credentials via STS AssumeRole
// On success: persists AwsConnection to database
// Security: NEVER stores AWS access keys or secrets

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assumeRole, listBuckets } from "@/lib/aws";
import crypto from "node:crypto";

function generateExternalId(): string {
  return crypto.randomBytes(32).toString("base64url");
}

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

    const body: unknown = await request.json();
    const parsed = body as Partial<{
      roleArn: string;
      name: string;
      connectionId: string;
    }>;
    const { roleArn, name, connectionId } = parsed;

    // Validate input
    if (!roleArn) {
      return NextResponse.json(
        { error: "roleArn is required" },
        { status: 400 }
      );
    }

    // Validate roleArn format
    if (!roleArn.startsWith("arn:aws:iam::") || !roleArn.includes(":role/")) {
      return NextResponse.json(
        { error: "Invalid roleArn format. Expected: arn:aws:iam::ACCOUNT_ID:role/ROLE_NAME" },
        { status: 400 }
      );
    }

    // Fetch the stored External ID (service-generated). Never trust browser input for this.
    let connection = null as Awaited<ReturnType<typeof prisma.awsConnection.findFirst>> | null;
    if (connectionId) {
      connection = await prisma.awsConnection.findFirst({
        where: { id: connectionId, userId: session.user.id },
      });
    }
    if (!connection) {
      // Fallback: latest pending connection, else create one
      connection = await prisma.awsConnection.findFirst({
        where: { userId: session.user.id, roleArn: null },
        orderBy: { createdAt: "desc" },
      });
    }
    if (!connection) {
      connection = await prisma.awsConnection.create({
        data: {
          userId: session.user.id,
          externalId: generateExternalId(),
          roleArn: null,
          name: "Pending AWS connection",
        },
      });
    }

    // Step 1: Attempt to assume the role and verify access.
    // This validates that the role exists and the stored External ID is correct.
    let credentials;
    try {
      credentials = await assumeRole(roleArn, connection.externalId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to assume role:", errorMessage);
      return NextResponse.json(
        {
          error: "Failed to assume role",
          details: errorMessage,
        },
        { status: 403 }
      );
    }

    // Step 2: Verify S3 access by listing buckets
    // This ensures the role has at least read permissions
    try {
      await listBuckets(credentials);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to list buckets:", errorMessage);
      return NextResponse.json(
        {
          error: "Role assumed successfully but S3 access denied",
          details: errorMessage,
        },
        { status: 403 }
      );
    }

    // Step 3: Persist connection (only roleArn + externalId; NO credentials).
    // We update the pending connection with the verified roleArn.
    // If a connection for this (userId, roleArn) already exists, re-use it
    // and clean up the extra pending row instead of violating the unique constraint.
    const existingByRole = await prisma.awsConnection.findFirst({
      where: {
        userId: session.user.id,
        roleArn,
      },
    });

    if (existingByRole && existingByRole.id !== connection.id) {
      // We already have a verified connection for this role.
      // Delete the extra pending row (if it was pending) and use the existing one.
      if (connection.roleArn === null) {
        await prisma.awsConnection.delete({ where: { id: connection.id } });
      }
      connection = existingByRole;
    } else {
      connection = await prisma.awsConnection.update({
        where: { id: connection.id },
        data: {
          roleArn,
          name: name || connection.name,
        },
      });
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        roleArn: connection.roleArn ?? "",
        name: connection.name,
        createdAt: connection.createdAt,
      },
      message: "AWS connection verified and saved successfully",
    });
  } catch (error) {
    console.error("Error in /api/aws/verify:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}
