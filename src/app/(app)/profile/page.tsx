import { ProfileForm } from "@/components/profile-form";
import { getUserProfile } from "@/lib/data";

export default async function ProfilePage() {
  const profile = await getUserProfile();
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account settings
        </p>
      </div>

      <ProfileForm profile={profile} />
    </div>
  );
}
