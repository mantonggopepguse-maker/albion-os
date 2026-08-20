/**
 * @file chat/page.tsx — Internal Team Chat
 *
 * Implements a **two-panel chat interface** for AlbionOS:
 *   • Left panel:  scrollable contact list with search, last-message preview,
 *                  and per-contact unread badge.
 *   • Right panel: message thread with date separators, sent/received bubble
 *                  alignment, read-receipt ticks, and a compose bar.
 *
 * Architecture notes:
 * ─────────────────────
 * 1. **User ID bridging** — The auth-context provides its own user IDs
 *    (e.g. `usr_001`), but the mock-data layer uses different UUIDs
 *    (e.g. `a1b2c3d4…`). We bridge the two systems by matching on email
 *    address. See `getDataUserId()`.
 *
 * 2. **Message filtering** — A thread between users A and B is all messages
 *    where (sender=A ∧ receiver=B) ∨ (sender=B ∧ receiver=A). This is
 *    computed in `threadMessages` via `useMemo`.
 *
 * 3. **Real-time send simulation** — `handleSend()` creates a new
 *    `ChatMessage` object with a synthetic `msg-local-{timestamp}` ID and
 *    appends it to local state. No network call is made (mock mode).
 *
 * 4. **Auto-scroll** — A `useEffect` watches `threadMessages.length` and
 *    scrolls a sentinel div into view whenever a new message appears.
 *
 * 5. **Unread count logic** — Any message where `receiver_id === me` and
 *    `is_read === false` increments the sender's unread count.
 *
 * Key sub-components:
 *   • ContactItem  — a single row in the left-panel contact list
 *   • MessageBubble — a single chat bubble (sent or received)
 */

'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Topbar from '@/components/layout/Topbar';
import { useAuth, getRoleLabel, getRoleColor } from '@/lib/auth-context';
import { useUsers, useChatMessages, useMyMessages } from '@/hooks/use-supabase-data';
import { uploadFile } from '@/lib/supabase/storage';
import type { ChatMessage, User } from '@/lib/types';
import styles from './chat.module.css';

// ============================================================================
// Section 1 — User ID Bridging — NO LONGER NEEDED
// ============================================================================
// With Supabase Auth, the auth user ID IS the profiles ID directly.
// The old email-based bridging functions have been removed.

// ============================================================================
// Section 2 — Display Helpers
// ============================================================================

/**
 * Extract up to two initials from a full name (e.g. "Chidi Okafor" → "CO").
 *
 * @param name - Full name string, may contain multiple words.
 * @returns Uppercase initials, max 2 characters.
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Format an ISO timestamp into a short HH:MM time string (Nigerian locale).
 *
 * @param iso - ISO-8601 date string.
 * @returns Time like "14:30".
 */
function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Produce a human-friendly date label for message-group separators.
 *
 * Logic:
 *   • Same calendar day → "Today"
 *   • Previous calendar day → "Yesterday"
 *   • Anything older → full date like "15 June 2026"
 *
 * @param iso - ISO-8601 date string of the first message in the group.
 * @returns A date label string.
 */
function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();

  // Check if the message date is today (same day, month, and year)
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (isToday) return 'Today';

  // Check if the message date is yesterday
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    d.getDate() === yesterday.getDate() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getFullYear() === yesterday.getFullYear();
  if (isYesterday) return 'Yesterday';

  // Fall back to a full, locale-formatted date string
  return d.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ============================================================================
// Section 3 — ContactItem Component
// ============================================================================

/**
 * ContactItem — a single row in the left-panel contact list.
 *
 * Displays:
 *   • Color-coded avatar with initials (color derived from the user's role)
 *   • Online status dot (always green — all users are shown as online in mock mode)
 *   • Full name + role label
 *   • Preview of the last message (truncated at 45 chars)
 *   • Timestamp of the last message
 *   • Unread message count badge (hidden when 0)
 *
 * @param user         - The contact's User object from mock data.
 * @param lastMessage  - Most recent ChatMessage in the conversation, or null.
 * @param unreadCount  - Number of unread messages from this contact.
 * @param isActive     - Whether this contact is currently selected.
 * @param onClick      - Callback to select this contact.
 */
