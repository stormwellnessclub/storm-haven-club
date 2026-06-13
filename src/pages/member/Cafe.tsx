import { MemberLayout } from "@/components/member/MemberLayout";
import { CafeOrderContent } from "@/components/cafe/CafeOrderContent";

export default function MemberCafe() {
  return (
    <MemberLayout title="Cafe Order">
      <CafeOrderContent variant="member" />
    </MemberLayout>
  );
}
