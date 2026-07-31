import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import { PTMEmpty } from "@/components/admin/pt/mobile/PTMobileUI";

export default function PTMProgress() {
  return (
    <PTMobileShell title="Progress">
      <PTMEmpty title="Progress snapshot" description="Metric trends, photos and PRs arrive in section 8H." />
    </PTMobileShell>
  );
}
