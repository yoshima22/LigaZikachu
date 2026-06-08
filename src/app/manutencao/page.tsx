const PAGE_BODY = "Estamos em manutencao. Voltamos ja com novidades!";
const PAGE_SUB = "Pagina em manutencao. Equipe Liga Zikachu";

export const metadata = {
  title: "Manutencao - Liga Zikachu",
};

export default async function ManutencaoPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0f0f1a", padding: "0 1rem", textAlign: "center" }}>
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: "1.5rem" }}>
        <rect x="2" y="6" width="20" height="8" rx="1" />
        <path d="M17 14v7" />
        <path d="M7 14v7" />
        <path d="M17 3h2v3h-2z" />
      </svg>
      <h1 style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "1.5rem", color: "#FFCB05" }}>
        Liga Zikachu
      </h1>
      <p style={{ marginTop: "1rem", maxWidth: "28rem", fontSize: "1.125rem", color: "#94a3b8" }}>
        {PAGE_BODY}
      </p>
      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#475569" }}>
        {PAGE_SUB}
      </p>
      <a
        href="/login"
        style={{ marginTop: "2rem", borderRadius: "0.75rem", border: "1px solid rgba(255,203,5,0.3)", background: "rgba(255,203,5,0.1)", padding: "0.625rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#FFCB05", textDecoration: "none" }}
      >
        Ir para login
      </a>
    </div>
  );
}
