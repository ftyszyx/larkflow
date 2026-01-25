import { SignJWT, jwtVerify } from "jose";

export type JwtUserClaims = {
  uid: number;
  email: string;
  isPlatformAdmin: boolean;
};

const getSecret = () => {
  const raw = Deno.env.get("JWT_SECRET") ?? "dev_secret";
  return new TextEncoder().encode(raw);
};

export const signUserJwt = async (claims: JwtUserClaims, opts?: { expiresIn?: string }) => {
  const expiresIn = opts?.expiresIn ?? "7d";
  return await new SignJWT({ uid: claims.uid, email: claims.email, isPlatformAdmin: claims.isPlatformAdmin })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
};

export const verifyUserJwt = async (token: string) => {
  const { payload } = await jwtVerify(token, getSecret());
  const uid = Number((payload as Record<string, unknown>).uid);
  const emailRaw = (payload as Record<string, unknown>).email;
  const email = typeof emailRaw === "string" ? emailRaw : "";
  const ipaRaw = (payload as Record<string, unknown>).isPlatformAdmin;
  const isPlatformAdmin = typeof ipaRaw === "boolean" ? ipaRaw : false;
  if (!Number.isFinite(uid) || !email) throw new Error("invalid token");
  return { uid, email, isPlatformAdmin } as JwtUserClaims;
};
