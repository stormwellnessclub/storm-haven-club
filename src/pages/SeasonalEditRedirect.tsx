import { Navigate, useLocation } from "react-router-dom";

/** The old /black-friday address now lives at /seasonal-edit; keep ?for= and #section so old links land in the same spot. */
export default function SeasonalEditRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`/seasonal-edit${search}${hash}`} replace />;
}
