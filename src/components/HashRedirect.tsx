import { Navigate, useLocation } from "react-router-dom";

/** Redirects an old address to a section of a combined page, keeping any query string. */
export function HashRedirect({ to, hash }: { to: string; hash: string }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}#${hash}`} replace />;
}
