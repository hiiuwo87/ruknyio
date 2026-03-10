/**
 * Telegram Configuration
 */

export interface TelegramConfig {
  botToken: string;
  botName: string;
  webhookUrl: string;
  enabled: boolean;
  sessionExpiryMinutes: number;
  maxRetries: number;
  timeout: number;
}

export const getTelegramConfig = (): TelegramConfig => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const botName = process.env.TELEGRAM_BOT_NAME || 'RuknyBot';
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  const enabled = process.env.TELEGRAM_ENABLED === 'true';

  if (!botToken || !webhookUrl) {
    console.warn('⚠️ Telegram configuration is incomplete');
    return {
      botToken: '',
      botName,
      webhookUrl: '',
      enabled: false,
      sessionExpiryMinutes: 5,
      maxRetries: 3,
      timeout: 10000,
    };
  }

  return {
    botToken,
    botName,
    webhookUrl,
    enabled,
    sessionExpiryMinutes: parseInt(
      process.env.TELEGRAM_SESSION_EXPIRY || '5',
      10,
    ),
    maxRetries: parseInt(process.env.TELEGRAM_MAX_RETRIES || '3', 10),
    timeout: parseInt(process.env.TELEGRAM_TIMEOUT || '10000', 10),
  };
};
