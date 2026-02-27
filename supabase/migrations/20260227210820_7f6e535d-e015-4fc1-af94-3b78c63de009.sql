-- One-time fix: recalculate current_enrollment from actual confirmed bookings
UPDATE class_sessions cs
SET current_enrollment = (
  SELECT COUNT(*) FROM class_bookings cb 
  WHERE cb.session_id = cs.id AND cb.status = 'confirmed'
);