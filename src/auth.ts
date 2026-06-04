import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";

// Aceita email OU nick do PTCG Live como identificador
const credentialsSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(8)
});

const providers = [
  Credentials({
    credentials: {
      identifier: { label: "Email ou nick do PTCG Live", type: "text" },
      password:   { label: "Senha", type: "password" }
    },
    async authorize(rawCredentials) {
      try {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const identifier = parsed.data.identifier.trim();

        // Tenta encontrar por email primeiro, depois por ptcglNick
        let user = await prisma.user.findFirst({
          where: { email: identifier.toLowerCase() },
          select: { id: true, email: true, name: true, image: true, role: true, status: true, passwordHash: true }
        });

        if (!user) {
          // Busca por ptcglNick via join com Player (select mínimo para evitar overhead)
          const player = await prisma.player.findFirst({
            where: { ptcglNick: { equals: identifier, mode: "insensitive" } },
            select: {
              user: {
                select: { id: true, email: true, name: true, image: true, role: true, status: true, passwordHash: true }
              }
            }
          });
          user = player?.user ?? null;
        }

        if (!user?.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(parsed.data.password, user.passwordHash);

        if (!isValid || user.status === UserStatus.REJECTED || user.status === UserStatus.SUSPENDED) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status
        };
      } catch (err) {
        console.error("[Auth] authorize error:", err);
        return null; // retorna null em vez de 500
      }
    }
  })
];

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt"
  },
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      try {
        if (user) {
          token.role = user.role as Role;
          token.status = user.status as UserStatus;
        }

        if (token.sub && (!token.role || !token.status)) {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, status: true }
          });
          token.role = dbUser?.role ?? Role.PLAYER;
          token.status = dbUser?.status ?? UserStatus.PENDING_APPROVAL;
        }
      } catch (err) {
        console.error("[Auth] jwt callback error:", err);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = (token.role as Role | undefined) ?? Role.PLAYER;
        session.user.status = (token.status as UserStatus | undefined) ?? UserStatus.PENDING_APPROVAL;
      }

      return session;
    },
    async signIn({ user }) {
      try {
        if (!user.email) return false;
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: { status: true }
        });
        if (!dbUser) return true;
        return dbUser.status !== UserStatus.REJECTED && dbUser.status !== UserStatus.SUSPENDED;
      } catch (err) {
        console.error("[Auth] signIn callback error:", err);
        return true; // permite login se DB falhar temporariamente
      }
    }
  },
  events: {
    async createUser({ user }) {
      const displayName = user.name?.trim() || user.email?.split("@")[0] || "Jogador";

      const player = await prisma.player.create({
        data: { userId: user.id!, displayName }
      });

      // ── Starter pack para nova conta ──────────────────────────────────────
      const INITIAL_BALANCE = 500;

      await prisma.$transaction(async (tx) => {
        // 1. Carteira com 500 ZC
        const wallet = await tx.zikaCoinWallet.create({
          data: { playerId: player.id, balance: INITIAL_BALANCE, totalEarned: INITIAL_BALANCE }
        });
        await tx.zikaCoinTransaction.create({
          data: {
            walletId: wallet.id,
            type: "ADMIN_ADJUSTMENT",
            amount: INITIAL_BALANCE,
            balanceBefore: 0,
            balanceAfter: INITIAL_BALANCE,
            description: "Saldo inicial de boas-vindas à Liga Zikachu 🎉"
          }
        });

        // 2. 3 Ovos Raros + 1 Ovo Comum
        await tx.mascotEgg.createMany({
          data: [
            { playerId: player.id, type: "RARE",   origin: "Presente de boas-vindas" },
            { playerId: player.id, type: "RARE",   origin: "Presente de boas-vindas" },
            { playerId: player.id, type: "RARE",   origin: "Presente de boas-vindas" },
            { playerId: player.id, type: "COMMON", origin: "Presente de boas-vindas" },
          ]
        });

        // 3. 5 Comidas + 3 Doces
        await tx.mascotFoodItem.createMany({
          data: [
            { playerId: player.id, type: "FOOD",  quantity: 5 },
            { playerId: player.id, type: "SWEET", quantity: 3 },
          ]
        });
      });
    }
  }
});
