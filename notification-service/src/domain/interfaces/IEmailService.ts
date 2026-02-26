export interface EmailData {
  to: string;
  subject: string;
  html: string;
}

export interface IEmailService {
  sendEmail(data: EmailData): Promise<void>;
}
