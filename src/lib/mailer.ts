import nodemailer from "nodemailer";
import { ENV } from "../config/env";

export const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: ENV.EMAIL_USER,
        pass: ENV.EMAIL_PASS,
    },
});

export const sendVerificationEmail = async (email: string, code: string, name: string) => {
    await transporter.sendMail({
        from: `"Rester" <${ENV.EMAIL_USER}>`,
        to: email,
        subject: "Your Rester verification code",
        html: `
            <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; background: #0f0f0f; color: white; padding: 32px; border-radius: 12px;">
                <h2 style="font-weight: 300; letter-spacing: 6px; text-align: center;">Rester</h2>
                <p style="color: #aaa;">Hi ${name},</p>
                <p style="color: #aaa;">Your verification code is:</p>
                <div style="font-size: 36px; font-weight: 600; letter-spacing: 12px; text-align: center; padding: 24px; background: #181818; border-radius: 10px; margin: 24px 0;">
                    ${code}
                </div>
                <p style="color: #555; font-size: 13px; text-align: center;">This code expires in 10 minutes.</p>
            </div>
        `,
    });
};