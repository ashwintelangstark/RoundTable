import net from "node:net";
import tls from "node:tls";
import { config } from "../config";

export interface WelcomeEmailInput {
  name: string;
  email: string;
  phone: string;
}

export interface WelcomeEmailResult {
  sent: boolean;
  mode: "resend" | "smtp" | "preview";
  to: string;
  subject: string;
  bodyText: string;
  message: string;
  error?: string;
}

export function buildStaticWelcomeEmail(input: WelcomeEmailInput): {
  subject: string;
  text: string;
  html: string;
} {
  const safeName = input.name.trim();
  const safeEmail = input.email.trim();
  const safePhone = input.phone.trim();
  const subject = "Welcome to RoundTable — Your Account Has Been Created";

  const text = [
    `Hello ${safeName},`,
    "",
    "Welcome to RoundTable!",
    "",
    "Your account has been successfully created in RoundTable — your 5-Agent AI Career Intelligence & 3D Interview Panel studio.",
    "",
    "Account Details:",
    `  - Name / Username: ${safeName}`,
    `  - Gmail: ${safeEmail}`,
    `  - Phone: ${safePhone}`,
    "",
    "No email verification is required. You can now sign in to RoundTable using your username (or Gmail) and password:",
    `  ${config.appUrl}`,
    "",
    "Your 5 AI panelists — Nikhil, Ananya, Daniel, Sarah, and Marcus — are ready whenever you are.",
    "",
    "Best regards,",
    "The RoundTable Team",
  ].join("\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#eef3ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1f2e21;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;border:1px solid #d5e0d2;padding:32px;box-shadow:0 12px 32px rgba(22,45,28,0.08);">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#526e50;font-weight:700;">ROUNDTABLE · CAREER INTELLIGENCE</div>
      <h1 style="margin:10px 0 12px;font-family:Georgia,serif;font-size:26px;font-weight:600;color:#1c2c1e;">Welcome to RoundTable, ${esc(safeName)}</h1>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#415242;">
        Your account has been successfully created in <strong>RoundTable</strong>. No email verification is required — you can log in right away using your username (or Gmail) and password.
      </p>
      <div style="background:#f5f8f3;border:1px solid #dce6d8;border-radius:14px;padding:16px 18px;margin-bottom:20px;font-size:13px;line-height:1.7;color:#2b3d2d;">
        <div><strong>Username:</strong> ${esc(safeName)}</div>
        <div><strong>Gmail:</strong> ${esc(safeEmail)}</div>
        <div><strong>Phone:</strong> ${esc(safePhone)}</div>
      </div>
      <p style="margin:0 0 22px;font-size:13px;line-height:1.6;color:#526353;">
        Your five AI interview specialists — <strong>Nikhil</strong>, <strong>Ananya</strong>, <strong>Daniel</strong>, <strong>Sarah</strong>, and <strong>Marcus</strong> — are ready in the 3D virtual boardroom.
      </p>
      <a href="${esc(config.appUrl)}" style="display:inline-block;padding:11px 22px;border-radius:999px;background:#2e4d31;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">
        Open RoundTable Login
      </a>
      <p style="margin:24px 0 0;font-size:11px;color:#788977;">
        This is a static account confirmation email from RoundTable.
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

function extractEnvelopeAddress(fromField: string): string {
  const match = fromField.match(/<([^>]+)>/);
  return (match?.[1] ?? fromField).trim();
}

function encodeMimeHeader(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function buildMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): string {
  const boundary = `rt_boundary_${Date.now().toString(36)}`;
  const dateHeader = new Date().toUTCString();
  const raw = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${encodeMimeHeader(params.subject)}`,
    `Date: ${dateHeader}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.text, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n"),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.html, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n"),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  // RFC 5321 dot-stuffing
  return raw.replace(/\r\n\./g, "\r\n..");
}

interface SmtpOptions {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  timeoutMs?: number;
}

class SmtpLineReader {
  private socket: net.Socket | tls.TLSSocket;
  private buffer = "";
  private queue: string[] = [];
  private waiters: Array<{
    resolve: (line: string) => void;
    reject: (err: Error) => void;
  }> = [];
  private closedError: Error | null = null;

  constructor(socket: net.Socket | tls.TLSSocket) {
    this.socket = socket;
    this.attach(socket);
  }

  public swapSocket(nextSocket: tls.TLSSocket) {
    this.socket.removeAllListeners("data");
    this.socket.removeAllListeners("error");
    this.socket.removeAllListeners("close");
    this.buffer = "";
    this.socket = nextSocket;
    this.attach(nextSocket);
  }

  private attach(sock: net.Socket | tls.TLSSocket) {
    sock.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString("utf8");
      while (true) {
        const idx = this.buffer.indexOf("\n");
        if (idx === -1) break;
        const line = this.buffer.slice(0, idx).replace(/\r$/, "");
        this.buffer = this.buffer.slice(idx + 1);
        const waiter = this.waiters.shift();
        if (waiter) waiter.resolve(line);
        else this.queue.push(line);
      }
    });
    sock.on("error", (err) => this.failAll(err));
    sock.on("close", () => this.failAll(new Error("SMTP connection closed unexpectedly")));
  }

  private failAll(err: Error) {
    if (!this.closedError) this.closedError = err;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.reject(err);
    }
  }

  private readLine(): Promise<string> {
    const queued = this.queue.shift();
    if (queued !== undefined) return Promise.resolve(queued);
    if (this.closedError) return Promise.reject(this.closedError);
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve, reject });
    });
  }

  public async readResponse(): Promise<{ code: number; lines: string[] }> {
    const lines: string[] = [];
    while (true) {
      const line = await this.readLine();
      lines.push(line);
      if (line.length >= 4 && /^\d{3}\s/.test(line)) {
        return { code: Number(line.slice(0, 3)), lines };
      }
      if (line.length === 3 && /^\d{3}$/.test(line)) {
        return { code: Number(line), lines };
      }
    }
  }

  public async command(
    cmd: string,
    expectedCodes: number[],
  ): Promise<{ code: number; lines: string[] }> {
    this.socket.write(`${cmd}\r\n`);
    const resp = await this.readResponse();
    if (!expectedCodes.includes(resp.code)) {
      throw new Error(`SMTP error ${resp.code}: ${resp.lines.join(" | ")}`);
    }
    return resp;
  }
}

