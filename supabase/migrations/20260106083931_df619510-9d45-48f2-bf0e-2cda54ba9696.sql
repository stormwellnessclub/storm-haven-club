-- Add new category values to class_category enum
ALTER TYPE public.class_category ADD VALUE IF NOT EXISTS 'reformer';
ALTER TYPE public.class_category ADD VALUE IF NOT EXISTS 'cycling';
ALTER TYPE public.class_category ADD VALUE IF NOT EXISTS 'aerobics';