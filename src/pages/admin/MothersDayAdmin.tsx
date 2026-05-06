import { AdminLayout } from "@/components/admin/AdminLayout";
import { MothersDayTab } from "@/components/admin/spa/MothersDayTab";

export default function MothersDayAdmin() {
  return (
    <AdminLayout title="Mother's Day Tracking">
      <MothersDayTab />
    </AdminLayout>
  );
}
