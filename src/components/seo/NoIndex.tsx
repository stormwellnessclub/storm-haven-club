import { Helmet } from "react-helmet-async";

/**
 * Drop into the JSX of any route that must not be indexed:
 * auth, account, admin, kiosk, token-gated, and review pages.
 * Renders nothing visible; injects a robots noindex meta tag.
 */
export function NoIndex() {
  return (
    <Helmet>
      <meta name="robots" content="noindex,nofollow" />
    </Helmet>
  );
}

export default NoIndex;
