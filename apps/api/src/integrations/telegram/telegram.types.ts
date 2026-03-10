/**
 * Telegram Integration Types and Interfaces
 */

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  entities?: TelegramEntity[];
}

export interface TelegramEntity {
  type:
    | 'mention'
    | 'hashtag'
    | 'cashtag'
    | 'bot_command'
    | 'url'
    | 'email'
    | 'phone_number'
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikethrough'
    | 'code'
    | 'pre'
    | 'text_link'
    | 'text_mention';
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  chat_instance: string;
  message?: TelegramMessage;
  data?: string;
  inline_message_id?: string;
  game_short_name?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  my_chat_member?: any;
  chat_member?: any;
}

export interface TelegramWebhookPayload {
  ok: boolean;
  result?: any;
  error_code?: number;
  description?: string;
}

export interface TelegramVerificationSession {
  sessionId: string;
  botLink: string;
  expiresAt: Date;
}

export interface TelegramConnectionStatus {
  connected: boolean;
  enabled: boolean;
  chatId?: string;
  username?: string;
  firstName?: string;
  connectedAt?: Date;
}

export interface SendTelegramMessageDto {
  chat_id: string | number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: any;
}

export interface TelegramSecurityAlertDetails {
  location?: string;
  device?: string;
  time?: string;
  ip?: string;
  reason?: string;
}
