// API route: GET /api/aws/bootstrap
// Ensures the user has an AwsConnection row with a service-generated External ID.
// Returns the External ID to display read-only in the UI.

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

function generateExternalId(): string {
  // Unpredictable, URL-safe, high-entropy token (stable once stored)
  return crypto.randomBytes(32).toString("base64url");
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Prefer the most recently created *pending* connection (roleArn is null),
    // otherwise create one.
    let connection = await prisma.awsConnection.findFirst({
      where: { userId: session.user.id, roleArn: null },
      orderBy: { createdAt: "desc" },
    });

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

    return NextResponse.json({
      success: true,
      connectionId: connection.id,
      externalId: connection.externalId,
    });
  } catch (error) {
    console.error("Error in /api/aws/bootstrap:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to bootstrap AWS connection", details: message },
      { status: 500 }
    );
  }
}