function ContactItem({
  user,
  lastMessage,
  unreadCount,
  isActive,
  onClick,
}: {
  user: User;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  isActive: boolean;
  onClick: () => void;
}) {
  // Cast role to the union type expected by getRoleColor/getRoleLabel
  const role = user.role as 'super_admin' | 'sales_rep' | 'finance_manager' | 'inventory_manager';

  return (
    <button
      className={`${styles.contactItem} ${isActive ? styles.contactItemActive : ''}`}
      onClick={onClick}
    >
      {/* Avatar circle — background color reflects the user's role */}
      <div className={styles.avatar} style={{ backgroundColor: getRoleColor(role) }}>
        {getInitials(user.full_name)}
        {/* Green dot indicating online status */}
        <span className={styles.onlineDot} />
      </div>

      {/* Contact text info: name, role, and last message preview */}
      <div className={styles.contactInfo}>
        <span className={styles.contactName}>{user.full_name}</span>
        <span className={styles.contactRole}>{getRoleLabel(role)}</span>
        {/* Truncate last message to 45 characters for compact preview */}
        {lastMessage && (
          <span className={styles.contactPreview}>
            {lastMessage.content.slice(0, 45)}
            {lastMessage.content.length > 45 ? '...' : ''}
          </span>
        )}
      </div>

      {/* Right-side metadata: time + unread badge */}
      <div className={styles.contactMeta}>
        {lastMessage && (
          <span className={styles.contactTime}>
            {formatMessageTime(lastMessage.created_at)}
          </span>
        )}
        {/* Only render the badge when there are unread messages */}
        {unreadCount > 0 && (
          <span className={styles.unreadBadge}>{unreadCount}</span>
        )}
      </div>
    </button>
  );
}

// ============================================================================
// Section 4 — MessageBubble Component
// ============================================================================

/**
 * MessageBubble — renders a single chat message as a speech-bubble.
 *
 * Sent messages align right (blue); received messages align left (gray).
 * Read receipts are shown as single tick (✓ sent) or double tick (✓✓ read)
 * only on outgoing messages.
 *
 * @param message - The ChatMessage data to render.
 * @param isSent  - `true` if the current user sent this message.
 */
