-- Performance: evaluate auth/role checks once per statement instead of once per row,
-- and remove duplicate permissive SELECT policies. Access semantics are unchanged.

-- ============ email_conversations ============
DROP POLICY IF EXISTS "Staff can manage all conversations" ON public.email_conversations;
DROP POLICY IF EXISTS "Staff can view all conversations" ON public.email_conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.email_conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.email_conversations;

CREATE POLICY "Staff can view all conversations"
ON public.email_conversations FOR SELECT
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager','front_desk']::app_role[])));

CREATE POLICY "Users can view their own conversations"
ON public.email_conversations FOR SELECT
USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can create conversations"
ON public.email_conversations FOR INSERT
WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Staff can insert conversations"
ON public.email_conversations FOR INSERT
WITH CHECK ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])));

CREATE POLICY "Staff can update conversations"
ON public.email_conversations FOR UPDATE
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])))
WITH CHECK ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])));

CREATE POLICY "Staff can delete conversations"
ON public.email_conversations FOR DELETE
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])));

-- ============ email_messages ============
DROP POLICY IF EXISTS "Staff can manage all messages" ON public.email_messages;
DROP POLICY IF EXISTS "Staff can view all messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.email_messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.email_messages;

CREATE POLICY "Staff can view all messages"
ON public.email_messages FOR SELECT
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager','front_desk']::app_role[])));

CREATE POLICY "Users can view messages in their conversations"
ON public.email_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.email_conversations c
  WHERE c.id = email_messages.conversation_id AND c.user_id = (SELECT auth.uid())
));

CREATE POLICY "Users can send messages to their conversations"
ON public.email_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.email_conversations c
  WHERE c.id = email_messages.conversation_id AND c.user_id = (SELECT auth.uid())
));

CREATE POLICY "Staff can insert messages"
ON public.email_messages FOR INSERT
WITH CHECK ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])));

CREATE POLICY "Staff can update messages"
ON public.email_messages FOR UPDATE
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])))
WITH CHECK ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])));

CREATE POLICY "Staff can delete messages"
ON public.email_messages FOR DELETE
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager']::app_role[])));

-- ============ check_ins ============
DROP POLICY IF EXISTS "Staff can manage check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Staff can view all check-ins" ON public.check_ins;
DROP POLICY IF EXISTS "Staff can view check_ins" ON public.check_ins;
DROP POLICY IF EXISTS "Staff can update check_ins" ON public.check_ins;
DROP POLICY IF EXISTS "Staff can create check_ins" ON public.check_ins;
DROP POLICY IF EXISTS "Members can view own check-ins" ON public.check_ins;

CREATE POLICY "Staff can view all check-ins"
ON public.check_ins FOR SELECT
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager','front_desk']::app_role[])));

CREATE POLICY "Members can view own check-ins"
ON public.check_ins FOR SELECT
USING (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = (SELECT auth.uid())));

CREATE POLICY "Staff can create check_ins"
ON public.check_ins FOR INSERT
WITH CHECK ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager','front_desk']::app_role[])));

CREATE POLICY "Staff can update check_ins"
ON public.check_ins FOR UPDATE
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager','front_desk']::app_role[])))
WITH CHECK ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager','front_desk']::app_role[])));

CREATE POLICY "Staff can delete check_ins"
ON public.check_ins FOR DELETE
USING ((SELECT public.has_any_role((SELECT auth.uid()), ARRAY['super_admin','admin','manager','front_desk']::app_role[])));

-- ============ payment_attempts ============
DROP POLICY IF EXISTS "Staff can view all payment attempts" ON public.payment_attempts;
DROP POLICY IF EXISTS "Members can view their own payment attempts" ON public.payment_attempts;
DROP POLICY IF EXISTS "Staff can update payment attempts" ON public.payment_attempts;

CREATE POLICY "Staff can view all payment attempts"
ON public.payment_attempts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role = ANY (ARRAY['super_admin','admin','manager','front_desk']::app_role[])
));

CREATE POLICY "Members can view their own payment attempts"
ON public.payment_attempts FOR SELECT
USING (member_id IN (SELECT m.id FROM public.members m WHERE m.user_id = (SELECT auth.uid())));

CREATE POLICY "Staff can update payment attempts"
ON public.payment_attempts FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role = ANY (ARRAY['super_admin','admin','manager','front_desk']::app_role[])
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = (SELECT auth.uid())
    AND ur.role = ANY (ARRAY['super_admin','admin','manager','front_desk']::app_role[])
));

-- ============ supporting indexes ============
CREATE INDEX IF NOT EXISTS idx_email_conversations_status_last_message
  ON public.email_conversations (status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_created
  ON public.email_messages (sender_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_conversation_sender
  ON public.email_messages (conversation_id, sender_type, created_at DESC);
