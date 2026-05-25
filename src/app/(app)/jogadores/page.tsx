import { Card, CardDescription, CardTitle } from "@/components/ui/card";

export default function PlayersPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Jogadores</CardTitle>
        <CardDescription className="mt-2">
          Placeholder da área protegida para gestão e consulta de jogadores. A base de autenticação e modelagem já está pronta para o CRUD.
        </CardDescription>
      </Card>
    </div>
  );
}