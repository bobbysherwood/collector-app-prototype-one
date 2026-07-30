import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminScreen } from "@/components/admin-screen";
import { AdminSectionContent } from "@/components/admin-section-content";
import { AdminSectionSkeleton } from "@/components/admin-section-skeleton";
import { parseAdminSection } from "@/lib/admin-sections";
import { getUserProfile } from "@/lib/data";
import { isAdminRole } from "@/types/user";

interface AdminPageProps {
  searchParams: Promise<{ section?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const profile = await getUserProfile();
  if (!profile || !isAdminRole(profile.role)) {
    redirect("/dashboard");
  }

  const { section: sectionParam } = await searchParams;
  const activeSection = parseAdminSection(sectionParam);

  return (
    <AdminScreen activeSection={activeSection}>
      <Suspense
        key={activeSection}
        fallback={<AdminSectionSkeleton section={activeSection} />}
      >
        <AdminSectionContent section={activeSection} />
      </Suspense>
    </AdminScreen>
  );
}
