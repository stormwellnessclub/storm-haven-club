
-- Create enums
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'done');
CREATE TYPE public.note_visibility AS ENUM ('all_staff', 'specific_roles', 'specific_users');
CREATE TYPE public.channel_type AS ENUM ('general', 'department', 'direct');

-- staff_tasks table
CREATE TABLE public.staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'todo',
  created_by UUID NOT NULL,
  assigned_to UUID,
  due_date DATE,
  visible_to_roles app_role[] DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- staff_notes table
CREATE TABLE public.staff_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL,
  visibility note_visibility NOT NULL DEFAULT 'all_staff',
  visible_to_roles app_role[] DEFAULT '{}',
  visible_to_users UUID[] DEFAULT '{}',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- staff_channels table
CREATE TABLE public.staff_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel_type channel_type NOT NULL DEFAULT 'general',
  visible_to_roles app_role[] DEFAULT '{}',
  member_ids UUID[] DEFAULT '{}',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- staff_messages table
CREATE TABLE public.staff_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.staff_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  message_body TEXT NOT NULL,
  is_read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_messages;

-- RLS for staff_tasks
CREATE POLICY "Staff can view tasks visible to their roles or assigned to them"
  ON public.staff_tasks FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR (
      visible_to_roles = '{}'
      AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
    )
    OR (
      visible_to_roles != '{}'
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = ANY(staff_tasks.visible_to_roles)
      )
    )
  );

CREATE POLICY "Staff can create tasks"
  ON public.staff_tasks FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Task creators and admins can update tasks"
  ON public.staff_tasks FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Task creators and admins can delete tasks"
  ON public.staff_tasks FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- RLS for staff_notes
CREATE POLICY "Staff can view notes based on visibility"
  ON public.staff_notes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR created_by = auth.uid()
    OR visibility = 'all_staff'
    OR (
      visibility = 'specific_roles'
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = ANY(staff_notes.visible_to_roles)
      )
    )
    OR (
      visibility = 'specific_users'
      AND auth.uid() = ANY(visible_to_users)
    )
  );

CREATE POLICY "Staff can create notes"
  ON public.staff_notes FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Note creators and admins can update"
  ON public.staff_notes FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

CREATE POLICY "Note creators and admins can delete"
  ON public.staff_notes FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- RLS for staff_channels
CREATE POLICY "Staff can view channels they belong to"
  ON public.staff_channels FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR created_by = auth.uid()
    OR channel_type = 'general'
    OR auth.uid() = ANY(member_ids)
    OR (
      channel_type = 'department'
      AND (
        visible_to_roles = '{}'
        OR EXISTS (
          SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = ANY(staff_channels.visible_to_roles)
        )
      )
    )
  );

CREATE POLICY "Staff can create channels"
  ON public.staff_channels FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Channel creators and admins can update"
  ON public.staff_channels FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_admin(auth.uid())
  );

-- RLS for staff_messages
CREATE POLICY "Staff can view messages in their channels"
  ON public.staff_messages FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.staff_channels sc
      WHERE sc.id = staff_messages.channel_id
      AND (
        sc.created_by = auth.uid()
        OR sc.channel_type = 'general'
        OR auth.uid() = ANY(sc.member_ids)
        OR (
          sc.channel_type = 'department'
          AND (
            sc.visible_to_roles = '{}'
            OR EXISTS (
              SELECT 1 FROM public.user_roles
              WHERE user_id = auth.uid() AND role = ANY(sc.visible_to_roles)
            )
          )
        )
      )
    )
  );

CREATE POLICY "Staff can send messages"
  ON public.staff_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid())
  );

CREATE POLICY "Message senders and admins can update"
  ON public.staff_messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR public.is_admin(auth.uid())
  );
