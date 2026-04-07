import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

const authPayloadSchema = z.object({
  sub: z.string(),
  username: z.string(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "USER"]),
});

export type AuthPayload = z.infer<typeof authPayloadSchema>;

function getJwtSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is not set.");
  }
  return new TextEncoder().encode(secret);
}

export async function signAuthToken(payload: AuthPayload, expiresIn: number) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(getJwtSecret());
}

export async function verifyAuthToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret());
  return authPayloadSchema.parse(payload);
}
