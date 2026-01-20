(function () {
  'use strict';

  // State management module

  const state = {
    connections: {},
    selectedConnectionId: null,
    selectedMessageId: null,
    filter: '',
    requestTypeFilter: 'all',
    messageFilters: [],
    pendingFilters: [],
    searchQuery: ''
  };

  function setFilter(filter) {
    state.filter = filter;
  }

  function setRequestTypeFilter(type) {
    state.requestTypeFilter = type;
  }

  function setSearchQuery(query) {
    state.searchQuery = query;
  }

  function clearAllData() {
    state.connections = {};
    state.selectedConnectionId = null;
    state.selectedMessageId = null;
  }

  // Utility functions module

  function log(...args) {
    if (window.__STREAM_PANEL_DEBUG__) {
      console.log('[Stream Panel DevTools]', ...args);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Failed to copy:', err);
    }

    document.body.removeChild(textarea);
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const timeStr = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${timeStr}.${milliseconds}`;
  }

  function formatTimestampForExport(timestamp) {
    const date = new Date(timestamp);
    return date.toISOString();
  }

  function syntaxHighlight(json) {
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function(match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
            match = match.slice(0, -1);
            return '<span class="' + cls + '">' + escapeHtml(match) + '</span>:';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + escapeHtml(match) + '</span>';
      }
    );
  }

  function getUrlPath(url) {
    try {
      const u = new URL(url);
      return u.pathname + u.search;
    } catch (e) {
      return url;
    }
  }

  function getRequestType(source) {
    if (!source) return 'unknown';
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes('xmlhttprequest')) return 'xhr';
    if (lowerSource.includes('fetch')) return 'fetch';
    if (lowerSource.includes('eventsource')) return 'eventsource';
    return 'unknown';
  }

  function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  function getStatusText(status) {
    const statusMap = {
      'connecting': '连接中',
      'open': '已连接',
      'closed': '已关闭',
      'error': '错误'
    };
    return statusMap[status] || status;
  }

  function downloadFile(content, filename, mimeType) {
    const bom = mimeType === 'text/csv' ? '\uFEFF' : '';
    const blob = new Blob([bom + content], { type: mimeType + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  // Connection management module


  let elements$7 = {};
  let callbacks$4 = {
    renderMessageList: null,
    showListView: null,
    renderFilterConditions: null
  };

  function initConnectionManager(el) {
    elements$7 = el;
  }

  function setCallbacks$4(cb) {
    callbacks$4 = { ...callbacks$4, ...cb };
  }

  function renderConnectionList() {
    const connections = Object.values(state.connections);
    const urlFilter = state.filter.toLowerCase();
    const typeFilter = state.requestTypeFilter;

    let filtered = urlFilter
      ? connections.filter(c => c.url.toLowerCase().includes(urlFilter))
      : connections;

    if (typeFilter !== 'all') {
      filtered = filtered.filter(c => {
        const requestType = getRequestType(c.source);
        return requestType === typeFilter;
      });
    }

    filtered.sort((a, b) => b.createdAt - a.createdAt);

    if (filtered.length === 0) {
      elements$7.connectionList.innerHTML = '<div class="empty-state">暂无连接</div>';
      return;
    }

    elements$7.connectionList.innerHTML = filtered.map(conn => {
      const urlPath = getUrlPath(conn.url);
      const isSelected = conn.id === state.selectedConnectionId;
      const badgeClass = conn.isIframe ? 'badge-iframe' : 'badge-main';
      const badgeText = conn.isIframe ? 'iframe' : '主页面';
      const statusClass = `status-${conn.status}`;

      return `
      <div class="connection-item ${isSelected ? 'selected' : ''}" data-id="${conn.id}">
        <div class="connection-url" title="${escapeHtml(conn.url)}">${escapeHtml(urlPath)}</div>
        <div class="connection-meta">
          <span class="status-dot ${statusClass}"></span>
          <span class="connection-badge ${badgeClass}">${badgeText}</span>
          <span class="message-count">${conn.messages.length} 条</span>
        </div>
      </div>
    `;
    }).join('');

    elements$7.connectionList.querySelectorAll('.connection-item').forEach(item => {
      item.addEventListener('click', () => {
        selectConnection(item.dataset.id);
      });
    });
  }

  function selectConnection(connectionId) {
    const isSelected = setSelectedConnection(connectionId);

    renderConnectionList();
    if (callbacks$4.renderMessageList) callbacks$4.renderMessageList();
    if (callbacks$4.showListView) callbacks$4.showListView();

    if (isSelected && state.pendingFilters.length > 0) {
      elements$7.messageFilterContainer.style.display = 'block';
      elements$7.btnToggleFilter.classList.add('expanded');
      if (callbacks$4.renderFilterConditions) callbacks$4.renderFilterConditions();
    }
  }

  function handleStreamEvent(payload) {
    log('Handling stream event:', payload.type, payload);

    switch (payload.type) {
      case 'stream-connection':
        addConnection({
          id: payload.connectionId,
          url: payload.url,
          frameUrl: payload.frameUrl,
          isIframe: payload.isIframe,
          source: payload.source || 'unknown',
          status: 'connecting',
          createdAt: payload.timestamp,
          messages: []
        });
        log('Created connection:', payload.connectionId, payload.url);
        renderConnectionList();
        break;

      case 'stream-open':
        updateConnectionStatus(payload.connectionId, 'open');
        log('Connection opened:', payload.connectionId);
        renderConnectionList();
        break;

      case 'stream-message':
        addMessage(payload.connectionId, {
          id: payload.messageId,
          eventType: payload.eventType,
          data: payload.data,
          lastEventId: payload.lastEventId,
          timestamp: payload.timestamp
        });
        log('Added message #' + payload.messageId + ' to connection:', payload.connectionId);
        renderConnectionList();
        if (state.selectedConnectionId === payload.connectionId && callbacks$4.renderMessageList) {
          callbacks$4.renderMessageList();
        }
        break;

      case 'stream-error':
        updateConnectionStatus(payload.connectionId, 'error');
        renderConnectionList();
        break;

      case 'stream-close':
        updateConnectionStatus(payload.connectionId, 'closed');
        renderConnectionList();
        break;
    }
  }

  // Re-export state functions for use in this module
  function setSelectedConnection(connectionId) {
    if (state.selectedConnectionId === connectionId) {
      state.selectedConnectionId = null;
      state.selectedMessageId = null;
      return false;
    }
    state.selectedConnectionId = connectionId;
    state.selectedMessageId = null;
    state.pendingFilters = JSON.parse(JSON.stringify(state.messageFilters));
    return true;
  }

  function addConnection(connectionData) {
    state.connections[connectionData.id] = connectionData;
  }

  function addMessage(connectionId, messageData) {
    if (state.connections[connectionId]) {
      state.connections[connectionId].messages.push(messageData);
    }
  }

  function updateConnectionStatus(connectionId, status) {
    if (state.connections[connectionId]) {
      state.connections[connectionId].status = status;
    }
  }

  // View management module

  let elements$6 = {};

  function initViewManager(el) {
    elements$6 = el;
  }

  function showListView() {
    elements$6.messageListView.classList.add('active');
    elements$6.detailView.classList.remove('active');
  }

  function showDetailView() {
    elements$6.messageListView.classList.remove('active');
    elements$6.detailView.classList.add('active');
  }

  // Message rendering module


  let elements$5 = {};
  let callbacks$3 = {
    filterMessages: null,
    searchMessages: null
  };

  function initMessageRenderer(el) {
    elements$5 = el;
  }

  function setCallbacks$3(cb) {
    callbacks$3 = { ...callbacks$3, ...cb };
  }

  function renderMessageList() {
    const connection = state.connections[state.selectedConnectionId];

    if (!connection || connection.messages.length === 0) {
      elements$5.messageTbody.innerHTML = '';
      elements$5.messageEmpty.style.display = 'flex';
      elements$5.messageTbody.parentElement.style.display = 'none';
      return;
    }

    elements$5.messageEmpty.style.display = 'none';
    elements$5.messageTbody.parentElement.style.display = 'flex';

    let filteredMessages = connection.messages;
    if (callbacks$3.filterMessages) {
      filteredMessages = callbacks$3.filterMessages(connection.messages);
    }
    if (callbacks$3.searchMessages) {
      filteredMessages = callbacks$3.searchMessages(filteredMessages, state.searchQuery);
    }

    updateFilterStats(filteredMessages.length, connection.messages.length);

    elements$5.messageTbody.innerHTML = filteredMessages.map(msg => {
      const time = formatTime(msg.timestamp);
      const hasSearch = state.searchQuery.length > 0;

      return `
      <div class="message-row ${hasSearch ? 'search-highlight' : ''}" data-id="${msg.id}">
        <div class="message-cell col-id">${msg.id}</div>
        <div class="message-cell col-type">${hasSearch ? highlightSearchMatches(msg.eventType, state.searchQuery) : escapeHtml(msg.eventType)}</div>
        <div class="message-cell col-data">${hasSearch ? highlightSearchMatches(msg.data, state.searchQuery) : escapeHtml(msg.data)}</div>
        <div class="message-cell col-time">${time}</div>
      </div>
    `;
    }).join('');

    elements$5.messageTbody.querySelectorAll('.message-row').forEach(row => {
      row.addEventListener('click', () => {
        showMessageDetail(parseInt(row.dataset.id));
      });
    });
  }

  function showMessageDetail(messageId) {
    const connection = state.connections[state.selectedConnectionId];
    if (!connection) return;

    const message = connection.messages.find(m => m.id === messageId);
    if (!message) return;

    state.selectedMessageId = messageId;

    elements$5.detailTitle.textContent = `消息 #${messageId} - ${message.eventType}`;

    let formattedData;
    try {
      const parsed = JSON.parse(message.data);
      formattedData = syntaxHighlight(JSON.stringify(parsed, null, 2));
    } catch (e) {
      formattedData = escapeHtml(message.data);
    }

    elements$5.detailJson.innerHTML = formattedData;
    showDetailView();
  }

  function updateFilterStats(filteredCount, totalCount) {
    if (state.messageFilters.length === 0) {
      elements$5.filterStats.textContent = '';
      return;
    }

    if (filteredCount === totalCount) {
      elements$5.filterStats.textContent = `显示全部 ${totalCount} 条消息`;
    } else {
      elements$5.filterStats.textContent = `显示 ${filteredCount}/${totalCount} 条消息`;
    }
  }

  function highlightSearchMatches(text, query) {
    if (!query) return escapeHtml(text);

    const escapedQuery = escapeRegex(query);
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const escaped = escapeHtml(text);

    return escaped.replace(regex, '<span class="search-match">$1</span>');
  }

  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Filter management module


  let elements$4 = {};
  let callbacks$2 = {
    renderMessageList: null,
    updateFilterStats: null
  };

  function initFilterManager(el) {
    elements$4 = el;
  }

  function setCallbacks$2(cb) {
    callbacks$2 = { ...callbacks$2, ...cb };
  }

  function getAvailableFields() {
    const connection = state.connections[state.selectedConnectionId];
    if (!connection || !connection.messages) {
      return [];
    }

    const fieldsSet = new Set();

    connection.messages.forEach(msg => {
      try {
        const parsed = JSON.parse(msg.data);
        extractFields(parsed, '', fieldsSet);
      } catch (e) {
        // Not JSON, skip
      }
    });

    return Array.from(fieldsSet).sort();
  }

  function extractFields(obj, prefix = '', fields = new Set()) {
    if (obj === null || obj === undefined) {
      return fields;
    }

    if (Array.isArray(obj)) {
      if (obj.length > 0 && typeof obj[0] === 'object') {
        extractFields(obj[0], prefix, fields);
      }
      return fields;
    }

    if (typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const fieldPath = prefix ? `${prefix}.${key}` : key;
          fields.add(fieldPath);

          if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            extractFields(obj[key], fieldPath, fields);
          } else if (Array.isArray(obj[key]) && obj[key].length > 0 && typeof obj[key][0] === 'object') {
            extractFields(obj[key][0], fieldPath, fields);
          }
        }
      }
    }

    return fields;
  }

  function getNestedValue(obj, path) {
    const keys = path.split('.');
    let value = obj;

    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[key];
    }

    return value;
  }

  function filterMessages(messages) {
    if (state.messageFilters.length === 0) {
      return messages;
    }

    return messages.filter(msg => {
      try {
        const parsed = JSON.parse(msg.data);

        return state.messageFilters.every(filter => {
          const fieldValue = getNestedValue(parsed, filter.field);

          if (fieldValue === undefined) {
            return false;
          }

          const fieldValueStr = String(fieldValue);
          const filterValueStr = String(filter.value);

          if (filter.mode === 'equals') {
            return fieldValueStr === filterValueStr;
          } else if (filter.mode === 'contains') {
            return fieldValueStr.includes(filterValueStr);
          }

          return true;
        });
      } catch (e) {
        return false;
      }
    });
  }

  function addFilterCondition() {
    const availableFields = getAvailableFields();
    if (availableFields.length === 0) {
      alert('当前没有可用的字段，请先选择连接并等待消息数据。');
      return;
    }

    state.pendingFilters.push({
      field: availableFields[0] || '',
      mode: 'equals',
      value: ''
    });

    elements$4.messageFilterContainer.style.display = 'block';
    elements$4.btnToggleFilter.classList.add('expanded');
    renderFilterConditions();
  }

  function removeFilterCondition(index) {
    state.pendingFilters.splice(index, 1);
    state.messageFilters = JSON.parse(JSON.stringify(state.pendingFilters));
    renderFilterConditions();
    if (callbacks$2.renderMessageList) callbacks$2.renderMessageList();
  }

  function clearAllFilters() {
    state.pendingFilters = [];
    state.messageFilters = [];
    elements$4.messageFilterContainer.style.display = 'none';
    elements$4.btnToggleFilter.classList.remove('expanded');
    renderFilterConditions();
    if (callbacks$2.renderMessageList) callbacks$2.renderMessageList();
  }

  function applyFilters() {
    state.messageFilters = JSON.parse(JSON.stringify(state.pendingFilters));
    if (callbacks$2.renderMessageList) callbacks$2.renderMessageList();
  }

  function updatePendingFilterCondition(index, field, mode, value) {
    if (state.pendingFilters[index]) {
      state.pendingFilters[index].field = field;
      state.pendingFilters[index].mode = mode;
      state.pendingFilters[index].value = value;
    }
  }

  function renderFilterConditions() {
    const availableFields = getAvailableFields();

    elements$4.filterConditions.innerHTML = state.pendingFilters.map((filter, index) => {
      return `
      <div class="filter-row" data-index="${index}">
        <div class="filter-field-autocomplete" data-index="${index}">
          <input type="text" class="filter-field-input" data-index="${index}"
                 placeholder="输入或选择字段..."
                 value="${escapeHtml(filter.field)}"
                 autocomplete="off">
          <div class="filter-field-dropdown" data-index="${index}"></div>
        </div>
        <select class="filter-mode-select" data-index="${index}">
          <option value="equals" ${filter.mode === 'equals' ? 'selected' : ''}>全等</option>
          <option value="contains" ${filter.mode === 'contains' ? 'selected' : ''}>包含</option>
        </select>
        <input type="text" class="filter-value-input" data-index="${index}"
               placeholder="输入筛选值..." value="${escapeHtml(filter.value)}">
        <button class="filter-remove-btn" data-index="${index}" title="删除">×</button>
      </div>
    `;
    }).join('');

    setupFilterEventListeners(availableFields);
  }

  function setupFilterEventListeners(availableFields) {
    elements$4.filterConditions.querySelectorAll('.filter-field-input').forEach(input => {
      const index = parseInt(input.dataset.index);
      const dropdown = input.parentElement.querySelector('.filter-field-dropdown');

      const showDropdown = () => {
        const searchValue = input.value.toLowerCase();
        const filteredFields = availableFields.filter(field =>
          field.toLowerCase().includes(searchValue)
        );

        if (filteredFields.length > 0) {
          dropdown.innerHTML = filteredFields.map(field =>
            `<div class="dropdown-item" data-value="${escapeHtml(field)}">${escapeHtml(field)}</div>`
          ).join('');
          dropdown.style.display = 'block';

          dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
              input.value = item.dataset.value;
              dropdown.style.display = 'none';
              const filter = state.pendingFilters[index];
              updatePendingFilterCondition(index, item.dataset.value, filter.mode, filter.value);
            });
          });
        } else {
          dropdown.style.display = 'none';
        }
      };

      input.addEventListener('focus', showDropdown);
      input.addEventListener('input', (e) => {
        const filter = state.pendingFilters[index];
        updatePendingFilterCondition(index, e.target.value, filter.mode, filter.value);
        showDropdown();
      });

      input.addEventListener('blur', () => {
        setTimeout(() => {
          dropdown.style.display = 'none';
        }, 200);
      });
    });

    elements$4.filterConditions.querySelectorAll('.filter-mode-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const index = parseInt(e.target.dataset.index);
        const filter = state.pendingFilters[index];
        updatePendingFilterCondition(index, filter.field, e.target.value, filter.value);
      });
    });

    elements$4.filterConditions.querySelectorAll('.filter-value-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const index = parseInt(e.target.dataset.index);
        const filter = state.pendingFilters[index];
        updatePendingFilterCondition(index, filter.field, filter.mode, e.target.value);
      });

      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          applyFilters();
        }
      });
    });

    elements$4.filterConditions.querySelectorAll('.filter-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        removeFilterCondition(index);
      });
    });
  }

  function toggleFilterContainer() {
    const isHidden = elements$4.messageFilterContainer.style.display === 'none';
    elements$4.messageFilterContainer.style.display = isHidden ? 'block' : 'none';

    if (isHidden) {
      elements$4.btnToggleFilter.classList.add('expanded');
    } else {
      elements$4.btnToggleFilter.classList.remove('expanded');
    }
  }

  // Preset management module


  const PRESETS_STORAGE_KEY = 'stream-panel-filter-presets';

  let elements$3 = {};
  let callbacks$1 = {
    renderMessageList: null,
    renderFilterConditions: null
  };

  function initPresetManager(el) {
    elements$3 = el;
  }

  function setCallbacks$1(cb) {
    callbacks$1 = { ...callbacks$1, ...cb };
  }

  function loadPresets() {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  function savePresetsToStorage(presets) {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  }

  function showSavePresetModal() {
    if (state.pendingFilters.length === 0) {
      alert('请先添加筛选条件');
      return;
    }

    elements$3.presetModalTitle.textContent = '保存筛选预设';
    elements$3.presetModalBody.innerHTML = `
    <div class="preset-form">
      <div class="form-group">
        <label class="form-label">预设名称</label>
        <input type="text" id="preset-name-input" class="form-input" placeholder="输入预设名称..." autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">描述（可选）</label>
        <input type="text" id="preset-desc-input" class="form-input" placeholder="输入预设描述...">
      </div>
      <div class="form-group">
        <label class="form-label">筛选条件预览</label>
        <div style="font-size: 11px; color: var(--text-secondary); padding: 8px; background: var(--bg-secondary); border-radius: 4px;">
          ${state.pendingFilters.map(f => `${f.field} ${f.mode === 'equals' ? '=' : '包含'} "${f.value}"`).join(' AND ')}
        </div>
      </div>
    </div>
  `;

    elements$3.presetModalFooter.innerHTML = `
    <button class="modal-btn" id="preset-cancel-btn">取消</button>
    <button class="modal-btn primary" id="preset-save-btn">保存</button>
  `;

    elements$3.presetModal.style.display = 'flex';

    document.getElementById('preset-cancel-btn').addEventListener('click', closePresetModal);
    document.getElementById('preset-save-btn').addEventListener('click', () => {
      const name = document.getElementById('preset-name-input').value.trim();
      const description = document.getElementById('preset-desc-input').value.trim();

      if (!name) {
        alert('请输入预设名称');
        return;
      }

      const presets = loadPresets();
      presets.push({
        id: Date.now().toString(),
        name,
        description,
        filters: JSON.parse(JSON.stringify(state.pendingFilters)),
        createdAt: new Date().toISOString()
      });

      savePresetsToStorage(presets);
      closePresetModal();
      alert('预设保存成功');
    });

    document.getElementById('preset-name-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        document.getElementById('preset-save-btn').click();
      }
    });
  }

  function showLoadPresetModal() {
    const presets = loadPresets();

    if (presets.length === 0) {
      alert('暂无已保存的预设');
      return;
    }

    elements$3.presetModalTitle.textContent = '加载筛选预设';
    elements$3.presetModalBody.innerHTML = `
    <div class="preset-list">
      ${presets.map(preset => `
        <div class="preset-item" data-preset-id="${preset.id}">
          <div class="preset-info">
            <div class="preset-name">${escapeHtml(preset.name)}</div>
            <div class="preset-description">
              ${preset.description ? escapeHtml(preset.description) : ''}
              <br>
              <span style="font-size: 10px; color: var(--text-muted);">
                ${preset.filters.map(f => `${f.field} ${f.mode === 'equals' ? '=' : '包含'} "${f.value}"`).join(', ')}
              </span>
            </div>
          </div>
          <div class="preset-actions">
            <button class="preset-btn load-preset-btn" data-preset-id="${preset.id}">加载</button>
            <button class="preset-btn delete-preset-btn" data-preset-id="${preset.id}">删除</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

    elements$3.presetModalFooter.innerHTML = `
    <button class="modal-btn" id="preset-close-btn">关闭</button>
  `;

    elements$3.presetModal.style.display = 'flex';

    document.getElementById('preset-close-btn').addEventListener('click', closePresetModal);

    document.querySelectorAll('.load-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const presetId = btn.dataset.presetId;
        const preset = presets.find(p => p.id === presetId);
        if (preset) {
          state.pendingFilters = JSON.parse(JSON.stringify(preset.filters));
          state.messageFilters = JSON.parse(JSON.stringify(preset.filters));
          elements$3.messageFilterContainer.style.display = 'block';
          elements$3.btnToggleFilter.classList.add('expanded');
          if (callbacks$1.renderFilterConditions) callbacks$1.renderFilterConditions();
          if (callbacks$1.renderMessageList) callbacks$1.renderMessageList();
          closePresetModal();
        }
      });
    });

    document.querySelectorAll('.delete-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('确定要删除此预设吗？')) {
          const presetId = btn.dataset.presetId;
          const updatedPresets = presets.filter(p => p.id !== presetId);
          savePresetsToStorage(updatedPresets);
          showLoadPresetModal();
        }
      });
    });
  }

  function closePresetModal() {
    elements$3.presetModal.style.display = 'none';
  }

  // Statistics management module


  let elements$2 = {};

  function initStatisticsManager(el) {
    elements$2 = el;
  }

  function calculateStatistics() {
    const connections = Object.values(state.connections);
    const totalConnections = connections.length;
    const activeConnections = connections.filter(c => c.status === 'open').length;
    const totalMessages = connections.reduce((sum, c) => sum + c.messages.length, 0);
    const avgMessages = totalConnections > 0 ? Math.round(totalMessages / totalConnections) : 0;

    return {
      totalConnections,
      activeConnections,
      totalMessages,
      avgMessages,
      connections: connections.map(conn => ({
        id: conn.id,
        url: conn.url,
        status: conn.status,
        messageCount: conn.messages.length,
        createdAt: conn.createdAt,
        duration: Date.now() - conn.createdAt
      }))
    };
  }

  function showStatisticsModal() {
    const stats = calculateStatistics();

    document.getElementById('stat-total-connections').textContent = stats.totalConnections;
    document.getElementById('stat-active-connections').textContent = stats.activeConnections;
    document.getElementById('stat-total-messages').textContent = stats.totalMessages;
    document.getElementById('stat-avg-messages').textContent = stats.avgMessages;

    const statsConnectionList = document.getElementById('stats-connection-list');

    if (stats.connections.length === 0) {
      statsConnectionList.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">暂无连接数据</div>';
    } else {
      statsConnectionList.innerHTML = stats.connections.map(conn => `
      <div class="stats-connection-item">
        <div class="stats-connection-header">
          <div class="stats-connection-url" title="${escapeHtml(conn.url)}">${escapeHtml(getUrlPath(conn.url))}</div>
          <span class="stats-connection-status status-${conn.status}">${getStatusText(conn.status)}</span>
        </div>
        <div class="stats-connection-details">
          <div class="stats-detail-item">
            <span class="stats-detail-label">消息数</span>
            <span class="stats-detail-value">${conn.messageCount}</span>
          </div>
          <div class="stats-detail-item">
            <span class="stats-detail-label">持续时间</span>
            <span class="stats-detail-value">${formatDuration(conn.duration)}</span>
          </div>
          <div class="stats-detail-item">
            <span class="stats-detail-label">ID</span>
            <span class="stats-detail-value">${conn.id.substring(0, 8)}...</span>
          </div>
        </div>
      </div>
    `).join('');
    }

    elements$2.statsModal.style.display = 'flex';
  }

  function closeStatisticsModal() {
    elements$2.statsModal.style.display = 'none';
  }

  // Event handlers module


  let elements$1 = {};
  let port$1 = null;
  let callbacks = {
    renderConnectionList: null,
    renderMessageList: null,
    showMessageDetail: null,
    toggleFilterContainer: null,
    handleExport: null,
    showSavePresetModal: null,
    showLoadPresetModal: null,
    closePresetModal: null,
    showStatisticsModal: null,
    closeStatisticsModal: null
  };

  function initEventHandlers(el, connectionPort) {
    elements$1 = el;
    port$1 = connectionPort;
    setupToolbarHandlers();
    setupFilterHandlers();
    setupExportHandlers();
    setupPresetHandlers();
    setupStatsHandlers();
    setupDetailHandlers();
    setupResizerHandlers();
    setupSearchHandlers();
    setupModalClickHandlers();
  }

  function setCallbacks(cb) {
    callbacks = { ...callbacks, ...cb };
  }

  function setupToolbarHandlers() {
    elements$1.btnClear.addEventListener('click', () => {
      clearAllData();
      if (callbacks.renderConnectionList) callbacks.renderConnectionList();
      if (callbacks.renderMessageList) callbacks.renderMessageList();
      showListView();
      port$1.postMessage({ type: 'clear' });
    });

    elements$1.filterInput.addEventListener('input', (e) => {
      setFilter(e.target.value);
      if (callbacks.renderConnectionList) callbacks.renderConnectionList();
    });

    elements$1.requestTypeFilter.addEventListener('change', (e) => {
      setRequestTypeFilter(e.target.value);
      if (callbacks.renderConnectionList) callbacks.renderConnectionList();
    });

    elements$1.btnToggleFilter.addEventListener('click', () => {
      if (callbacks.toggleFilterContainer) callbacks.toggleFilterContainer();
    });
  }

  function setupFilterHandlers() {
    elements$1.btnAddFilter.addEventListener('click', () => {
      // This will be called from filterManager
      document.dispatchEvent(new CustomEvent('addFilter'));
    });

    elements$1.btnApplyFilters.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('applyFilters'));
    });

    elements$1.btnClearFilters.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('clearFilters'));
    });
  }

  function setupExportHandlers() {
    elements$1.btnExport.addEventListener('click', (e) => {
      e.stopPropagation();
      elements$1.exportDropdown.classList.toggle('open');
    });

    elements$1.exportMenu.querySelectorAll('.export-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const exportType = item.dataset.export;
        if (callbacks.handleExport) callbacks.handleExport(exportType);
        elements$1.exportDropdown.classList.remove('open');
      });
    });

    document.addEventListener('click', (e) => {
      if (!elements$1.exportDropdown.contains(e.target)) {
        elements$1.exportDropdown.classList.remove('open');
      }
    });
  }

  function setupPresetHandlers() {
    elements$1.btnSavePreset.addEventListener('click', () => {
      if (callbacks.showSavePresetModal) callbacks.showSavePresetModal();
    });
    elements$1.btnLoadPreset.addEventListener('click', () => {
      if (callbacks.showLoadPresetModal) callbacks.showLoadPresetModal();
    });
    elements$1.presetModalClose.addEventListener('click', () => {
      if (callbacks.closePresetModal) callbacks.closePresetModal();
    });
  }

  function setupStatsHandlers() {
    elements$1.btnStats.addEventListener('click', () => {
      if (callbacks.showStatisticsModal) callbacks.showStatisticsModal();
    });
    elements$1.statsModalClose.addEventListener('click', () => {
      if (callbacks.closeStatisticsModal) callbacks.closeStatisticsModal();
    });
  }

  function setupDetailHandlers() {
    elements$1.btnBack.addEventListener('click', () => {
      showListView();
    });

    elements$1.btnCopy.addEventListener('click', () => {
      const connection = state.connections[state.selectedConnectionId];
      if (!connection) return;

      const message = connection.messages.find(m => m.id === state.selectedMessageId);
      if (!message) return;

      copyToClipboard(message.data);
    });

    elements$1.btnReplay.addEventListener('click', () => {
      const connection = state.connections[state.selectedConnectionId];
      if (!connection) return;

      const message = connection.messages.find(m => m.id === state.selectedMessageId);
      if (!message) return;

      const replayData = {
        url: connection.url,
        eventType: message.eventType,
        data: message.data,
        lastEventId: message.lastEventId,
        timestamp: message.timestamp,
        instruction: '此消息已复制到剪贴板。要重放此消息，您需要手动模拟相应的SSE事件。'
      };

      const replayText = JSON.stringify(replayData, null, 2);
      copyToClipboard(replayText);

      alert('消息重放数据已复制到剪贴板！\n\n包含内容：\n- 连接URL\n- 事件类型\n- 消息数据\n- 时间戳');
    });
  }

  function setupResizerHandlers() {
    const resizer = document.querySelector('.resizer');
    const leftPanel = document.querySelector('.left-panel');

    let isResizing = false;

    resizer.addEventListener('mousedown', () => {
      isResizing = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      if (newWidth >= 150 && newWidth <= 400) {
        leftPanel.style.width = newWidth + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  }

  function setupSearchHandlers() {
    elements$1.messageSearchInput.addEventListener('input', (e) => {
      setSearchQuery(e.target.value);
      elements$1.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
      if (callbacks.renderMessageList) callbacks.renderMessageList();
    });

    elements$1.btnClearSearch.addEventListener('click', () => {
      setSearchQuery('');
      elements$1.messageSearchInput.value = '';
      elements$1.btnClearSearch.style.display = 'none';
      if (callbacks.renderMessageList) callbacks.renderMessageList();
    });
  }

  function setupModalClickHandlers() {
    elements$1.presetModal.addEventListener('click', (e) => {
      if (e.target === elements$1.presetModal) {
        if (callbacks.closePresetModal) callbacks.closePresetModal();
      }
    });

    elements$1.statsModal.addEventListener('click', (e) => {
      if (e.target === elements$1.statsModal) {
        if (callbacks.closeStatisticsModal) callbacks.closeStatisticsModal();
      }
    });
  }

  // Column resizer module

  function initColumnResizers() {
    const table = document.getElementById('message-table');
    if (!table) return;

    const resizers = table.querySelectorAll('.col-resizer');
    let currentResizer = null;
    let startX = 0;
    let startWidth = 0;
    let headerCell = null;
    let colClass = '';

    resizers.forEach(resizer => {
      resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();

        currentResizer = resizer;
        headerCell = resizer.parentElement;
        colClass = resizer.dataset.col;
        startX = e.pageX;
        startWidth = headerCell.offsetWidth;

        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    });

    function onMouseMove(e) {
      if (!currentResizer || !headerCell || !colClass) return;

      const diff = e.pageX - startX;
      const newWidth = Math.max(40, startWidth + diff);

      table.style.setProperty('--col-' + colClass + '-width', newWidth + 'px');

      if (colClass === 'data') {
        const dataCells = table.querySelectorAll('.col-data');
        dataCells.forEach(cell => {
          cell.style.flex = 'none';
        });
      }
    }

    function onMouseUp() {
      if (currentResizer) {
        currentResizer.classList.remove('resizing');
      }
      currentResizer = null;
      headerCell = null;
      colClass = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  // Search management module


  function searchMessages(messages, query) {
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

  // Export management module


  function getCurrentConnectionExportData() {
    const connection = state.connections[state.selectedConnectionId];
    if (!connection) {
      return null;
    }

    const messages = filterMessages(connection.messages);

    return {
      connection: {
        id: connection.id,
        url: connection.url,
        frameUrl: connection.frameUrl,
        isIframe: connection.isIframe,
        status: connection.status,
        createdAt: formatTimestampForExport(connection.createdAt)
      },
      messages: messages.map(msg => ({
        id: msg.id,
        eventType: msg.eventType,
        data: msg.data,
        lastEventId: msg.lastEventId,
        timestamp: formatTimestampForExport(msg.timestamp)
      })),
      exportedAt: new Date().toISOString(),
      totalMessages: messages.length,
      appliedFilters: state.messageFilters.length > 0 ? state.messageFilters : null
    };
  }

  function getAllConnectionsExportData() {
    const connections = Object.values(state.connections);
    if (connections.length === 0) {
      return null;
    }

    return {
      connections: connections.map(conn => ({
        id: conn.id,
        url: conn.url,
        frameUrl: conn.frameUrl,
        isIframe: conn.isIframe,
        status: conn.status,
        createdAt: formatTimestampForExport(conn.createdAt),
        messages: conn.messages.map(msg => ({
          id: msg.id,
          eventType: msg.eventType,
          data: msg.data,
          lastEventId: msg.lastEventId,
          timestamp: formatTimestampForExport(msg.timestamp)
        })),
        messageCount: conn.messages.length
      })),
      exportedAt: new Date().toISOString(),
      totalConnections: connections.length,
      totalMessages: connections.reduce((sum, conn) => sum + conn.messages.length, 0)
    };
  }

  function exportToJSON(data, filename) {
    const jsonStr = JSON.stringify(data, null, 2);
    downloadFile(jsonStr, filename, 'application/json');
  }

  function messagesToCSV(messages, connectionInfo = null) {
    const headers = ['ID', 'EventType', 'Data', 'LastEventId', 'Timestamp'];
    if (connectionInfo) {
      headers.unshift('ConnectionURL', 'ConnectionID');
    }

    const rows = messages.map(msg => {
      const escapeCSV = (value) => {
        if (value === null || value === undefined) {
          return '';
        }
        const str = String(value);
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      const row = [
        escapeCSV(msg.id),
        escapeCSV(msg.eventType),
        escapeCSV(msg.data),
        escapeCSV(msg.lastEventId),
        escapeCSV(msg.timestamp)
      ];

      if (connectionInfo) {
        row.unshift(escapeCSV(connectionInfo.url), escapeCSV(connectionInfo.id));
      }

      return row.join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  function exportCurrentToCSV() {
    const connection = state.connections[state.selectedConnectionId];
    if (!connection) {
      alert('请先选择一个连接');
      return;
    }

    const messages = filterMessages(connection.messages);
    if (messages.length === 0) {
      alert('当前连接没有消息可导出');
      return;
    }

    const formattedMessages = messages.map(msg => ({
      ...msg,
      timestamp: formatTimestampForExport(msg.timestamp)
    }));

    const csv = messagesToCSV(formattedMessages);
    const filename = `stream-messages-${connection.id.substring(0, 8)}-${Date.now()}.csv`;
    downloadFile(csv, filename, 'text/csv');
  }

  function exportAllToCSV() {
    const connections = Object.values(state.connections);
    if (connections.length === 0) {
      alert('没有连接数据可导出');
      return;
    }

    const allMessages = [];
    connections.forEach(conn => {
      conn.messages.forEach(msg => {
        allMessages.push({
          ...msg,
          timestamp: formatTimestampForExport(msg.timestamp),
          connectionUrl: conn.url,
          connectionId: conn.id
        });
      });
    });

    if (allMessages.length === 0) {
      alert('没有消息数据可导出');
      return;
    }

    const headers = ['ConnectionID', 'ConnectionURL', 'ID', 'EventType', 'Data', 'LastEventId', 'Timestamp'];
    const rows = allMessages.map(msg => {
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      };

      return [
        escapeCSV(msg.connectionId),
        escapeCSV(msg.connectionUrl),
        escapeCSV(msg.id),
        escapeCSV(msg.eventType),
        escapeCSV(msg.data),
        escapeCSV(msg.lastEventId),
        escapeCSV(msg.timestamp)
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const filename = `stream-all-messages-${Date.now()}.csv`;
    downloadFile(csv, filename, 'text/csv');
  }

  function handleExport(exportType) {
    switch (exportType) {
      case 'current-json': {
        const data = getCurrentConnectionExportData();
        if (!data) {
          alert('请先选择一个连接');
          return;
        }
        const filename = `stream-${data.connection.id.substring(0, 8)}-${Date.now()}.json`;
        exportToJSON(data, filename);
        break;
      }

      case 'current-csv': {
        exportCurrentToCSV();
        break;
      }

      case 'all-json': {
        const data = getAllConnectionsExportData();
        if (!data) {
          alert('没有连接数据可导出');
          return;
        }
        const filename = `stream-all-${Date.now()}.json`;
        exportToJSON(data, filename);
        break;
      }

      case 'all-csv': {
        exportAllToCSV();
        break;
      }
    }
  }

  // Main panel entry point

  // Enable debug mode
  window.__STREAM_PANEL_DEBUG__ = false;

  // DOM elements
  const elements = {
    connectionList: document.getElementById('connection-list'),
    messageTbody: document.getElementById('message-tbody'),
    messageEmpty: document.getElementById('message-empty'),
    messageListView: document.getElementById('message-list-view'),
    detailView: document.getElementById('detail-view'),
    detailTitle: document.getElementById('detail-title'),
    detailJson: document.getElementById('detail-json'),
    btnClear: document.getElementById('btn-clear'),
    btnBack: document.getElementById('btn-back'),
    btnCopy: document.getElementById('btn-copy'),
    btnReplay: document.getElementById('btn-replay'),
    btnStats: document.getElementById('btn-stats'),
    filterInput: document.getElementById('filter-input'),
    requestTypeFilter: document.getElementById('request-type-filter'),
    messageFilterContainer: document.getElementById('message-filter-container'),
    filterConditions: document.getElementById('filter-conditions'),
    filterStats: document.getElementById('filter-stats'),
    btnAddFilter: document.getElementById('btn-add-filter'),
    btnApplyFilters: document.getElementById('btn-apply-filters'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
    btnToggleFilter: document.getElementById('btn-toggle-filter'),
    btnSavePreset: document.getElementById('btn-save-preset'),
    btnLoadPreset: document.getElementById('btn-load-preset'),
    messageSearchInput: document.getElementById('message-search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    exportDropdown: document.querySelector('.export-dropdown'),
    btnExport: document.getElementById('btn-export'),
    exportMenu: document.getElementById('export-menu'),
    presetModal: document.getElementById('preset-modal'),
    presetModalTitle: document.getElementById('preset-modal-title'),
    presetModalBody: document.getElementById('preset-modal-body'),
    presetModalFooter: document.getElementById('preset-modal-footer'),
    presetModalClose: document.getElementById('preset-modal-close'),
    statsModal: document.getElementById('stats-modal'),
    statsModalBody: document.getElementById('stats-modal-body'),
    statsModalClose: document.getElementById('stats-modal-close')
  };

  // Connect to background script
  const port = chrome.runtime.connect({ name: 'stream-panel' });

  port.postMessage({
    type: 'init',
    tabId: chrome.devtools.inspectedWindow.tabId
  });

  // Handle messages from background
  port.onMessage.addListener(function(message) {
    log('Received message:', message.type, message);

    switch (message.type) {
      case 'init-data':
        state.connections = message.data.connections || {};
        log('Initialized with', Object.keys(state.connections).length, 'connections');
        renderConnectionList();
        break;

      case 'stream-event':
        handleStreamEvent(message.payload);
        break;

      case 'navigation':
        state.connections = {};
        state.selectedConnectionId = null;
        state.selectedMessageId = null;
        renderConnectionList();
        renderMessageList();
        showListView();
        break;
    }
  });

  // Initialize all modules
  function initModules() {
    initConnectionManager(elements);
    initMessageRenderer(elements);
    initViewManager(elements);
    initFilterManager(elements);
    initPresetManager(elements);
    initStatisticsManager(elements);
    initEventHandlers(elements, port);
    initColumnResizers();

    setupModuleCallbacks();
    setupFilterEvents();
  }

  // Setup callbacks between modules to avoid circular dependencies
  function setupModuleCallbacks() {
    // Connection manager callbacks
    setCallbacks$4({
      renderMessageList,
      showListView,
      renderFilterConditions
    });

    // Message renderer callbacks
    setCallbacks$3({
      filterMessages,
      searchMessages
    });

    // Event handlers callbacks
    setCallbacks({
      renderConnectionList,
      renderMessageList,
      showMessageDetail,
      toggleFilterContainer,
      handleExport,
      showSavePresetModal,
      showLoadPresetModal,
      closePresetModal,
      showStatisticsModal,
      closeStatisticsModal
    });

    // Filter manager callbacks
    setCallbacks$2({
      renderMessageList,
      updateFilterStats
    });

    // Preset manager callbacks
    setCallbacks$1({
      renderMessageList,
      renderFilterConditions
    });
  }

  // Setup custom event listeners for filter operations
  function setupFilterEvents() {
    document.addEventListener('addFilter', () => {
      addFilterCondition();
    });

    document.addEventListener('applyFilters', () => {
      applyFilters();
    });

    document.addEventListener('clearFilters', () => {
      clearAllFilters();
    });
  }

  // Re-export functions that need to be accessible globally for modules
  window.__StreamPanel__ = {
    renderConnectionList,
    renderMessageList,
    showMessageDetail,
    showListView,
    showDetailView,
    renderFilterConditions,
    closePresetModal,
    closeStatisticsModal
  };

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModules);
  } else {
    initModules();
  }

  log('Stream Panel initialized with modular architecture');

})();
