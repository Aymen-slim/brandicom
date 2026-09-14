-- Migration: Add 'ad' value to deliverable_format enum type
-- Run this in your Supabase SQL Editor to allow direct storage of format = 'ad' in the deliverables table.

ALTER TYPE public.deliverable_format ADD VALUE IF NOT EXISTS 'ad';
