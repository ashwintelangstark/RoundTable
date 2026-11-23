// @vitest-environment node
import { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { Duplex } from "node:stream";
import type { Request, Response } from "express";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { db } from "../db.js";
import {
  createAuthToken,
  decryptAccountVault,
  encryptAccountVault,
  hashPassword,
  verifyAuthToken,
  verifyPassword,
} from "./auth.js";
import { buildStaticWelcomeEmail } from "./mailer.js";

interface MockResponseResult {
  status: number;
  headers: Record<string, string | string[]>;
  body: string;
  json: <T>() => T;
}

function invokeApp(opts: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}): Promise<MockResponseResult> {
  return new Promise((resolve, reject) => {
    const rawBody = opts.body !== undefined ? JSON.stringify(opts.body) : "";
    const writtenChunks: Buffer[] = [];

    const mockSocket = new Duplex({
      read() {},
      write(chunk, _encoding, cb) {
        writtenChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        cb();
      },
    }) as unknown as Socket;
    Object.defineProperty(mockSocket, "remoteAddress", { value: "127.0.0.1" });

    const req = new IncomingMessage(mockSocket);
    req.method = opts.method;
    req.url = opts.url;
    req.headers = {};
    for (const [k, v] of Object.entries(opts.headers ?? {})) {
      req.headers[k.toLowerCase()] = v;
    }
    if (rawBody) {
      req.headers["content-type"] = req.headers["content-type"] ?? "application/json";
      req.headers["content-length"] = String(Buffer.byteLength(rawBody));
    }

    const res = new ServerResponse(req);
    const bodyChunks: Buffer[] = [];
    let resolved = false;

    const finishResponse = () => {
      if (resolved) return;
      resolved = true;
      const decodedBody = Buffer.concat(bodyChunks).toString("utf8");
      const headers: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(res.getHeaders())) {
        if (v !== undefined) {
          headers[k.toLowerCase()] = Array.isArray(v) ? v.map(String) : String(v);
        }
      }
      resolve({
        status: res.statusCode,
        headers,
        body: decodedBody,
        json: <T>() => JSON.parse(decodedBody) as T,
      });
    };

    res.write = ((chunk: Buffer | string) => {
      bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    }) as typeof res.write;

    res.end = ((chunk?: Buffer | string | (() => void)) => {
      if (chunk && typeof chunk !== "function") {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      res.emit("finish");
      finishResponse();
      return res;
    }) as typeof res.end;

    try {
      app(req as unknown as Request, res as unknown as Response, (err?: unknown) => {
        if (err) reject(err);
      });
      if (rawBody) {
        req.push(Buffer.from(rawBody, "utf8"));
      }
      req.push(null);
    } catch (err) {
      reject(err);
    }
  });
}

