"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const resend_1 = require("resend");
let EmailService = EmailService_1 = class EmailService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(EmailService_1.name);
        this.resend = null;
        const apiKey = this.configService.get('RESEND_API_KEY');
        this.logger.log(`🔧 Initializing EmailService...`);
        this.logger.log(`🔑 API Key exists: ${!!apiKey}`);
        this.logger.log(`🔑 API Key length: ${apiKey ? apiKey.length : 0}`);
        if (!apiKey) {
            this.logger.error('❌ RESEND_API_KEY not found. Email service will not function.');
            return;
        }
        try {
            this.resend = new resend_1.Resend(apiKey);
            this.logger.log('✅ Email service initialized with Resend successfully');
        }
        catch (error) {
            this.logger.error('❌ Failed to initialize Resend:', error);
        }
    }
    async sendVerificationEmail(email, name, verificationLink) {
        this.logger.log(`📧 Attempting to send verification email to: ${email}`);
        try {
            if (!this.resend) {
                const error = new Error('Resend not initialized - missing API key');
                this.logger.error('❌ Resend service not available:', error);
                throw error;
            }
            const fromEmail = this.configService.get('RESEND_FROM_EMAIL', 'Swipick <onboarding@resend.dev>');
            this.logger.log(`📤 From email: ${fromEmail}`);
            this.logger.log(`🔗 Verification link: ${verificationLink}`);
            const emailTemplate = this.generateVerificationEmailTemplate(name, verificationLink);
            this.logger.log(`📝 Email template generated for: ${name}`);
            const result = await this.resend.emails.send({
                from: fromEmail,
                to: email,
                subject: 'Verifica il tuo account Swipick',
                html: emailTemplate.html,
                text: emailTemplate.text,
            });
            this.logger.log(`✅ Verification email sent successfully to ${email}. ID: ${result.data?.id}`);
            this.logger.log(`📊 Resend response:`, JSON.stringify(result, null, 2));
        }
        catch (error) {
            this.logger.error(`❌ Failed to send verification email to ${email}`, error);
            this.logger.error(`❌ Error details:`, JSON.stringify(error, null, 2));
            throw new Error("Errore durante l'invio dell'email di verifica");
        }
    }
    async sendPasswordResetEmail(email, name, resetLink) {
        try {
            if (!this.resend) {
                throw new Error('Resend not initialized - missing API key');
            }
            const fromEmail = this.configService.get('RESEND_FROM_EMAIL', 'noreply@swipick.com');
            const emailTemplate = this.generatePasswordResetEmailTemplate(name, resetLink);
            const result = await this.resend.emails.send({
                from: fromEmail,
                to: email,
                subject: 'Reset della password - Swipick',
                html: emailTemplate.html,
                text: emailTemplate.text,
            });
            this.logger.log(`Password reset email sent successfully to ${email}. ID: ${result.data?.id}`);
        }
        catch (error) {
            this.logger.error(`Failed to send password reset email to ${email}`, error);
            throw new Error("Errore durante l'invio dell'email di reset password");
        }
    }
    generateVerificationEmailTemplate(name, verificationLink) {
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
    generatePasswordResetEmailTemplate(name, resetLink) {
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
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EmailService);
//# sourceMappingURL=email.service.js.map