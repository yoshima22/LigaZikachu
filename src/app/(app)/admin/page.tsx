import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Admin</CardTitle>
        <CardDescription className="mt-2">
          Placeholder do painel administrativo para aprovações, auditoria, importações e configurações da liga.
        </CardDescription>
      </Card>
    </div>
  );
}