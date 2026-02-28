/**
 * 이메일 발송 (nodemailer)
 */
import nodemailer from 'nodemailer';
import { env } from '$env/dynamic/private';

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST || 'localhost',
    port: Number(env.SMTP_PORT) || 587,
    secure: env.SMTP_SECURE === 'true',
    auth: {
        user: env.SMTP_USER || '',
        pass: env.SMTP_PASS || ''
    }
});

const FROM_ADDRESS = env.MAIL_FROM || 'noreply@example.com';
const FROM_NAME = env.MAIL_FROM_NAME || 'Angple';

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
