import { Navigate, useParams } from "react-router-dom";

/** Keeps old /admin/events/:slug links working by sending them to the Events Portal. */
export function AdminEventRedirect() {
  const { slug = "" } = useParams();
  return <Navigate to={`/events-portal/events/${slug}`} replace />;
}
