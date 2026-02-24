-- Make AwsConnection.roleArn nullable for pending connections
-- Update unique constraints to match schema:
--   @@unique([userId, externalId])
--   @@unique([userId, roleArn])

-- Drop old unique index created by initial migration
DROP INDEX IF EXISTS "AwsConnection_userId_roleArn_externalId_key";

-- Alter column to allow NULL
ALTER TABLE "AwsConnection" ALTER COLUMN "roleArn" DROP NOT NULL;

-- Add new unique constraints/indexes
CREATE UNIQUE INDEX IF NOT EXISTS "AwsConnection_userId_externalId_key"
ON "AwsConnection"("userId", "externalId");

CREATE UNIQUE INDEX IF NOT EXISTS "AwsConnection_userId_roleArn_key"
ON "AwsConnection"("userId", "roleArn");

