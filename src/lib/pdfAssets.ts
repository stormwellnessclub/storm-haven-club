// Centralized PDF asset imports — Vite resolves these to hashed URLs
// that bypass React Router and are served correctly in dev + production.

import liabilityWaiver from "@/assets/agreements/liability-waiver.pdf";
import membershipAgreement from "@/assets/agreements/membership-agreement.pdf";
import kidsCareAgreement from "@/assets/agreements/kids-care-agreement.pdf";
import kidsCareParentConsent from "@/assets/agreements/kids-care-agreement-parent-consent-form.pdf";
import guestPassGeneral from "@/assets/agreements/guest-pass-agreement-general.pdf";
import guestPassAgreement from "@/assets/agreements/guest-pass-agreement.pdf";
import privateEventAgreement from "@/assets/agreements/private-event-agreement.pdf";
import singleClassPass1 from "@/assets/agreements/single-class-pass-agreement.pdf";
import singleClassPass2 from "@/assets/agreements/single-class-pass-agreement-2.pdf";
import kidsCareServiceSetUp from "@/assets/agreements/kids-care-service-set-up.pdf";
import kidsMinorParentConsent from "@/assets/agreements/kids-minor-parent-consent-form.pdf";
import membershipAgreementBackup from "@/assets/agreements/membership-agreement-backup.pdf";
import membershipAgreementV2Draft from "@/assets/agreements/membership-agreement-v2-draft.pdf";
import otherPrivateEventForm from "@/assets/agreements/other-private-event-form.pdf";

const pdfMap: Record<string, string> = {
  'liability-waiver.pdf': liabilityWaiver,
  'membership-agreement.pdf': membershipAgreement,
  'kids-care-agreement.pdf': kidsCareAgreement,
  'kids-care-agreement-parent-consent-form.pdf': kidsCareParentConsent,
  'guest-pass-agreement-general.pdf': guestPassGeneral,
  'guest-pass-agreement.pdf': guestPassAgreement,
  'private-event-agreement.pdf': privateEventAgreement,
  'single-class-pass-agreement.pdf': singleClassPass1,
  'single-class-pass-agreement-2.pdf': singleClassPass2,
  'kids-care-service-set-up.pdf': kidsCareServiceSetUp,
  'kids-minor-parent-consent-form.pdf': kidsMinorParentConsent,
  'membership-agreement-backup.pdf': membershipAgreementBackup,
  'membership-agreement-v2-draft.pdf': membershipAgreementV2Draft,
  'other-private-event-form.pdf': otherPrivateEventForm,
};

/**
 * Resolve a PDF filename, path, or URL to a usable asset URL.
 * - Full HTTP(S) URLs pass through unchanged
 * - Known filenames resolve to Vite-hashed asset URLs
 * - Unknown filenames fall back to /agreements/filename
 */
export function resolvePdfUrl(pdfInput: string): string {
  // Extract filename from any path or URL first
  const filename = pdfInput.split('/').pop()?.split('?')[0] || pdfInput;

  // Always try mapped import first — even for full URLs, since the DB may
  // store a stale build/preview URL whose asset hash no longer exists.
  const mapped = pdfMap[filename];
  if (mapped) {
    return mapped;
  }

  // Pass through real external URLs (storage buckets, CDNs, etc.)
  if (pdfInput.startsWith('http://') || pdfInput.startsWith('https://')) {
    return pdfInput;
  }

  // Absolute path fallback
  if (pdfInput.startsWith('/')) {
    return pdfInput;
  }

  // Default fallback
  return `/agreements/${filename}`;
}
