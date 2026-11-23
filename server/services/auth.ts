import crypto from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { config } from "../config.js";

export const SESSION_COOKIE_NAME = "rt_session";
export const ACCOUNT_VAULT_COOKIE_NAME = "rt_acct_vault";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  created_at: string;
}

export interface UserDbRow extends AuthUser {
  password_hash: string;
}

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Please enter your full name (at least 2 characters).")
    .max(80, "Name is too long."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid Gmail address.")
    .max(120, "Email address is too long."),
  phone: z
    .string()
    .trim()
    .min(7, "Please enter a valid phone number.")
    .max(24, "Phone number is too long.")
    .regex(
      /^[+\d][\d\s().-]{6,23}$/,
      "Phone number can only include digits, spaces, +, -, and ().",
    ),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters.")
    .max(128, "Password is too long."),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Username or Gmail is required.").max(120),
  password: z.string().min(1, "Password is required.").max(128),
});

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }
  const salt = parts[1];
  const expectedHex = parts[2];
  if (!salt || !expectedHex) return false;

  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

interface TokenPayload {
  sub: number;
  name: string;
  username: string;
  email: string;
  phone: string;
  created_at: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(padLen), "base64").toString("utf8");
}

function signSegment(data: string): string {
  return base64UrlEncode(crypto.createHmac("sha256", config.authSecret).update(data).digest());
}

export function createAuthToken(user: AuthUser): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload: TokenPayload = {
    sub: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone,
    created_at: user.created_at,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = signSegment(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function verifyAuthToken(token: string): AuthUser | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const header = parts[0];
  const body = parts[1];
  const signature = parts[2];
  if (!header || !body || !signature) return null;

  const expectedSig = signSegment(`${header}.${body}`);
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as Partial<TokenPayload>;
    if (
      typeof parsed.sub !== "number" ||
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp <= now) {
      return null;
    }
    return {
      id: parsed.sub,
      name: parsed.name,
      username: parsed.username ?? parsed.name,
      email: parsed.email,
      phone: parsed.phone ?? "",
      created_at: parsed.created_at ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers["authorization"];
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookieHeader(req.headers["cookie"]);
  const sessionCookie = cookies[SESSION_COOKIE_NAME];
  return sessionCookie || null;
}

export function setSessionCookie(res: Response, token: string): void {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ];
  if (config.isVercel || process.env["NODE_ENV"] === "production") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: Response): void {
  const parts = [`${SESSION_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (config.isVercel || process.env["NODE_ENV"] === "production") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function sanitizeUser(row: UserDbRow): AuthUser {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    email: row.email,
    phone: row.phone,
    created_at: row.created_at,
  };
}

function getVaultKey(): Buffer {
  return crypto.createHash("sha256").update(`vault:${config.authSecret}`).digest();
}

export interface VaultUserRecord {
  name: string;
  username: string;
  email: string;
  phone: string;
  password_hash: string;
  created_at: string;
}

export function encryptAccountVault(record: VaultUserRecord): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getVaultKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(record), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [base64UrlEncode(iv), base64UrlEncode(tag), base64UrlEncode(encrypted)].join(".");
}

export function decryptAccountVault(token: string | undefined): VaultUserRecord | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [ivStr, tagStr, dataStr] = parts;
  if (!ivStr || !tagStr || !dataStr) return null;

  try {
    const decodeBuf = (s: string) => {
      const padded = s.replace(/-/g, "+").replace(/_/g, "/");
      const padLen = (4 - (padded.length % 4)) % 4;
      return Buffer.from(padded + "=".repeat(padLen), "base64");
    };
    const iv = decodeBuf(ivStr);
    const tag = decodeBuf(tagStr);
    const encrypted = decodeBuf(dataStr);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getVaultKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      "utf8",
    );
    const parsed = JSON.parse(plaintext) as Partial<VaultUserRecord>;
    if (
      typeof parsed.name === "string" &&
      typeof parsed.email === "string" &&
      typeof parsed.password_hash === "string"
    ) {
      return {
        name: parsed.name,
        username: parsed.username ?? parsed.name,
        email: parsed.email,
        phone: parsed.phone ?? "",
        password_hash: parsed.password_hash,
        created_at: parsed.created_at ?? new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function appendSetCookie(res: Response, cookieValue: string): void {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) {
    res.setHeader("Set-Cookie", cookieValue);
  } else if (Array.isArray(existing)) {
    res.setHeader("Set-Cookie", [...existing.map(String), cookieValue]);
  } else {
    res.setHeader("Set-Cookie", [String(existing), cookieValue]);
  }
}

export function setAccountVaultCookie(res: Response, record: VaultUserRecord): void {
  const encrypted = encryptAccountVault(record);
  const parts = [
    `${ACCOUNT_VAULT_COOKIE_NAME}=${encodeURIComponent(encrypted)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ];
  if (config.isVercel || process.env["NODE_ENV"] === "production") {
    parts.push("Secure");
  }
  appendSetCookie(res, parts.join("; "));
}
