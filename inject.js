(function() {
  // Prevent multiple injections
  if (window.__STREAM_PANEL_INJECTED__) return;
  window.__STREAM_PANEL_INJECTED__ = true;

  const OriginalEventSource = window.EventSource;
  const OriginalFetch = window.fetch;

  // Generate unique ID
  function generateId() {
    return 'stream_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  // Send message to content script
  function postToContentScript(data) {
    window.postMessage({
      source: 'stream-panel-inject',
      payload: data
    }, '*');
  }

  // Parse SSE data from chunk
  function parseSSEEvents(text) {
    const events = [];
    const lines = text.split('\n');
    let currentEvent = { data: '', event: 'message', id: '' };

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        currentEvent.data += (currentEvent.data ? '\n' : '') + data;
      } else if (line.startsWith('event:')) {
        currentEvent.event = line.slice(6).trim();
      } else if (line.startsWith('id:')) {
        currentEvent.id = line.slice(3).trim();
      } else if (line === '' && currentEvent.data) {
        events.push({ ...currentEvent });
        currentEvent = { data: '', event: 'message', id: '' };
      }
    }

    return events;
  }

  // ============================================
  // Intercept native EventSource
  // ============================================
  window.EventSource = function(url, options) {
    const es = new OriginalEventSource(url, options);
    const connectionId = generateId();
    let messageIndex = 0;

    // Resolve full URL
    const fullUrl = new URL(url, window.location.href).href;

    // Notify new connection
    postToContentScript({
      type: 'stream-connection',
      connectionId: connectionId,
      url: fullUrl,
      timestamp: Date.now(),
      readyState: es.readyState,
      source: 'EventSource'
    });

    // Listen for open event
    es.addEventListener('open', function() {
      postToContentScript({
        type: 'stream-open',
        connectionId: connectionId,
        timestamp: Date.now(),
        readyState: es.readyState
      });
    });

    // Listen for message event
    const originalAddEventListener = es.addEventListener.bind(es);
    es.addEventListener = function(type, listener, options) {
      if (type === 'message' || type.startsWith('message')) {
        const wrappedListener = function(event) {
          messageIndex++;
          postToContentScript({
            type: 'stream-message',
            connectionId: connectionId,
            messageId: messageIndex,
            eventType: event.type,
            data: event.data,
            lastEventId: event.lastEventId || '',
            timestamp: Date.now()
          });
          listener.call(this, event);
        };
        return originalAddEventListener(type, wrappedListener, options);
      }
      return originalAddEventListener(type, listener, options);
    };

    // Intercept onmessage setter
    let _onmessage = null;
    Object.defineProperty(es, 'onmessage', {
      get: function() {
        return _onmessage;
      },
      set: function(handler) {
        _onmessage = handler;
        originalAddEventListener('message', function(event) {
          messageIndex++;
          postToContentScript({
            type: 'stream-message',
            connectionId: connectionId,
            messageId: messageIndex,
            eventType: event.type,
            data: event.data,
            lastEventId: event.lastEventId || '',
            timestamp: Date.now()
          });
        });
      }
    });

    // Listen for error event
    es.addEventListener('error', function() {
      postToContentScript({
        type: 'stream-error',
        connectionId: connectionId,
        timestamp: Date.now(),
        readyState: es.readyState
      });
    });

    // Intercept close method
    const originalClose = es.close.bind(es);
    es.close = function() {
      postToContentScript({
        type: 'stream-close',
        connectionId: connectionId,
        timestamp: Date.now()
      });
      return originalClose();
    };

    return es;
  };

  // Copy static properties
  window.EventSource.prototype = OriginalEventSource.prototype;
  window.EventSource.CONNECTING = OriginalEventSource.CONNECTING;
  window.EventSource.OPEN = OriginalEventSource.OPEN;
  window.EventSource.CLOSED = OriginalEventSource.CLOSED;

  // ============================================
  // Intercept Fetch-based SSE
  // ============================================
  window.fetch = async function(...args) {
    const response = await OriginalFetch.apply(this, args);

    // Check if response is SSE
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      return response;
    }

    // Get request URL
    let requestUrl = '';
    if (typeof args[0] === 'string') {
      requestUrl = args[0];
    } else if (args[0] instanceof Request) {
      requestUrl = args[0].url;
    } else if (args[0] && args[0].url) {
      requestUrl = args[0].url;
    }
    const fullUrl = new URL(requestUrl, window.location.href).href;

    const connectionId = generateId();
    let messageIndex = 0;

    // Notify new connection
    postToContentScript({
      type: 'stream-connection',
      connectionId: connectionId,
      url: fullUrl,
      timestamp: Date.now(),
      readyState: 1,
      source: 'fetch'
    });

    // Notify open
    postToContentScript({
      type: 'stream-open',
      connectionId: connectionId,
      timestamp: Date.now(),
      readyState: 1
    });

    // Clone body to intercept
    if (!response.body) {
      return response;
    }

    const originalBody = response.body;
    const reader = originalBody.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Create a new ReadableStream that intercepts data
    const interceptedStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Process any remaining buffer
              if (buffer.trim()) {
                const events = parseSSEEvents(buffer);
                for (const event of events) {
                  messageIndex++;
                  postToContentScript({
                    type: 'stream-message',
                    connectionId: connectionId,
                    messageId: messageIndex,
                    eventType: event.event,
                    data: event.data,
                    lastEventId: event.id,
                    timestamp: Date.now()
                  });
                }
              }

              postToContentScript({
                type: 'stream-close',
                connectionId: connectionId,
                timestamp: Date.now()
              });

              controller.close();
              break;
            }

            // Decode and buffer the chunk
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Parse complete SSE events from buffer
            const doubleNewlineIndex = buffer.lastIndexOf('\n\n');
            if (doubleNewlineIndex !== -1) {
              const completeData = buffer.substring(0, doubleNewlineIndex + 2);
              buffer = buffer.substring(doubleNewlineIndex + 2);

              const events = parseSSEEvents(completeData);
              for (const event of events) {
                messageIndex++;
                postToContentScript({
                  type: 'stream-message',
                  connectionId: connectionId,
                  messageId: messageIndex,
                  eventType: event.event,
                  data: event.data,
                  lastEventId: event.id,
                  timestamp: Date.now()
                });
              }
            }

            // Pass through the original data
            controller.enqueue(value);
          }
        } catch (error) {
          postToContentScript({
            type: 'stream-error',
            connectionId: connectionId,
            timestamp: Date.now(),
            error: error.message
          });
          controller.error(error);
        }
      },

      cancel() {
        postToContentScript({
          type: 'stream-close',
          connectionId: connectionId,
          timestamp: Date.now()
        });
        reader.cancel();
      }
    });

    // Create new response with intercepted body
    return new Response(interceptedStream, {
      headers: response.headers,
      status: response.status,
      statusText: response.statusText
    });
  };

  console.log('[Stream Panel] EventSource & Fetch SSE interceptor injected');
})();
