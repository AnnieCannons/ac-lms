-- STEP 1: Run this first, by itself.
-- PostgreSQL requires enum value additions to be committed before they can be used.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
