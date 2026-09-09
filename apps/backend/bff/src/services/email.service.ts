import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { firstValueFrom } from 'rxjs';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

type EmailProvider = 'brevo' | 'smtp';

interface Mailbox {
  name?: string;
  email: string;
}

const BREVO_API_BASE = 'https://api.brevo.com/v3';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly provider: EmailProvider;
  private readonly brevoApiKey?: string;
  private readonly from: Mailbox;
  private readonly replyTo: Mailbox | null;

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    // L'invio SMTP in uscita dipende dalla reputazione dell'IP condiviso di
    // Railway, finito su Spamhaus per colpa di un altro tenant e non
    // ripulibile da noi. Brevo spedisce via HTTPS e toglie di mezzo quella
    // variabile; il ramo SMTP resta solo come rientro d'emergenza,
    // selezionabile con una variabile d'ambiente invece che con un deploy.
    this.provider =
      this.configService.get<string>('EMAIL_PROVIDER', 'brevo') === 'smtp'
        ? 'smtp'
        : 'brevo';
    this.brevoApiKey = this.configService.get<string>('BREVO_API_KEY');

    // Il mittente deve appartenere al dominio autenticato presso il provider
    // (send.swipick.com), altrimenti l'email parte senza firma DKIM. Le
    // risposte vanno invece dirette alla casella Aruba, che continua a
    // ricevere sull'MX di swipick.com.
    this.from = this.parseMailbox(
      this.configService.get<string>('MAIL_FROM_EMAIL') ||
        this.configService.get<string>(
          'SMTP_FROM_EMAIL',
          'Swipick <noreply@swipick.com>',
        ),
    );
    const replyTo = this.configService.get<string>('MAIL_REPLY_TO');
    this.replyTo = replyTo ? this.parseMailbox(replyTo) : null;

    this.logger.log(
      `🔧 Initializing EmailService (provider: ${this.provider})`,
    );
    this.logger.log(`📤 From: ${this.formatMailbox(this.from)}`);
    if (this.replyTo) {
      this.logger.log(`↩️  Reply-To: ${this.formatMailbox(this.replyTo)}`);
    }

    if (this.provider === 'brevo') {
      if (!this.brevoApiKey) {
        this.logger.error(
          '❌ BREVO_API_KEY mancante: il servizio email non potrà inviare.',
        );
      } else {
        this.logger.log('✅ Email service initialized with Brevo API');
      }
      return;
    }

    this.initSmtpTransport();
  }

  /**
   * Legacy transport: authenticated submission to Aruba. Kept behind
   * EMAIL_PROVIDER=smtp so a rollback does not require a deploy.
   */
  private initSmtpTransport(): void {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT');
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPassword = this.configService.get<string>('SMTP_PASSWORD');
    // Parse SMTP_SECURE properly - env vars are strings, "false" is truthy!
    const smtpSecureStr = this.configService.get<string>(
      'SMTP_SECURE',
      'false',
    );
    const smtpSecure = smtpSecureStr === 'true';

    this.logger.log(`🔑 SMTP Host: ${smtpHost}`);
    this.logger.log(`🔑 SMTP Port: ${smtpPort}`);
    this.logger.log(`🔑 SMTP User: ${smtpUser}`);
    this.logger.log(`🔑 SMTP Secure: ${smtpSecure}`);

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      this.logger.error(
        '❌ SMTP configuration incomplete. Email service will not function.',
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        // Aruba-specific configuration
        tls: {
          // Verify Aruba certificate (validated: public CA on smtps.aruba.it)
          rejectUnauthorized: true,
          // Force TLS version
          minVersion: 'TLSv1.2',
        },
        // Extended timeout for Aruba
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 60000, // 60 seconds
        // Enable debug logging
        debug: true,
        logger: true,
      });
      this.logger.log(
        '✅ Email service initialized with Aruba SMTP successfully',
      );
    } catch (error) {
      this.logger.error('❌ Failed to initialize SMTP transport:', error);
    }
  }

  /** Accepts both "Name <user@host>" and a bare address. */
  private parseMailbox(value: string): Mailbox {
    const match = /^\s*(.*?)\s*<\s*([^>]+?)\s*>\s*$/.exec(value);
    if (match) {
      const name = match[1].replace(/^"|"$/g, '').trim();
      return name ? { name, email: match[2] } : { email: match[2] };
    }
    return { email: value.trim() };
  }

  private formatMailbox(mailbox: Mailbox): string {
    return mailbox.name ? `${mailbox.name} <${mailbox.email}>` : mailbox.email;
  }

  /**
   * Turn a transport failure into a single readable line. The original error is
   * always attached as `cause` by the caller: losing it is what made the
   * September outage diagnosable only from the platform logs.
   */
  private describeSendError(error: unknown): string {
    const err = error as {
      response?: { data?: { code?: string; message?: string } };
      code?: string;
      responseCode?: number;
      message?: string;
    };
    const apiMessage = err?.response?.data?.message;
    const apiCode = err?.response?.data?.code;
    if (apiMessage) {
      return apiCode ? `${apiCode}: ${apiMessage}` : apiMessage;
    }
    const parts = [err?.code, err?.responseCode, err?.message].filter(Boolean);
    return parts.length ? parts.join(' ') : String(error);
  }

  private withCause(message: string, cause: unknown): Error {
    const error = new Error(message);
    // ES2020 target: `new Error(msg, { cause })` is not typed yet, but the
    // runtime (Node 20) carries the property through just the same.
    (error as Error & { cause?: unknown }).cause = cause;
    return error;
  }

  /** Single send path, whichever transport is active. Returns the message id. */
  private async sendEmail(template: EmailTemplate): Promise<string> {
    return this.provider === 'brevo'
      ? this.sendViaBrevo(template)
      : this.sendViaSmtp(template);
  }

  private async sendViaBrevo(template: EmailTemplate): Promise<string> {
    if (!this.brevoApiKey) {
      throw new Error('BREVO_API_KEY non configurata');
    }

    const payload: Record<string, unknown> = {
      sender: this.from,
      to: [{ email: template.to }],
      subject: template.subject,
      htmlContent: template.html,
    };
    if (template.text) {
      payload.textContent = template.text;
    }
    if (this.replyTo) {
      payload.replyTo = this.replyTo;
    }

    const response = await firstValueFrom(
      this.httpService.post<{ messageId?: string }>(
        `${BREVO_API_BASE}/smtp/email`,
        payload,
        {
          headers: {
            'api-key': this.brevoApiKey,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          timeout: 20000,
        },
      ),
    );

    return response.data?.messageId ?? 'unknown';
  }

  private async sendViaSmtp(template: EmailTemplate): Promise<string> {
    if (!this.transporter) {
      throw new Error('SMTP transport not initialized - missing configuration');
    }

    const result = await this.transporter.sendMail({
      from: this.formatMailbox(this.from),
      to: template.to,
      replyTo: this.replyTo ? this.formatMailbox(this.replyTo) : undefined,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return result.messageId;
  }

  /**
   * Test the active transport's configuration
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    this.logger.log(`🔍 Testing ${this.provider} email configuration...`);

    if (this.provider === 'brevo') {
      if (!this.brevoApiKey) {
        return { success: false, message: 'BREVO_API_KEY non configurata' };
      }
      try {
        const response = await firstValueFrom(
          this.httpService.get<{ email?: string; companyName?: string }>(
            `${BREVO_API_BASE}/account`,
            {
              headers: {
                'api-key': this.brevoApiKey,
                accept: 'application/json',
              },
              timeout: 15000,
            },
          ),
        );
        this.logger.log('✅ Brevo API reachable and key accepted');
        return {
          success: true,
          message: 'Brevo API connection successful',
          details: {
            account: response.data?.email,
            company: response.data?.companyName,
            from: this.formatMailbox(this.from),
          },
        };
      } catch (error) {
        const detail = this.describeSendError(error);
        this.logger.error(`❌ Brevo API check failed: ${detail}`);
        return {
          success: false,
          message: 'Brevo API connection failed',
          details: { error: detail },
        };
      }
    }

    if (!this.transporter) {
      return {
        success: false,
        message: 'SMTP transporter not initialized',
      };
    }

    try {
      // Verify connection
      const verified = await this.transporter.verify();
      this.logger.log('✅ SMTP connection verified successfully');

      return {
        success: true,
        message: 'SMTP connection successful',
        details: {
          verified,
          host: this.configService.get<string>('SMTP_HOST'),
          port: this.configService.get<number>('SMTP_PORT'),
          secure: this.configService.get<string>('SMTP_SECURE'),
        },
      };
    } catch (error) {
      this.logger.error('❌ SMTP connection test failed:', error);
      const err = error as any;
      return {
        success: false,
        message: 'SMTP connection failed',
        details: {
          error: err.message || String(error),
          code: err.code,
          errno: err.errno,
          syscall: err.syscall,
        },
      };
    }
  }

  /**
   * Send verification email with custom Swipick branding
   */
  async sendVerificationEmail(
    email: string,
    name: string,
    verificationLink: string,
  ): Promise<void> {
    this.logger.log(`📧 Attempting to send verification email to: ${email}`);
    this.logger.log(`📤 From email: ${this.formatMailbox(this.from)}`);
    this.logger.log(`🔗 Verification link: ${verificationLink}`);

    const emailTemplate = this.generateVerificationEmailTemplate(
      name,
      verificationLink,
    );
    this.logger.log(`📝 Email template generated for: ${name}`);

    try {
      const messageId = await this.sendEmail({
        to: email,
        subject: 'Verifica il tuo account Swipick',
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      this.logger.log(
        `✅ Verification email sent successfully to ${email}. Message ID: ${messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to send verification email to ${email}: ${this.describeSendError(error)}`,
      );
      throw this.withCause(
        "Errore durante l'invio dell'email di verifica",
        error,
      );
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    name: string,
    resetLink: string,
  ): Promise<void> {
    const emailTemplate = this.generatePasswordResetEmailTemplate(
      name,
      resetLink,
    );

    try {
      const messageId = await this.sendEmail({
        to: email,
        subject: 'Reset della password - Swipick',
        html: emailTemplate.html,
        text: emailTemplate.text,
      });

      this.logger.log(
        `Password reset email sent successfully to ${email}. Message ID: ${messageId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to ${email}: ${this.describeSendError(error)}`,
      );
      throw this.withCause(
        "Errore durante l'invio dell'email di reset password",
        error,
      );
    }
  }

  /** Il nome arriva dalla registrazione: non deve poter iniettare markup. */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * L'omino pixel della card di Gioca, riportato in HTML come griglia di celle
   * colorate invece che come immagine: i client che bloccano il caricamento
   * remoto mostrerebbero un rettangolo vuoto, una tabella la disegnano sempre.
   * Griglia e palette vengono da src/utils/pixelPlayers.ts dell'app (10x16,
   * posa idle); la maglia usa il viola del brand invece dei colori di squadra,
   * perche' qui non si parla di una partita.
   */
  private renderPixelPlayer(
    cell = 3,
    kit: { shirt: string; shorts: string; trim: string } = {
      // Maglia chiara: sul gradiente viola dell'intestazione il bianco stacca,
      // mentre il viola del brand ci si confonderebbe.
      shirt: '#ffffff',
      shorts: '#3b82f6',
      trim: '#c9a227',
    },
  ): string {
    const palette: Record<string, string> = {
      hair: '#241d18',
      skin: '#e3b78a',
      shirt: kit.shirt,
      shorts: kit.shorts,
      trim: kit.trim,
      boot: '#141414',
    };

    // [riga, [colInizio, colFine, materiale][]]
    const rows: Array<[number, Array<[number, number, string]>]> = [
      [0, [[3, 6, 'hair']]],
      [1, [[3, 6, 'hair']]],
      [2, [[3, 6, 'skin']]],
      [3, [[3, 6, 'skin']]],
      [4, [[4, 5, 'skin']]],
      [5, [[2, 7, 'shirt']]],
      [6, [[1, 8, 'shirt']]],
      [
        7,
        [
          [1, 1, 'skin'],
          [2, 7, 'shirt'],
          [8, 8, 'skin'],
        ],
      ],
      [8, [[2, 7, 'shirt']]],
      [9, [[2, 7, 'shirt']]],
      // Pantaloncini su quattro righe invece di due: gambe, calzettoni e
      // scarpini scalano di conseguenza, quindi la griglia diventa 10x18.
      [10, [[2, 7, 'shorts']]],
      [11, [[2, 7, 'shorts']]],
      [12, [[2, 7, 'shorts']]],
      [13, [[2, 7, 'shorts']]],
      [
        14,
        [
          [2, 3, 'skin'],
          [6, 7, 'skin'],
        ],
      ],
      [
        15,
        [
          [2, 3, 'skin'],
          [6, 7, 'skin'],
        ],
      ],
      [
        16,
        [
          [2, 3, 'trim'],
          [6, 7, 'trim'],
        ],
      ],
      [
        17,
        [
          [2, 3, 'boot'],
          [6, 7, 'boot'],
        ],
      ],
    ];

    const height = Math.max(...rows.map(([r]) => r)) + 1;
    const grid: string[][] = Array.from({ length: height }, () =>
      Array.from({ length: 10 }, () => ''),
    );
    rows.forEach(([r, segments]) =>
      segments.forEach(([from, to, material]) => {
        for (let c = from; c <= to; c++) grid[r][c] = palette[material];
      }),
    );

    // font-size/line-height a zero e un &nbsp; dentro ogni cella: senza, Outlook
    // collassa le celle vuote e la figura si deforma.
    const body = grid
      .map(
        (row) =>
          `<tr>${row
            .map(
              (color) =>
                `<td width="${cell}" height="${cell}" style="width:${cell}px; height:${cell}px; padding:0; font-size:0; line-height:0;${color ? ` background-color:${color};` : ''}">&nbsp;</td>`,
            )
            .join('')}</tr>`,
      )
      .join('');

    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt;">${body}</table>`;
  }

  /**
   * Scheletro condiviso dalle transazionali. Tabelle e stili inline invece di
   * un blocco <style>: Outlook ignora il secondo, e diversi client lo tolgono
   * del tutto. Colori allineati a src/theme/colors.ts dell'app.
   */
  private renderEmailShell(options: {
    preheader: string;
    heading: string;
    intro: string;
    ctaLabel: string;
    ctaUrl: string;
    validity: string;
    disclaimer: string;
  }): string {
    const font =
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Swipick</title>
</head>
<body style="margin:0; padding:0; background-color:#f9fafb;">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${options.preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden;">

        <tr>
          <td style="background-color:#4d32b1; background-image:linear-gradient(135deg,#554099 0%,#3d2d73 100%); padding:20px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:14px; vertical-align:middle;">${this.renderPixelPlayer()}</td>
                <td style="vertical-align:middle; white-space:nowrap;">
                  <span style="font-family:${font}; font-size:13px; color:#ffffff; vertical-align:middle;">&#9917;</span><span style="font-family:${font}; font-size:20px; font-weight:700; color:#ffffff; letter-spacing:-0.01em; vertical-align:middle;">&nbsp;Swipick</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 32px 8px 32px;">
            <h1 style="margin:0 0 12px 0; font-family:${font}; font-size:22px; line-height:1.3; font-weight:700; color:#1f2937;">${options.heading}</h1>
            <p style="margin:0 0 28px 0; font-family:${font}; font-size:16px; line-height:1.55; color:#4b5563;">${options.intro}</p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#6f49ff" style="border-radius:12px;">
                  <a href="${options.ctaUrl}" style="display:inline-block; padding:15px 30px; font-family:${font}; font-size:16px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:12px;">${options.ctaLabel}</a>
                </td>
              </tr>
            </table>

            <p style="margin:20px 0 0 0; font-family:${font}; font-size:14px; line-height:1.55; color:#6b7280;">${options.validity}</p>

            <p style="margin:24px 0 0 0; font-family:${font}; font-size:13px; line-height:1.5; color:#9ca3af;">
              Se il pulsante non funziona, copia questo indirizzo nel browser:<br>
              <span style="color:#5742a4; word-break:break-all;">${options.ctaUrl}</span>
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:24px 32px 32px 32px;">
            <div style="height:1px; background-color:#e5e7eb; margin-bottom:20px;"></div>
            <p style="margin:0; font-family:${font}; font-size:14px; line-height:1.55; color:#6b7280;">${options.disclaimer}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb;">
            <p style="margin:0; font-family:${font}; font-size:13px; color:#9ca3af;">Swipick &mdash; pronostici di Serie A</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
  }

  /**
   * Generate branded verification email template
   */
  private generateVerificationEmailTemplate(
    name: string,
    verificationLink: string,
  ): EmailTemplate {
    const safeName = this.escapeHtml(name);

    const html = this.renderEmailShell({
      preheader: 'Conferma il tuo indirizzo per iniziare a giocare su Swipick.',
      heading: `Ciao ${safeName}, manca un passaggio`,
      intro:
        'Per iniziare a giocare su Swipick devi confermare che questo indirizzo è tuo.',
      ctaLabel: "Conferma l'indirizzo",
      ctaUrl: verificationLink,
      validity:
        'Il link è valido 24 ore. Se scade, puoi richiederne uno nuovo dall’app.',
      disclaimer:
        'Se non ti sei registrato su Swipick, ignora pure questa email: senza conferma nessuno potrà accedere all’account.',
    });

    const text = `Ciao ${name}, manca un passaggio

Per iniziare a giocare su Swipick devi confermare che questo indirizzo è tuo.
Apri questo link:

${verificationLink}

Il link è valido 24 ore. Se scade, puoi richiederne uno nuovo dall'app.

Se non ti sei registrato su Swipick, ignora pure questa email: senza conferma
nessuno potrà accedere all'account.

Swipick — pronostici di Serie A`;

    return {
      to: '',
      subject: 'Conferma il tuo indirizzo email',
      html,
      text,
    };
  }

  /**
   * Generate branded password reset email template
   */
  private generatePasswordResetEmailTemplate(
    name: string,
    resetLink: string,
  ): EmailTemplate {
    const safeName = this.escapeHtml(name);

    const html = this.renderEmailShell({
      preheader: 'Scegli una nuova password per il tuo account Swipick.',
      heading: `Ciao ${safeName}, reimposta la password`,
      intro: 'Hai chiesto di cambiare la password del tuo account Swipick.',
      ctaLabel: 'Scegli una nuova password',
      ctaUrl: resetLink,
      validity: 'Il link è valido un’ora.',
      // Chi riceve un reset che non ha chiesto si allarma: dirgli che non è
      // successo nulla vale piu' di un generico "ignora questa email".
      disclaimer:
        'Se non sei stato tu, ignora questa email: la password attuale resta valida e nessuno può cambiarla senza aprire questo link.',
    });

    const text = `Ciao ${name}, reimposta la password

Hai chiesto di cambiare la password del tuo account Swipick.
Apri questo link per sceglierne una nuova:

${resetLink}

Il link è valido un'ora.

Se non sei stato tu, ignora questa email: la password attuale resta valida e
nessuno può cambiarla senza aprire questo link.

Swipick — pronostici di Serie A`;

    return {
      to: '',
      subject: 'Reimposta la tua password',
      html,
      text,
    };
  }
}
