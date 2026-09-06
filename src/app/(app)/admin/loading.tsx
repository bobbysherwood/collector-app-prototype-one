import { AdminScreen } from "@/components/admin-screen";
import { AdminSectionSkeleton } from "@/components/admin-section-skeleton";

export default function AdminLoading() {
  return (
    <AdminScreen activeSection="users">
      <AdminSectionSkeleton section="users" />
    </AdminScreen>
  );
}
