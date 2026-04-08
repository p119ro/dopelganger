'use strict';

const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT  || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return _transporter;
}

const APP_NAME = 'Doppelganger';
const FROM = process.env.SMTP_FROM || `"${APP_NAME}" <noreply@doppelganger.app>`;
const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

/**
 * Send email-verification link to a new user.
 * token — raw (unhashed) verify token
 */
async function sendVerificationEmail(email, username, token) {
  const link = `${BASE_URL}/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  const html = `
  <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#0d0d1a;color:#fff;padding:36px;border-radius:14px;border:1px solid rgba(0,212,255,.2);">
    <h1 style="color:#00d4ff;margin:0 0 4px;letter-spacing:2px;font-size:1.5rem;">DOPPELGANGER</h1>
    <p style="color:#666;margin:0 0 28px;font-size:.85rem;">Become the One Who Wins</p>
    <p style="margin:0 0 12px;">Hey <strong>${username}</strong>,</p>
    <p style="margin:0 0 24px;color:#ccc;">Click the button below to verify your email and unlock your account.</p>
    <a href="${link}"
       style="display:inline-block;background:#00d4ff;color:#0d0d1a;padding:13px 28px;border-radius:7px;
              text-decoration:none;font-weight:700;font-size:1rem;letter-spacing:.5px;">
      Verify Email
    </a>
    <p style="margin:24px 0 0;color:#555;font-size:.8rem;">
      This link expires in 24 hours.<br>
      If you didn't create a Doppelganger account you can safely ignore this email.
    </p>
  </div>`;

  await getTransporter().sendMail({
    from: FROM,
    to: email,
    subject: `Verify your ${APP_NAME} account`,
    html,
    text: `Hey ${username}, verify your Doppelganger account here: ${link}\n\nLink expires in 24 hours.`,
  });
}

/**
 * Returns true if the email service is configured.
 * Used to degrade gracefully when SMTP creds are absent (e.g., local dev).
 */
function emailConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

module.exports = { sendVerificationEmail, emailConfigured };
