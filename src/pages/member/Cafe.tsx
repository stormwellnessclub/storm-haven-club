import { MemberLayout } from "@/components/member/MemberLayout";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";
import { CafeStylePreview } from "@/components/cafe/CafeStylePreview";

export default function MemberCafe() {
  return (
    <MemberLayout title="Cafe Order">
      <CafeStylePreview />
      <CafeOrderContent variant="member" />
    </MemberLayout>
  );
}