function MessageBubble({
  message,
  isSent,
}: {
  message: ChatMessage;
  isSent: boolean;
}) {
  return (
    <div
      className={`${styles.messageRow} ${
        isSent ? styles.messageRowSent : styles.messageRowReceived
      }`}
    >
      <div
        className={`${styles.messageBubble} ${
          isSent ? styles.messageSent : styles.messageReceived
        }`}
      >
        <span className={styles.messageContent}>{message.content}</span>

        {/* Attachment indicator — shown as a simple label (not a real preview) */}
        {message.attachment_url && (
          <div className={styles.messageAttachment}>
            📎 {message.attachment_type === 'image' ? 'Image attached' : 'File attached'}
          </div>
        )}

        {/* Timestamp + read-receipt ticks (only on sent messages) */}
        <span className={styles.messageTime}>
          {formatMessageTime(message.created_at)}
          {/* Double tick (✓✓) = read by recipient; single tick (✓) = delivered */}
          {isSent && (message.is_read ? ' ✓✓' : ' ✓')}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Section 5 — Main Chat Page Component
// ============================================================================

/**
 * ChatPage — the top-level page component for `/chat`.
 *
 * State overview:
 * ───────────────
 * • `selectedContactId` — which contact's thread is visible (null = none).
 * • `searchQuery` — filters the contact list by name or role.
 * • `newMessage` — controlled input for the compose bar.
 * • `localMessages` — full message list (clone of mock data + locally sent).
 *
 * Derived / memoized data:
 * ─────────────────────────
 * • `contacts`          — all users except the current user.
 * • `filteredContacts`  — contacts matching the search query.
 * • `threadMessages`    — messages between the current user and selected contact.
 * • `lastMessages`      — most recent message per contact (for preview).
 * • `unreadCounts`      — number of unread messages per contact.
 * • `groupedMessages`   — threadMessages grouped by calendar date for separators.
 */
export default function ChatPage() {
  const { user: authUser } = useAuth();

  /** ID of the currently selected contact (shown in the right panel). */
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  /** Search query for filtering the contact list. */
  const [searchQuery, setSearchQuery] = useState('');

  /** Controlled value of the message compose input. */
  const [newMessage, setNewMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ url: string; type: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Ref to the invisible sentinel div at the bottom of the messages area. */
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* With Supabase auth, the auth user ID IS the profiles ID — no bridging needed */
  const currentDataUserId = authUser?.id ?? null;

  /* Fetch users from Supabase profiles table for the contact list */
  const { users: allUsers } = useUsers();

  /* Fetch all messages for the current user (for contact list previews) */
  const { allMessages } = useMyMessages(currentDataUserId);

  /* Fetch thread messages between current user and selected contact */
  const { messages: threadMessages, sendMessage } = useChatMessages(currentDataUserId, selectedContactId);

  /**
   * Contact list — all users excluding the current user.
   */
  const contacts = useMemo(() => {
    if (!currentDataUserId) return allUsers;
    return allUsers.filter((u) => u.id !== currentDataUserId);
  }, [allUsers, currentDataUserId]);

  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');

  useEffect(() => {
    if (roleParam && !selectedContactId && contacts.length > 0) {
      const match = contacts.find((c) => c.role === roleParam);
      if (match) setSelectedContactId(match.id);
    }
  }, [roleParam, selectedContactId, contacts]);

  /**
   * Filtered contact list — narrows `contacts` by search query.
   * Matches against both full_name and role (case-insensitive).
   */
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [contacts, searchQuery]);

  /**
   * Last message per contact — used for the preview text in the contact list.
   */
  const lastMessages = useMemo(() => {
    const map: Record<string, ChatMessage> = {};
    if (!currentDataUserId) return map;

    allMessages.forEach((m) => {
      const otherId =
        m.sender_id === currentDataUserId ? m.receiver_id : m.sender_id;

      if (
        m.sender_id === currentDataUserId ||
        m.receiver_id === currentDataUserId
      ) {
        if (
          !map[otherId] ||
          new Date(m.created_at) > new Date(map[otherId].created_at)
        ) {
          map[otherId] = m;
        }
      }
    });
    return map;
  }, [allMessages, currentDataUserId]);

  /**
   * Unread message counts per contact.
   */
  const unreadCounts = useMemo(() => {
    const map: Record<string, number> = {};
    if (!currentDataUserId) return map;

    allMessages.forEach((m) => {
      if (m.receiver_id === currentDataUserId && !m.is_read) {
        map[m.sender_id] = (map[m.sender_id] || 0) + 1;
      }
    });
    return map;
  }, [allMessages, currentDataUserId]);

  /** The full User object for the currently selected contact, or null. */
  const selectedContact = useMemo(
    () => allUsers.find((u) => u.id === selectedContactId) ?? null,
    [allUsers, selectedContactId]
  );

  /**
   * Auto-scroll effect — whenever a new message is added to the thread,
   * scroll the sentinel div into view so the user always sees the latest.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages.length]);

  /**
   * Handle file selection — upload to Supabase Storage, then attach to pending message.
   */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContactId) return;

    setUploading(true);
    setUploadError(null);
    const result = await uploadFile('chat_attachments', file, `chat/${selectedContactId}/${file.name}`);
    setUploading(false);

    if (result.error) {
      console.error('File upload failed:', result.error);
      setUploadError('Failed to upload file. Please try again.');
      return;
    }

    const type = file.type.startsWith('image/') ? 'image' : 'document';
    setPendingAttachment({ url: result.url, type });
  };

  /**
   * Cancel the pending attachment.
   */
  const clearAttachment = () => {
    setPendingAttachment(null);
  };

  /**
   * Send a new message in the current thread.
   */
  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingAttachment) || !selectedContactId) return;
    await sendMessage(newMessage.trim(), pendingAttachment || undefined);
    setNewMessage('');
    setPendingAttachment(null);
  };

  /**
   * Keyboard handler for the compose input.
   * Enter (without Shift) sends the message; Shift+Enter allows line breaks.
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * Group thread messages by calendar date for rendering date separators.
   *
   * Iterates `threadMessages` (already sorted chronologically) and starts
   * a new group whenever the `toDateString()` value changes. Each group
   * carries the ISO date of its first message plus an array of messages.
   */
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    let currentDate = '';

    threadMessages.forEach((msg) => {
      const dateStr = new Date(msg.created_at).toDateString();
      if (dateStr !== currentDate) {
        // Start a new date group
        currentDate = dateStr;
        groups.push({ date: msg.created_at, messages: [msg] });
      } else {
        // Append to the current group
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  }, [threadMessages]);

  // Guard: if no user is authenticated, render nothing
  if (!authUser) return null;

  return (
    <div className={styles.page}>
      <Topbar title="Chat" />

      <div className={styles.chatContainer}>
        {/* ── Left Panel: Contact List ──────────────────────────────── */}
        <div className={styles.contactPanel}>
          {/* Panel header with title and search box */}
          <div className={styles.contactHeader}>
            <h2 className={styles.contactTitle}>Messages</h2>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Scrollable contact list */}
          <div className={styles.contactList}>
            {filteredContacts.map((contact) => (
              <ContactItem
                key={contact.id}
                user={contact}
                lastMessage={lastMessages[contact.id] ?? null}
                unreadCount={unreadCounts[contact.id] ?? 0}
                isActive={selectedContactId === contact.id}
                onClick={() => setSelectedContactId(contact.id)}
              />
            ))}
          </div>
        </div>

        {/* ── Right Panel: Message Thread ───────────────────────────── */}
        <div className={styles.messagePanel}>
          {selectedContact ? (
            <>
              {/* Thread header — shows selected contact's avatar, name, and status */}
              <div className={styles.threadHeader}>
                <button
                  onClick={() => setSelectedContactId(null)}
                  className={styles.mobileBackBtn}
                  title="Back to contacts"
                >
                  ← Contacts
                </button>
                <div
                  className={styles.threadAvatar}
                  style={{
                    backgroundColor: getRoleColor(
                      selectedContact.role as 'super_admin' | 'sales_rep' | 'finance_manager' | 'inventory_manager'
                    ),
                  }}
                >
                  {getInitials(selectedContact.full_name)}
                </div>
                <div className={styles.threadInfo}>
                  <span className={styles.threadName}>
                    {selectedContact.full_name}
                  </span>
                  {/* Hardcoded "Online" — all mock users are shown as online */}
                  <span className={styles.threadStatus}>● Online</span>
                </div>
              </div>

              {/* Messages area — scrollable container with date-grouped bubbles */}
              <div className={styles.messagesArea}>
                {groupedMessages.length === 0 ? (
                  /* Empty state for a thread with no messages yet */
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIconWrapper}>
                      <span className={styles.emptyIconInner}>👋</span>
                    </div>
                    <h3 className={styles.emptyTitle}>Start a conversation</h3>
                    <p className={styles.emptyText}>
                      Send a message to {selectedContact.full_name} to begin chatting.
                    </p>
                  </div>
                ) : (
                  groupedMessages.map((group, gi) => (
                    <div key={gi}>
                      {/* Date separator line (e.g. "Today", "Yesterday", "15 June 2026") */}
                      <div className={styles.dateSeparator}>
                        <span className={styles.dateSeparatorText}>
                          {formatDateLabel(group.date)}
                        </span>
                      </div>
                      {/* Render each message bubble within this date group */}
                      {group.messages.map((msg) => (
                        <MessageBubble
                          key={msg.id}
                          message={msg}
                          isSent={msg.sender_id === currentDataUserId}
                        />
                      ))}
                    </div>
                  ))
                )}
                {/* Invisible sentinel div — auto-scroll target */}
                <div ref={messagesEndRef} />
              </div>

              {/* Compose bar — input field + attach button + send button */}
              <div className={styles.inputArea}>
                {uploadError && (
                  <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 6px 8px' }}>
                    {uploadError}
                  </p>
                )}
                <div className={styles.inputContainer}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    className={styles.attachBtn}
                    title="Attach file"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? '⏳' : '📎'}
                  </button>
                  {pendingAttachment && (
                    <button
                      className={styles.attachBtn}
                      title="Remove attachment"
                      onClick={clearAttachment}
                      style={{ color: 'var(--color-success, #22c55e)' }}
                    >
                      📎✓
                    </button>
                  )}
                  <input
                    className={styles.messageInput}
                    type="text"
                    placeholder={
                      pendingAttachment
                        ? 'Add a caption or send without typing...'
                        : 'Type a message...'
                    }
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    className={styles.sendBtn}
                    onClick={handleSend}
                    title="Send message"
                    disabled={uploading || (!newMessage.trim() && !pendingAttachment)}
                  >
                    ➤
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Empty state — no contact selected yet */
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrapper}>
                <span className={styles.emptyIconInner}>💬</span>
              </div>
              <h3 className={styles.emptyTitle}>Select a conversation</h3>
              <p className={styles.emptyText}>
                Choose a contact from the list to start chatting. Your messages
                stay within the Albion team.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