export async function sendViaSmtp(opts: SmtpOptions): Promise<void> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const useImplicitTls = opts.port === 465;

  let socket: net.Socket | tls.TLSSocket = useImplicitTls
    ? tls.connect({
        host: opts.host,
        port: opts.port,
        servername: opts.host,
      })
    : net.connect({ host: opts.host, port: opts.port });

  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`SMTP timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const run = async () => {
    await new Promise<void>((resolve, reject) => {
      const ev = useImplicitTls ? "secureConnect" : "connect";
      socket.once(ev, () => resolve());
      socket.once("error", reject);
    });

    const reader = new SmtpLineReader(socket);
    const greeting = await reader.readResponse();
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting rejected (${greeting.code}): ${greeting.lines.join(" ")}`);
    }

    await reader.command("EHLO roundtable.local", [250]);

    if (!useImplicitTls) {
      await reader.command("STARTTLS", [220]);
      const upgraded = tls.connect({
        socket,
        servername: opts.host,
      });
      await new Promise<void>((resolve, reject) => {
        upgraded.once("secureConnect", () => resolve());
        upgraded.once("error", reject);
      });
      socket = upgraded;
      reader.swapSocket(upgraded);
      await reader.command("EHLO roundtable.local", [250]);
    }

    await reader.command("AUTH LOGIN", [334]);
    await reader.command(Buffer.from(opts.user, "utf8").toString("base64"), [334]);
    await reader.command(Buffer.from(opts.pass, "utf8").toString("base64"), [235]);

    const envelopeFrom = extractEnvelopeAddress(opts.from);
    await reader.command(`MAIL FROM:<${envelopeFrom}>`, [250]);
    await reader.command(`RCPT TO:<${opts.to}>`, [250, 251]);
    await reader.command("DATA", [354]);

    const mime = buildMimeMessage({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
    socket.write(`${mime}\r\n.\r\n`);
    const dataResp = await reader.readResponse();
    if (dataResp.code !== 250) {
      throw new Error(`SMTP DATA rejected (${dataResp.code}): ${dataResp.lines.join(" ")}`);
    }

    try {
      await reader.command("QUIT", [221, 250]);
    } catch {
      // Ignore clean close race after QUIT
    }
    socket.end();
  };

  try {
    await Promise.race([run(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
    if (!socket.destroyed) socket.destroy();
  }
}

async function sendViaResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend API error (${res.status}): ${body.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timer);
  }
}

export function isMailProviderConfigured(): boolean {
  return Boolean(
    config.mail.resendApiKey ||
    (config.mail.smtpHost && config.mail.smtpUser && config.mail.smtpPass),
  );
}

export async function sendStaticWelcomeEmail(
  input: WelcomeEmailInput,
): Promise<WelcomeEmailResult> {
  const { subject, text, html } = buildStaticWelcomeEmail(input);

  if (config.mail.resendApiKey) {
    try {
      await sendViaResend({
        apiKey: config.mail.resendApiKey,
        from: config.mail.from,
        to: input.email,
        subject,
        text,
        html,
      });
      return {
        sent: true,
        mode: "resend",
        to: input.email,
        subject,
        bodyText: text,
        message: `Welcome email sent to ${input.email}.`,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[RoundTable Mailer] Resend delivery failed:", errMsg);
      return {
        sent: false,
        mode: "resend",
        to: input.email,
        subject,
        bodyText: text,
        message: `Account created! Welcome email queued for ${input.email}.`,
        error: errMsg,
      };
    }
  }

  if (config.mail.smtpHost && config.mail.smtpUser && config.mail.smtpPass) {
    try {
      await sendViaSmtp({
        host: config.mail.smtpHost,
        port: config.mail.smtpPort,
        user: config.mail.smtpUser,
        pass: config.mail.smtpPass,
        from: config.mail.from,
        to: input.email,
        subject,
        text,
        html,
      });
      return {
        sent: true,
        mode: "smtp",
        to: input.email,
        subject,
        bodyText: text,
        message: `Welcome email sent to ${input.email}.`,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn("[RoundTable Mailer] SMTP delivery failed:", errMsg);
      return {
        sent: false,
        mode: "smtp",
        to: input.email,
        subject,
        bodyText: text,
        message: `Account created! Welcome email could not reach SMTP (${errMsg}).`,
        error: errMsg,
      };
    }
  }

  console.log(
    `[RoundTable Mailer] Static welcome email dispatched (preview log) -> ${input.email}`,
  );
  return {
    sent: false,
    mode: "preview",
    to: input.email,
    subject,
    bodyText: text,
    message: `Account created! A static welcome mail has been prepared for ${input.email}. Configure SMTP_USER & SMTP_PASS (or RESEND_API_KEY) for live Gmail inbox delivery.`,
  };
}
