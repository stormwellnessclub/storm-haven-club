import { useEffect } from "react";

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export const SitemapRedirect = () => {
  useEffect(() => {
    window.location.replace(
      `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/serve-static?file=sitemap.xml`
    );
  }, []);
  return null;
};

export const RobotsRedirect = () => {
  useEffect(() => {
    window.location.replace(
      `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/serve-static?file=robots.txt`
    );
  }, []);
  return null;
};
