// API route: POST /api/aws/verify
// Verifies AWS IAM Role credentials via STS AssumeRole
// On success: persists AwsConnection to database
// Security: NEVER stores AWS access keys or secrets

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assumeRole, listBuckets } from "@/lib/aws";

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
    const { roleArn, externalId, name } = body;

    // Validate input
    if (!roleArn || !externalId) {
      return NextResponse.json(
        { error: "roleArn and externalId are required" },
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

    // Step 1: Attempt to assume the role and verify access
    // This validates that the role exists and externalId is correct
    let credentials;
    try {
      credentials = await assumeRole(roleArn, externalId);
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

    // Step 3: Persist connection (only roleArn and externalId - NO credentials)
    // Check if connection already exists
    const existingConnection = await prisma.awsConnection.findFirst({
      where: {
        userId: session.user.id,
        roleArn,
        externalId,
      },
    });

    let connection;
    if (existingConnection) {
      // Update existing connection
      connection = await prisma.awsConnection.update({
        where: { id: existingConnection.id },
        data: {
          name: name || existingConnection.name,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new connection
      connection = await prisma.awsConnection.create({
        data: {
          userId: session.user.id,
          roleArn,
          externalId,
          name: name || `AWS Connection ${new Date().toLocaleDateString()}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      connection: {
        id: connection.id,
        roleArn: connection.roleArn,
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
