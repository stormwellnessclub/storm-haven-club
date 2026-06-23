import { useEffect, useState } from "react";
import { AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";

interface SignedMemberPhotoProps {
  photoUrl: string | null | undefined;
  alt?: string;
  className?: string;
}

function extractMemberPhotoPath(photoUrl: string): string | null {
  const cleanUrl = photoUrl.split("?")[0];
  const publicMarker = "/storage/v1/object/public/member-photos/";
  const signedMarker = "/storage/v1/object/sign/member-photos/";

  if (cleanUrl.includes(publicMarker)) {
    return decodeURIComponent(cleanUrl.split(publicMarker)[1] || "") || null;
  }

  if (cleanUrl.includes(signedMarker)) {
    return decodeURIComponent(cleanUrl.split(signedMarker)[1] || "") || null;
  }

  if (!cleanUrl.startsWith("http") && cleanUrl.includes("/")) {
    return cleanUrl;
  }

  return null;
}

export function SignedMemberPhoto({ photoUrl, alt, className }: SignedMemberPhotoProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSignedUrl = async () => {
      if (!photoUrl) {
        setSignedUrl(null);
        return;
      }

      const path = extractMemberPhotoPath(photoUrl);
      if (!path) {
        setSignedUrl(photoUrl);
        return;
      }

      const { data, error } = await supabase.storage
        .from("member-photos")
        .createSignedUrl(path, 60 * 60);

      if (!cancelled) {
        setSignedUrl(error ? null : data?.signedUrl || null);
      }
    };

    loadSignedUrl();
    return () => {
      cancelled = true;
    };
  }, [photoUrl]);

  if (!signedUrl) return null;

  return <AvatarImage src={signedUrl} alt={alt} className={className} />;
}
