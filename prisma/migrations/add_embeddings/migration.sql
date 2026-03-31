-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Order table
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding column to User table
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- HNSW indexes for fast approximate nearest-neighbor search (cosine distance)
CREATE INDEX IF NOT EXISTS order_embedding_idx ON "Order" USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS user_embedding_idx  ON "User"  USING hnsw (embedding vector_cosine_ops);
