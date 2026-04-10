-- Add comment content length constraint
ALTER TABLE public.comments 
ADD CONSTRAINT content_length CHECK (length(content) <= 500 AND length(trim(content)) > 0);

-- Add report reason length constraint  
ALTER TABLE public.reports
ADD CONSTRAINT reason_length CHECK (length(reason) <= 500 AND length(trim(reason)) > 0);