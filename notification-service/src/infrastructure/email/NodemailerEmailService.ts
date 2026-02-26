import nodemailer from 'nodemailer';
import { IEmailService, EmailData } from '../../domain/interfaces/IEmailService';

export class NodemailerEmailService implements IEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  async sendEmail(data: EmailData): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"Delivereats" <${process.env.SMTP_USER}>`,
        to: data.to,
        subject: data.subject,
        html: data.html
      });

      console.log(`✅ Email enviado a ${data.to}`);
    } catch (error) {
      console.error(`❌ Error enviando email a ${data.to}:`, error);
      throw error;
    }
  }
}
