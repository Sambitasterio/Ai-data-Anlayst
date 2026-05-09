import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";

const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

/** Auth.js requires a secret; prefer AUTH_SECRET (v5) or NEXTAUTH_SECRET, with a dev-only fallback. */
function resolveAuthSecret(): string | undefined {
  const fromEnv = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV !== "production") {
    return "dev-insecure-auth-secret-set-AUTH_SECRET-in-env-for-real-sessions";
  }
  return undefined;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: resolveAuthSecret(),
  providers: [
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [
          GitHub({
            clientId: process.env.GITHUB_ID,
            clientSecret: process.env.GITHUB_SECRET,
          }),
        ]
      : []),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        const response = await fetch(`${backendUrl}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });
        if (!response.ok) {
          return null;
        }
        const data = (await response.json()) as {
          access_token: string;
          user: { id: string; email: string; name: string | null };
        };
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name ?? undefined,
          backendToken: data.access_token,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user && "backendToken" in user && typeof user.backendToken === "string") {
        token.backendAccessToken = user.backendToken;
      }
      if (account?.provider === "github" && profile && "email" in profile && profile.email) {
        const syncSecret = process.env.AUTH_SYNC_SECRET;
        if (syncSecret) {
          const name =
            "name" in profile && typeof profile.name === "string" ? profile.name : null;
          const response = await fetch(`${backendUrl}/auth/oauth-sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Auth-Sync-Secret": syncSecret,
            },
            body: JSON.stringify({
              email: String(profile.email),
              name,
              image: "image" in profile ? String(profile.image ?? "") : null,
            }),
          });
          if (response.ok) {
            const data = (await response.json()) as { access_token: string };
            token.backendAccessToken = data.access_token;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.backendAccessToken) {
        session.backendAccessToken = token.backendAccessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  trustHost: true,
});
