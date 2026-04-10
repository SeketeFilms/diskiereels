-- Add tags column to videos table for content categorization and discoverability
ALTER TABLE videos ADD COLUMN tags text[] DEFAULT ARRAY[]::text[];

-- Create index for faster tag searches
CREATE INDEX idx_videos_tags ON videos USING GIN(tags);

-- Add comment for documentation
COMMENT ON COLUMN videos.tags IS 'Array of hashtags/tags for video categorization and search';