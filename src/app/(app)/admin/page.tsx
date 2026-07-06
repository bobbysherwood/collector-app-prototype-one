import { redirect } from "next/navigation";
import { AdminScreen } from "@/components/admin-screen";
import { getAdminUsers } from "@/lib/admin-data";
import { getCardRepositorySets } from "@/lib/card-repository-data";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";

export default async function AdminPage() {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    redirect("/dashboard");
  }

  const [users, cardRepositorySets] = await Promise.all([
    getAdminUsers(),
    getCardRepositorySets(),
  ]);

  return <AdminScreen users={users} cardRepositorySets={cardRepositorySets} />;
}
