-- Phase 1.1: Restore permanent schedules from historical sessions
-- Extract unique recurring patterns and create permanent templates

INSERT INTO class_schedules (
  class_type_id, instructor_id, day_of_week, 
  start_time, end_time, room, max_capacity, is_active
)
SELECT DISTINCT ON (class_type_id, instructor_id, extract(dow from session_date)::integer, start_time, end_time)
  class_type_id,
  instructor_id,
  extract(dow from session_date)::integer,
  start_time,
  end_time,
  room,
  max_capacity,
  true
FROM class_sessions
WHERE instructor_id IS NOT NULL
  AND class_type_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM class_schedules cs
    WHERE cs.class_type_id = class_sessions.class_type_id
      AND cs.instructor_id = class_sessions.instructor_id
      AND cs.day_of_week = extract(dow from class_sessions.session_date)::integer
      AND cs.start_time = class_sessions.start_time
      AND cs.end_time = class_sessions.end_time
  )
ORDER BY class_type_id, instructor_id, extract(dow from session_date)::integer, start_time, end_time, session_date DESC;