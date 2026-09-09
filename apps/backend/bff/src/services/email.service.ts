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

  /**
   * Generate branded verification email template
   */
  private generateVerificationEmailTemplate(
    name: string,
    verificationLink: string,
  ): EmailTemplate {
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verifica Account - Swipick</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .email-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 20px;
            text-align: center;
          }
          .logo {
            color: #ffffff;
            font-size: 32px;
            font-weight: bold;
            margin: 0;
          }
          .email-content {
            padding: 40px 30px;
            text-align: center;
          }
          .welcome-title {
            color: #2d3748;
            font-size: 28px;
            font-weight: bold;
            margin: 0 0 20px 0;
          }
          .welcome-text {
            color: #4a5568;
            font-size: 16px;
            margin: 0 0 30px 0;
            line-height: 1.6;
          }
          .verify-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.2s ease;
          }
          .verify-button:hover {
            transform: translateY(-2px);
          }
          .email-footer {
            background-color: #f7fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          .footer-text {
            color: #718096;
            font-size: 14px;
            margin: 0;
          }
          .security-note {
            color: #718096;
            font-size: 14px;
            margin: 30px 0 0 0;
            padding: 20px;
            background-color: #f7fafc;
            border-radius: 6px;
            border-left: 4px solid #667eea;
          }
          @media (max-width: 600px) {
            .email-content {
              padding: 30px 20px;
            }
            .welcome-title {
              font-size: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <header class="email-header">
            <h1 class="logo">⚽ Swipick</h1>
          </header>
          
          <main class="email-content">
            <h1 class="welcome-title">Benvenuto su Swipick, ${name}!</h1>
            <p class="welcome-text">
              Grazie per esserti registrato! Per completare la registrazione e iniziare a giocare, 
              clicca il pulsante qui sotto per verificare il tuo account.
            </p>
            
            <a href="${verificationLink}" class="verify-button">
              ✅ Verifica Account
            </a>
            
            <div class="security-note">
              <strong>📧 Nota di sicurezza:</strong> Se non ti sei registrato su Swipick, 
              puoi ignorare questa email. Il tuo account non verrà creato senza la verifica.
            </div>
          </main>
          
          <footer class="email-footer">
            <p class="footer-text">
              <strong>Team Swipick</strong><br>
              La tua piattaforma di gaming preferita
            </p>
            <p class="footer-text" style="margin-top: 10px;">
              Questo è un messaggio automatico, non rispondere a questa email.
            </p>
          </footer>
        </div>
      </body>
      </html>
    `;

    const text = `
Benvenuto su Swipick, ${name}!

Grazie per esserti registrato! Per completare la registrazione e iniziare a giocare, visita il seguente link per verificare il tuo account:

${verificationLink}

Se non ti sei registrato su Swipick, puoi ignorare questa email.

Team Swipick
La tua piattaforma di gaming preferita
    `;

    return {
      to: '',
      subject: 'Verifica il tuo account Swipick',
      html,
      text,
    };
  }

  /**
   * Generate password reset email template
   */
  private generatePasswordResetEmailTemplate(
    name: string,
    resetLink: string,
  ): EmailTemplate {
    const html = `
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password - Swipick</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333333;
            margin: 0;
            padding: 0;
            background-color: #f8fafc;
          }
          .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .email-header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            padding: 40px 20px;
            text-align: center;
          }
          .logo {
            color: #ffffff;
            font-size: 32px;
            font-weight: bold;
            margin: 0;
          }
          .email-content {
            padding: 40px 30px;
            text-align: center;
          }
          .reset-title {
            color: #2d3748;
            font-size: 28px;
            font-weight: bold;
            margin: 0 0 20px 0;
          }
          .reset-text {
            color: #4a5568;
            font-size: 16px;
            margin: 0 0 30px 0;
            line-height: 1.6;
          }
          .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: #ffffff;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            margin: 20px 0;
            transition: transform 0.2s ease;
          }
          .reset-button:hover {
            transform: translateY(-2px);
          }
          .email-footer {
            background-color: #f7fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          .footer-text {
            color: #718096;
            font-size: 14px;
            margin: 0;
          }
          .security-note {
            color: #718096;
            font-size: 14px;
            margin: 30px 0 0 0;
            padding: 20px;
            background-color: #fef5e7;
            border-radius: 6px;
            border-left: 4px solid #f6ad55;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <header class="email-header">
            <h1 class="logo">⚽ Swipick</h1>
          </header>
          
          <main class="email-content">
            <h1 class="reset-title">Reset Password</h1>
            <p class="reset-text">
              Ciao ${name}, hai richiesto il reset della tua password. 
              Clicca il pulsante qui sotto per impostare una nuova password.
            </p>
            
            <a href="${resetLink}" class="reset-button">
              🔐 Reset Password
            </a>
            
            <div class="security-note">
              <strong>⚠️ Importante:</strong> Se non hai richiesto il reset della password, 
              ignora questa email. Il link scadrà tra 1 ora per sicurezza.
            </div>
          </main>
          
          <footer class="email-footer">
            <p class="footer-text">
              <strong>Team Swipick</strong><br>
              La tua piattaforma di gaming preferita
            </p>
          </footer>
        </div>
      </body>
      </html>
    `;

    const text = `
Reset Password - Swipick

Ciao ${name}, hai richiesto il reset della tua password.

Visita il seguente link per impostare una nuova password:
${resetLink}

Se non hai richiesto il reset della password, ignora questa email. Il link scadrà tra 1 ora per sicurezza.

Team Swipick
La tua piattaforma di gaming preferita
    `;

    return {
      to: '',
      subject: 'Reset della password - Swipick',
      html,
      text,
    };
  }
}
