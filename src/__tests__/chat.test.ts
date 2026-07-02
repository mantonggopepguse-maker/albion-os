import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getChatMessages,
  sendChatMessage,
} from '@/lib/data-service';
import {
  MOCK_CHAT_MESSAGES,
} from '@/lib/mock-data';

let chatSnapshot: typeof MOCK_CHAT_MESSAGES;

function saveSnapshots() {
  chatSnapshot = JSON.parse(JSON.stringify(MOCK_CHAT_MESSAGES));
}

function restoreSnapshots() {
  MOCK_CHAT_MESSAGES.length = 0;
  MOCK_CHAT_MESSAGES.push(...chatSnapshot);
}

beforeEach(() => {
  saveSnapshots();
});

afterEach(() => {
  restoreSnapshots();
});

describe('getChatMessages', () => {
  it('returns all chat messages', async () => {
    const messages = await getChatMessages();
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBeGreaterThan(0);
  });

  it('returns messages sorted by created_at', async () => {
    const messages = await getChatMessages();
    for (let i = 1; i < messages.length; i++) {
      expect(new Date(messages[i].created_at).getTime())
        .toBeGreaterThanOrEqual(new Date(messages[i - 1].created_at).getTime());
    }
  });
});

describe('sendChatMessage', () => {
  it('rejects empty message without attachment', async () => {
    const result = await sendChatMessage('sender-1', 'receiver-1', '');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Message');
  });

  it('sends a text message', async () => {
    const result = await sendChatMessage(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      'Hello, how are you?'
    );
    expect(result.success).toBe(true);
    expect(result.data?.content).toBe('Hello, how are you?');
    expect(result.data?.is_read).toBe(false);
    expect(result.data?.attachment_url).toBeNull();
  });

  it('sends a message with attachment', async () => {
    const result = await sendChatMessage(
      'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'Check this file',
      { url: '/uploads/test.pdf', type: 'application/pdf' }
    );
    expect(result.success).toBe(true);
    expect(result.data?.content).toBe('Check this file');
    expect(result.data?.attachment_url).toBe('/uploads/test.pdf');
    expect(result.data?.attachment_type).toBe('application/pdf');
  });

  it('appends to the messages list', async () => {
    const before = await getChatMessages();
    await sendChatMessage(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      'New message'
    );
    const after = await getChatMessages();
    expect(after.length).toBe(before.length + 1);
  });
});
