import { PTMobileShell } from "@/components/admin/pt/mobile/PTMobileShell";
import { PTMEmpty } from "@/components/admin/pt/mobile/PTMobileUI";

export default function PTMClients() {
  return (
    <PTMobileShell title="Clients">
      <PTMEmpty title="Client directory" description="Searchable client list and profiles arrive in section 8G." />
    </PTMobileShell>
  );
}
