// Search management module

import { state } from './state.js';

export function searchMessages(messages, query) {
  if (!query) return messages;

  const lowerQuery = query.toLowerCase();
  return messages.filter(msg => {
    if (msg.eventType.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    if (msg.data.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    if (msg.lastEventId && msg.lastEventId.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    return false;
  });
}
