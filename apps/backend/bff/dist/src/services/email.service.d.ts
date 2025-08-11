import { ConfigService } from '@nestjs/config';
export interface EmailTemplate {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare class EmailService {
    private configService;
    private readonly logger;
    private resend;
    constructor(configService: ConfigService);
    sendVerificationEmail(email: string, name: string, verificationLink: string): Promise<void>;
    sendPasswordResetEmail(email: string, name: string, resetLink: string): Promise<void>;
    private generateVerificationEmailTemplate;
    private generatePasswordResetEmailTemplate;
}