describe("RoundTable Auth, Account Vault & Static Welcome Mailer", () => {
  const testEmail = `rt_auth_test_${Date.now()}@gmail.com`;
  const testName = "RoundTable Test Candidate";
  const testPhone = "+91 98765 11223";
  const testPassword = "StrongPassword123!";

  afterAll(() => {
    db.prepare("DELETE FROM users WHERE LOWER(email) = LOWER(?)").run(testEmail);
  });

  it("hashes and verifies passwords with scrypt + timingSafeEqual", () => {
    const hash = hashPassword("MySecretPass99");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(verifyPassword("MySecretPass99", hash)).toBe(true);
    expect(verifyPassword("WrongPass", hash)).toBe(false);
  });

  it("creates and verifies HMAC-SHA256 stateless auth tokens", () => {
    const token = createAuthToken({
      id: 42,
      name: "Test User",
      username: "Test User",
      email: "test@gmail.com",
      phone: "+1 555 123 4567",
      created_at: "2026-11-23T00:00:00Z",
    });
    const verified = verifyAuthToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.email).toBe("test@gmail.com");
    expect(verified?.name).toBe("Test User");
    expect(verifyAuthToken(`${token}tampered`)).toBeNull();
  });

  it("encrypts and decrypts serverless cold-start account vault payloads", () => {
    const record = {
      name: "Vault Candidate",
      username: "Vault Candidate",
      email: "vault@gmail.com",
      phone: "9998887777",
      password_hash: hashPassword("VaultPass123"),
      created_at: "2026-11-23T00:00:00Z",
    };
    const sealed = encryptAccountVault(record);
    const opened = decryptAccountVault(sealed);
    expect(opened).toEqual(record);
    expect(decryptAccountVault(`${sealed}x`)).toBeNull();
  });

  it("builds a static welcome email with user details and no verification step", () => {
    const mail = buildStaticWelcomeEmail({
      name: testName,
      email: testEmail,
      phone: testPhone,
    });
    expect(mail.subject).toMatch(/Welcome to RoundTable/i);
    expect(mail.text).toContain(testName);
    expect(mail.text).toContain(testEmail);
    expect(mail.text).toContain(testPhone);
    expect(mail.text).toMatch(/No email verification is required/i);
    expect(mail.html).toContain(testName);
  });

  it("runs full auth API flow: signup -> static welcome mail logged -> login with username & Gmail -> cold-start vault login -> me -> logout", async () => {
    // 1. Sign up
    const signupRes = await invokeApp({
      method: "POST",
      url: "/api/auth/signup",
      body: {
        name: testName,
        email: testEmail,
        phone: testPhone,
        password: testPassword,
      },
    });
    expect(signupRes.status).toBe(201);
    const signupJson = signupRes.json<{
      ok: boolean;
      user: { name: string; email: string; phone: string };
      emailNotification: { to: string; subject: string; previewText: string };
    }>();
    expect(signupJson.ok).toBe(true);
    expect(signupJson.user.email).toBe(testEmail);
    expect(signupJson.emailNotification.to).toBe(testEmail);
    expect(signupJson.emailNotification.subject).toMatch(/Welcome to RoundTable/i);

    const setCookieHeader = signupRes.headers["set-cookie"];
    const cookieList = Array.isArray(setCookieHeader)
      ? setCookieHeader
      : setCookieHeader
        ? [setCookieHeader]
        : [];
    const vaultCookiePair = cookieList
      .map((c) => c.split(";")[0] ?? "")
      .find((c) => c.startsWith("rt_acct_vault="));
    expect(vaultCookiePair).toBeTruthy();

    // Verify static welcome email was recorded in email_logs
    const emailLog = db
      .prepare("SELECT * FROM email_logs WHERE LOWER(recipient_email) = LOWER(?)")
      .get(testEmail) as { recipient_email: string; subject: string } | undefined;
    expect(emailLog).toBeDefined();
    expect(emailLog?.subject).toMatch(/Welcome to RoundTable/i);

    // 2. Duplicate signup rejected
    const dupRes = await invokeApp({
      method: "POST",
      url: "/api/auth/signup",
      body: {
        name: testName,
        email: testEmail,
        phone: testPhone,
        password: testPassword,
      },
    });
    expect(dupRes.status).toBe(409);

    // 3. Wrong password rejected
    const badLogin = await invokeApp({
      method: "POST",
      url: "/api/auth/login",
      body: { username: testName, password: "WrongPassword" },
    });
    expect(badLogin.status).toBe(401);

    // 4. Login with Name (username) + password
    const loginByNameRes = await invokeApp({
      method: "POST",
      url: "/api/auth/login",
      body: { username: testName, password: testPassword },
    });
    expect(loginByNameRes.status).toBe(200);
    const loginByName = loginByNameRes.json<{
      ok: boolean;
      token: string;
      user: { name: string; email: string };
    }>();
    expect(loginByName.ok).toBe(true);
    expect(loginByName.token.length).toBeGreaterThan(20);
    expect(loginByName.user.email).toBe(testEmail);

    // 5. Login with Gmail + password
    const loginByEmailRes = await invokeApp({
      method: "POST",
      url: "/api/auth/login",
      body: { username: testEmail, password: testPassword },
    });
    expect(loginByEmailRes.status).toBe(200);

    // 6. Simulate Vercel serverless cold-start (user missing from fresh /tmp SQLite) -> rehydrates from HttpOnly vault cookie
    db.prepare("DELETE FROM users WHERE LOWER(email) = LOWER(?)").run(testEmail);
    const coldLoginRes = await invokeApp({
      method: "POST",
      url: "/api/auth/login",
      headers: { cookie: vaultCookiePair! },
      body: { username: testName, password: testPassword },
    });
    expect(coldLoginRes.status).toBe(200);

    // 7. Verify /api/auth/me with Bearer token
    const meRes = await invokeApp({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${loginByName.token}` },
    });
    expect(meRes.status).toBe(200);
    const meJson = meRes.json<{
      authenticated: boolean;
      user: { email: string };
    }>();
    expect(meJson.authenticated).toBe(true);
    expect(meJson.user.email).toBe(testEmail);

    // 8. Unauthenticated /api/auth/me returns 401
    const unauthRes = await invokeApp({
      method: "GET",
      url: "/api/auth/me",
    });
    expect(unauthRes.status).toBe(401);

    // 9. Logout clears cookie
    const logoutRes = await invokeApp({
      method: "POST",
      url: "/api/auth/logout",
    });
    expect(logoutRes.status).toBe(200);
  });
});
