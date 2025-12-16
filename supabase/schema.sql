-- RVNZCOMM Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    profile_picture_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read all users (for displaying names in chat)
CREATE POLICY "Users can view all users"
    ON users FOR SELECT
    USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- Messages table with TTL (Time To Live)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_user_id_idx ON messages(user_id);

-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read messages
CREATE POLICY "Authenticated users can view messages"
    ON messages FOR SELECT
    USING (auth.role() = 'authenticated');

-- Users can insert their own messages
CREATE POLICY "Users can insert own messages"
    ON messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own messages
CREATE POLICY "Users can delete own messages"
    ON messages FOR DELETE
    USING (auth.uid() = user_id);

-- Function to delete old messages (older than 3 days)
CREATE OR REPLACE FUNCTION delete_old_messages()
RETURNS void AS $$
BEGIN
    DELETE FROM messages
    WHERE created_at < NOW() - INTERVAL '3 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a scheduled job to run daily (Supabase cron extension required)
-- Note: You need to enable pg_cron extension in Supabase dashboard
-- Alternatively, you can call this function manually or via an edge function

-- Storage bucket for profile pictures
-- Run this in Supabase Storage section or via SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public can view profile pictures"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-pictures');

CREATE POLICY "Authenticated users can upload profile pictures"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'profile-pictures' 
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = 'avatars'
    );

CREATE POLICY "Users can update own profile pictures"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'profile-pictures'
        AND auth.role() = 'authenticated'
    );

CREATE POLICY "Users can delete own profile pictures"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'profile-pictures'
        AND auth.role() = 'authenticated'
    );

-- Trigger to automatically delete messages older than 3 days
-- This runs every time a new message is inserted
CREATE OR REPLACE FUNCTION auto_delete_old_messages()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete messages older than 3 days
    DELETE FROM messages
    WHERE created_at < NOW() - INTERVAL '3 days';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_delete_old_messages
    AFTER INSERT ON messages
    FOR EACH STATEMENT
    EXECUTE FUNCTION auto_delete_old_messages();

-- Optional: Create a manual function to clean up messages
-- You can call this from your application or set up a cron job
CREATE OR REPLACE FUNCTION cleanup_messages()
RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
    count BIGINT;
BEGIN
    WITH deleted AS (
        DELETE FROM messages
        WHERE created_at < NOW() - INTERVAL '3 days'
        RETURNING *
    )
    SELECT COUNT(*) INTO count FROM deleted;
    
    RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
