-- Migration: Add powerbi_frame to content_type enum
-- Run this in the Supabase SQL Editor

ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'powerbi_frame';
