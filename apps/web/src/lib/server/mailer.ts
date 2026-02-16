/**
 * 이메일 발송 (nodemailer)
 */
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
});

const FROM_ADDRESS = process.env.MAIL_FROM || 'noreply@example.com';
const FROM_NAME = process.env.MAIL_FROM_NAME || 'Angple';

export async function sendMail(options: {
    to: string;
    subject: string;
    html: string;
}): Promise<void> {
    await transporter.sendMail({
        from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
        to: options.to,
        subject: options.subject,
        html: options.html
    });
}
