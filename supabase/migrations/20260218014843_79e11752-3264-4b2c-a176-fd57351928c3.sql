-- Enable realtime for email_conversations and email_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_messages;