-- Rename Service table to Category
ALTER TABLE "Service" RENAME TO "Category";

-- Rename ServiceFeature table to CategoryFeature
ALTER TABLE "ServiceFeature" RENAME TO "CategoryFeature";

-- Rename ServiceTechnology table to CategoryTechnology
ALTER TABLE "ServiceTechnology" RENAME TO "CategoryTechnology";

-- Rename UserService table to UserCategory
ALTER TABLE "UserService" RENAME TO "UserCategory";

-- Rename columns in CategoryFeature
ALTER TABLE "CategoryFeature" RENAME COLUMN "serviceId" TO "categoryId";

-- Rename columns in CategoryTechnology
ALTER TABLE "CategoryTechnology" RENAME COLUMN "serviceId" TO "categoryId";

-- Rename columns in UserCategory
ALTER TABLE "UserCategory" RENAME COLUMN "serviceId" TO "categoryId";

-- Rename column in Order table
ALTER TABLE "Order" RENAME COLUMN "serviceId" TO "categoryId";

-- Rename indexes
ALTER INDEX "Service_pkey" RENAME TO "Category_pkey";
ALTER INDEX "ServiceFeature_pkey" RENAME TO "CategoryFeature_pkey";
ALTER INDEX "ServiceTechnology_pkey" RENAME TO "CategoryTechnology_pkey";
ALTER INDEX "UserService_pkey" RENAME TO "UserCategory_pkey";

-- Rename unique constraints
ALTER TABLE "CategoryFeature" RENAME CONSTRAINT "ServiceFeature_serviceId_featureId_key" TO "CategoryFeature_categoryId_featureId_key";
ALTER TABLE "CategoryTechnology" RENAME CONSTRAINT "ServiceTechnology_serviceId_technologyId_key" TO "CategoryTechnology_categoryId_technologyId_key";
ALTER TABLE "UserCategory" RENAME CONSTRAINT "UserService_userId_serviceId_key" TO "UserCategory_userId_categoryId_key";

-- Rename foreign key constraints (these may need to be adjusted based on your actual constraint names)
-- Note: PostgreSQL constraint names may vary, you may need to check actual constraint names first
-- ALTER TABLE "CategoryFeature" RENAME CONSTRAINT "ServiceFeature_serviceId_fkey" TO "CategoryFeature_categoryId_fkey";
-- ALTER TABLE "CategoryTechnology" RENAME CONSTRAINT "ServiceTechnology_serviceId_fkey" TO "CategoryTechnology_categoryId_fkey";
-- ALTER TABLE "UserCategory" RENAME CONSTRAINT "UserService_serviceId_fkey" TO "UserCategory_categoryId_fkey";
-- ALTER TABLE "Order" RENAME CONSTRAINT "Order_serviceId_fkey" TO "Order_categoryId_fkey";

-- Rename relation constraint for Category self-reference
-- ALTER TABLE "Category" RENAME CONSTRAINT "ServiceChildren" TO "CategoryChildren";
