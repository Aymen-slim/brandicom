-- Migration: Add 'photoshoot' value to deliverable_format enum type
-- Run this in your Supabase SQL Editor to allow format = 'photoshoot' on deliverables.

ALTER TYPE public.deliverable_format ADD VALUE IF NOT EXISTS 'photoshoot';
