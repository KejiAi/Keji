-- Migration: Add chunking support to Message model
-- Date: 2025-11-02
-- Description: Adds fields to support message chunking for streaming responses

-- Add new columns to Message table
ALTER TABLE message 
ADD COLUMN message_group_id VARCHAR(36),
ADD COLUMN chunk_index INTEGER,
ADD COLUMN total_chunks INTEGER;

-- Add index for efficient chunk retrieval
CREATE INDEX idx_message_group_id ON message(message_group_id);

-- Note: These columns are nullable to maintain backward compatibility
-- with existing messages that were not chunked

