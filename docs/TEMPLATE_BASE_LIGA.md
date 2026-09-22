# Liga Zikachu como referência para novos jogos

## Snapshot canônico

- Código-base: tag Git `liga-template-v1`, criada a partir do commit de produção `cfa4ca46` com este guia adicionado.
- Finalidade: referência de produto, arquitetura, interface e fluxos para criar jogos com outras temáticas.
- Este é um **snapshot de referência**, não um projeto já neutralizado. Não conectar um novo jogo ao banco, pagamentos, autenticação, cron ou storage da Liga.
- Alterações locais não commitadas no momento da criação da tag não fazem parte do snapshot.

## Estrutura a preservar

| Camada | Referência | Papel no novo jogo |
| --- | --- | --- |
| App e navegação | `src/app/(app)`, `src/app/(app)/_components/app-nav.tsx` | Shell autenticado, menu responsivo, páginas e estados de navegação |
| Visual | `src/app/globals.css`, `tailwind.config.ts`, `src/app/(app)/_components` | Hierarquia visual, cards, modais, feedback e mobile |
| Conta e progressão | `src/lib/auth`, `src/lib/player-activity.ts`, modelos `Player` no Prisma | Identidade, perfil, economia e progresso |
| Coleção | `src/app/(app)/album`, `src/app/(app)/mascotes`, `src/lib/mascot.ts` | Inventário, coleção, evolução, cuidados e recompensas |
| Social | `src/app/(app)/lacos`, `src/lib/mascot-bonds*.ts` | Relações e histórias entre unidades |
| Combate | `src/app/(app)/arena-z`, `src/lib/arena-z.ts`, `src/lib/league-combat.ts` | Equipes, PvE/PvP, relatórios e histórico |
| Mercado e eventos | `src/app/(app)/bazar`, `src/lib/gacha.ts`, `src/app/(app)/torneios` | Trocas, leilões, banners, missões e temporadas |
| Dados e operações | `prisma/schema.prisma`, `src/app/api/cron`, `vercel.json` | Persistência, tarefas recorrentes e deploy |

## Modelo de adaptação para outro tema

1. Criar um repositório e uma infraestrutura independentes a partir da tag; não fazer mudanças temáticas no projeto de produção da Liga.
2. Definir um vocabulário neutro antes de renomear modelos: unidade/personagem, coleção, equipe, combate, vínculo, recompensa, moeda, temporada.
3. Mapear cada sistema desejado para o novo tema. Exemplo hipotético de ninja: mascote → personagem; evolução → progressão ou transformação; arena → missão/duelo; laços → relações de equipe. Validar cada regra de jogo, não trocar apenas rótulos.
4. Separar conteúdo temático de mecânicas: nomes, tipos, raridades, imagens, sons, textos, probabilidades e regras de evolução devem ser configuráveis por jogo.
5. Substituir branding, sprites, fontes, paleta, copy e terminologia nas páginas, componentes, seeds e e-mails. Verificar todos os estados mobile, vazios, de erro e de carregamento.
6. Criar novas credenciais, variáveis de ambiente, banco, storage, provedores de pagamento e domínio. Revisar seeds, rotas administrativas e cron antes de habilitar produção.
7. Auditar direitos de uso de nomes, personagens, imagens e músicas da franquia escolhida antes de publicar.

## Limites do snapshot

- A tag conserva o código e os assets versionados, mas não inclui banco de produção, segredos, uploads de jogadores, diretórios ignorados, build nem dependências instaladas.
- Regras fortemente ligadas a Pokémon/TCG exigem redesenho funcional, sobretudo catálogo de espécies, tipos, ovos, cartas, evolução, arenas e recompensas.
- O README histórico contém informações de exemplo; nunca reutilizar contas, segredos ou endpoints da Liga no novo jogo.
- Para consultar a base sem alterar o checkout atual: `git show liga-template-v1:docs/TEMPLATE_BASE_LIGA.md` ou criar um clone independente na tag.
