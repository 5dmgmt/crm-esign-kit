import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && adminEmails().has(email.trim().toLowerCase()));
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      return Boolean(user.email?.trim());
    },
    async jwt({ token, user }) {
      const email = user?.email ?? token.email;
      token.email = typeof email === "string" ? email.trim().toLowerCase() : null;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.email = typeof token.email === "string" ? token.email : null;
      return session;
    },
    async redirect({ url, baseUrl }) {
      const target = new URL(url, baseUrl);
      return target.origin === baseUrl ? target.toString() : `${baseUrl}/admin`;
    },
  },
};
