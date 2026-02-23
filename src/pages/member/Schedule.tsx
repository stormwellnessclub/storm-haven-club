import { MemberLayout } from "@/components/member/MemberLayout";
import { TempClassSchedule } from "@/components/booking/TempClassSchedule";

export default function MemberSchedule() {
  return (
    <MemberLayout title="Class Schedule">
      <TempClassSchedule />
    </MemberLayout>
  );
}
