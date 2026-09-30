import nodemailer from 'nodemailer';
import mjml from 'mjml';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

async function renderMjml(template: string): Promise<string> {
  const result = await mjml(template);
  if (result.errors && result.errors.length > 0) {
    logger.warn({ errors: result.errors }, 'MJML template rendering had errors');
  }
  return result.html;
}

// Campaign Scheduled Notification
export async function sendCampaignScheduledEmail(
  to: string,
  campaignName: string,
  totalRecipients: number,
  scheduledWindow: string
): Promise<void> {
  const mjmlTemplate = `
    <mjml>
      <mj-head>
        <mj-attributes>
          <mj-all font-family="Inter, Helvetica, Arial, sans-serif" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#f4f4f7">
        <mj-section background-color="#25D366" padding="20px">
          <mj-column>
            <mj-text color="#ffffff" font-size="24px" font-weight="bold" align="center">
              📋 Campaign Scheduled
            </mj-text>
          </mj-column>
        </mj-section>
        <mj-section background-color="#ffffff" padding="30px">
          <mj-column>
            <mj-text font-size="16px" color="#333333">
              Your campaign <strong>${campaignName}</strong> has been scheduled successfully.
            </mj-text>
            <mj-divider border-color="#e0e0e0" />
            <mj-text font-size="14px" color="#555555">
              <strong>Total Recipients:</strong> ${totalRecipients}<br/>
              <strong>Delivery Window:</strong> ${scheduledWindow}
            </mj-text>
            <mj-text font-size="13px" color="#888888" padding-top="20px">
              You will receive a summary email once all deliveries are complete.
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

  const html = await renderMjml(mjmlTemplate);

  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to,
      subject: `Campaign Scheduled: ${campaignName}`,
      html,
    });
    logger.info({ to, campaignName }, 'Campaign scheduled email sent');
  } catch (error) {
    logger.error({ error, to }, 'Failed to send campaign scheduled email');
  }
}

// Campaign Completed Notification
export async function sendCampaignCompletedEmail(
  to: string,
  campaignName: string,
  stats: { sent: number; delivered: number; failed: number; total: number }
): Promise<void> {
  const successRate = stats.total > 0 ? Math.round((stats.delivered / stats.total) * 100) : 0;

  const mjmlTemplate = `
    <mjml>
      <mj-head>
        <mj-attributes>
          <mj-all font-family="Inter, Helvetica, Arial, sans-serif" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#f4f4f7">
        <mj-section background-color="#25D366" padding="20px">
          <mj-column>
            <mj-text color="#ffffff" font-size="24px" font-weight="bold" align="center">
              ✅ Campaign Complete
            </mj-text>
          </mj-column>
        </mj-section>
        <mj-section background-color="#ffffff" padding="30px">
          <mj-column>
            <mj-text font-size="16px" color="#333333">
              Your campaign <strong>${campaignName}</strong> has completed.
            </mj-text>
            <mj-divider border-color="#e0e0e0" />
            <mj-text font-size="14px" color="#555555">
              <strong>Total:</strong> ${stats.total}<br/>
              <strong>Sent:</strong> ${stats.sent}<br/>
              <strong>Delivered:</strong> ${stats.delivered}<br/>
              <strong>Failed:</strong> ${stats.failed}<br/>
              <strong>Success Rate:</strong> ${successRate}%
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

  const html = await renderMjml(mjmlTemplate);

  try {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to,
      subject: `Campaign Complete: ${campaignName} — ${successRate}% success`,
      html,
    });
    logger.info({ to, campaignName, stats }, 'Campaign completed email sent');
  } catch (error) {
    logger.error({ error, to }, 'Failed to send campaign completed email');
  }
}
