import { auth } from "@/auth";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default async function ProfilePage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Perfil</CardTitle>
        <CardDescription className="mt-2">
          {session?.user.name ?? session?.user.email} · status {session?.user.status}
        </CardDescription>
      </Card>
    </div>
  );
}