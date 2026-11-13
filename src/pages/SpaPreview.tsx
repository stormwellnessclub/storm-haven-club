import { Navigate, useLocation, useParams } from "react-router-dom";

/**
 * The Spa Aella design began as a private preview at /spa/preview. It is now the live Spa page,
 * so every old preview address (shared links, already-sent emails) forwards to its new home,
 * keeping any #section and ?query.
 */
export default function SpaPreview({ to }: { to: "spa" | "sculpt" | "preparation" | "facial" }) {
  const { search, hash } = useLocation();
  const { slug = "" } = useParams<{ slug: string }>();
  const path = {
    spa: "/spa",
    sculpt: "/spa/aella-sculpt",
    preparation: "/spa/aella-sculpt/preparation",
    facial: `/spa/treatments/facials/${slug}`,
  }[to];
  return <Navigate to={`${path}${search}${hash}`} replace />;
}
