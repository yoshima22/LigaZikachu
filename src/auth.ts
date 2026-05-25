import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const providers = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Senha", type: "password" }
    },
    async authorize(rawCredentials) {
      const parsed = credentialsSchema.safeParse(rawCredentials);

      if (!parsed.success) {
        return null;
      }

      const email = parsed.data.email.toLowerCase().trim();

      const user = await prisma.user.findUnique({
        where: { email }
      });

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
      if (user) {
        token.role = user.role as Role;
        token.status = user.status as UserStatus;
      }

      if (token.sub && (!token.role || !token.status)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            status: true
          }
        });

        token.role = dbUser?.role ?? Role.PLAYER;
        token.status = dbUser?.status ?? UserStatus.PENDING_APPROVAL;
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
      if (!user.email) {
        return false;
      }

      const dbUser = await prisma.user.findUnique({
        where: {
          email: user.email.toLowerCase()
        }
      });

      if (!dbUser) {
        return true;
      }

      return dbUser.status !== UserStatus.REJECTED && dbUser.status !== UserStatus.SUSPENDED;
    }
  },
  events: {
    async createUser({ user }) {
      const displayName = user.name?.trim() || user.email?.split("@")[0] || "Jogador";

      await prisma.player.create({
        data: {
          userId: user.id!,
          displayName
        }
      });
    }
  }
});
