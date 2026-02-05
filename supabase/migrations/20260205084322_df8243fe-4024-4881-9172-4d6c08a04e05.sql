-- Add column to track when activation email was last sent
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS activation_email_sent_at timestamptz;

COMMENT ON COLUMN members.activation_email_sent_at IS 'Timestamp when the member activation setup email was last sent';