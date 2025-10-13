-- Create UserService junction table for many-to-many relationship
CREATE TABLE "UserService" (
    "id" SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE,
    UNIQUE("userId", "serviceId")
);

-- Create indexes for better performance
CREATE INDEX "UserService_userId_idx" ON "UserService"("userId");
CREATE INDEX "UserService_serviceId_idx" ON "UserService"("serviceId");

-- Migrate existing serviceId data to the new table
INSERT INTO "UserService" ("userId", "serviceId", "notificationsEnabled")
SELECT id, "serviceId", true
FROM "User"
WHERE "serviceId" IS NOT NULL;

-- Remove the old serviceId column (we'll do this in a separate migration to be safe)
-- ALTER TABLE "User" DROP COLUMN "serviceId";
