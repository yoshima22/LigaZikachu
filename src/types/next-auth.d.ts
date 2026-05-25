import { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";
import { Role, UserStatus } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      status: UserStatus;
    };
  }

  interface User {
    role?: Role;
    status?: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    status?: UserStatus;
  }
}
