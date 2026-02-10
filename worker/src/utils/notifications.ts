import axios from 'axios';
import { env } from '../config/env';
import { logger } from './logger';

export interface NotificationPayload {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  clientId?: string;
  auditType?: string;
  runId?: string;
  metadata?: Record<string, any>;
}

export async function sendSlackNotification(payload: NotificationPayload): Promise<void> {
  if (!env.SLACK_WEBHOOK_URL) {
    logger.debug('Slack webhook URL not configured, skipping notification');
    return;
  }

  try {
    const color = getSeverityColor(payload.severity);
    const slackPayload = {
      text: payload.title,
      attachments: [
        {
          color,
          fields: [
            {
              title: 'Message',
              value: payload.message,
              short: false,
            },
            {
              title: 'Severity',
              value: payload.severity.toUpperCase(),
              short: true,
            },
            ...(payload.clientId ? [{
              title: 'Client ID',
              value: payload.clientId,
              short: true,
            }] : []),
            ...(payload.auditType ? [{
              title: 'Audit Type',
              value: payload.auditType,
              short: true,
            }] : []),
            ...(payload.runId ? [{
              title: 'Run ID',
              value: payload.runId,
              short: true,
            }] : []),
          ],
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    };

    await axios.post(env.SLACK_WEBHOOK_URL, slackPayload, {
      timeout: 5000,
    });

    logger.debug({ payload }, 'Slack notification sent successfully');
  } catch (error) {
    logger.error({ error, payload }, 'Failed to send Slack notification');
  }
}

export async function sendEmailNotification(payload: NotificationPayload): Promise<void> {
  if (!env.NOTIFICATION_EMAIL) {
    logger.debug('Notification email not configured, skipping email');
    return;
  }

  // TODO: Implement email sending (e.g., using SendGrid, AWS SES, etc.)
  logger.info({ payload }, 'Email notification would be sent (not implemented)');
}

export async function notifyAuditFailure(
  clientId: string,
  auditType: string,
  runId: string,
  error: Error
): Promise<void> {
  const payload: NotificationPayload = {
    title: 'Audit Failure',
    message: `Audit failed for client ${clientId}: ${error.message}`,
    severity: 'critical',
    clientId,
    auditType,
    runId,
    metadata: {
      error: error.message,
      stack: error.stack,
    },
  };

  await Promise.allSettled([
    sendSlackNotification(payload),
    sendEmailNotification(payload),
  ]);
}

export async function notifyAuditRegression(
  clientId: string,
  auditType: string,
  runId: string,
  previousScore: number,
  currentScore: number
): Promise<void> {
  const scoreDrop = previousScore - currentScore;
  const severity: NotificationPayload['severity'] = 
    scoreDrop > 20 ? 'critical' : scoreDrop > 10 ? 'warning' : 'info';

  const payload: NotificationPayload = {
    title: 'Audit Score Regression',
    message: `Audit score dropped by ${scoreDrop} points (${previousScore} → ${currentScore})`,
    severity,
    clientId,
    auditType,
    runId,
    metadata: {
      previousScore,
      currentScore,
      scoreDrop,
    },
  };

  await Promise.allSettled([
    sendSlackNotification(payload),
    sendEmailNotification(payload),
  ]);
}

function getSeverityColor(severity: NotificationPayload['severity']): string {
  switch (severity) {
    case 'critical':
      return '#ff0000';
    case 'warning':
      return '#ffaa00';
    case 'info':
    default:
      return '#36a64f';
  }
}