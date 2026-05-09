import "next-auth";

declare module "next-auth" {
  interface Session {
    backendAccessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    backendAccessToken?: string;
  }
}
