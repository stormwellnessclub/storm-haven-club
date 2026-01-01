-- Create conversation status enum
CREATE TYPE public.conversation_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Create message sender type enum
CREATE TYPE public.message_sender_type AS ENUM ('member', 'staff');

-- Create email_conversations table
CREATE TABLE public.email_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject TEXT NOT NULL,
  status conversation_status NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_messages table
CREATE TABLE public.email_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.email_conversations(id) ON DELETE CASCADE,
  sender_type message_sender_type NOT NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  message_body TEXT NOT NULL,
  resend_message_id TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.email_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_conversations
CREATE POLICY "Users can view their own conversations"
ON public.email_conversations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all conversations"
ON public.email_conversations
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can manage all conversations"
ON public.email_conversations
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can create conversations"
ON public.email_conversations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS policies for email_messages
CREATE POLICY "Users can view messages in their conversations"
ON public.email_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.email_conversations 
    WHERE id = email_messages.conversation_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Staff can view all messages"
ON public.email_messages
FOR SELECT
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role, 'front_desk'::app_role]));

CREATE POLICY "Staff can manage all messages"
ON public.email_messages
FOR ALL
USING (has_any_role(auth.uid(), ARRAY['super_admin'::app_role, 'admin'::app_role, 'manager'::app_role]));

CREATE POLICY "Users can send messages to their conversations"
ON public.email_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.email_conversations 
    WHERE id = email_messages.conversation_id 
    AND user_id = auth.uid()
  )
);

-- Add index for faster lookups
CREATE INDEX idx_email_conversations_user_id ON public.email_conversations(user_id);
CREATE INDEX idx_email_conversations_status ON public.email_conversations(status);
CREATE INDEX idx_email_messages_conversation_id ON public.email_messages(conversation_id);

-- Add trigger for updated_at
CREATE TRIGGER update_email_conversations_updated_at
BEFORE UPDATE ON public.email_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();