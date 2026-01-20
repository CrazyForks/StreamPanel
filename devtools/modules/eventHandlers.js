// Event handlers module

import { state, setFilter, setRequestTypeFilter, setSearchQuery, clearAllData } from './state.js';
import { showListView, showDetailView } from './viewManager.js';
import { copyToClipboard, log } from './utils.js';

let elements = {};
let port = null;
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

export function initEventHandlers(el, connectionPort) {
  elements = el;
  port = connectionPort;
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

export function setCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

function setupToolbarHandlers() {
  elements.btnClear.addEventListener('click', () => {
    clearAllData();
    if (callbacks.renderConnectionList) callbacks.renderConnectionList();
    if (callbacks.renderMessageList) callbacks.renderMessageList();
    showListView();
    port.postMessage({ type: 'clear' });
  });

  elements.filterInput.addEventListener('input', (e) => {
    setFilter(e.target.value);
    if (callbacks.renderConnectionList) callbacks.renderConnectionList();
  });

  elements.requestTypeFilter.addEventListener('change', (e) => {
    setRequestTypeFilter(e.target.value);
    if (callbacks.renderConnectionList) callbacks.renderConnectionList();
  });

  elements.btnToggleFilter.addEventListener('click', () => {
    if (callbacks.toggleFilterContainer) callbacks.toggleFilterContainer();
  });
}

function setupFilterHandlers() {
  elements.btnAddFilter.addEventListener('click', () => {
    // This will be called from filterManager
    document.dispatchEvent(new CustomEvent('addFilter'));
  });

  elements.btnApplyFilters.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('applyFilters'));
  });

  elements.btnClearFilters.addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('clearFilters'));
  });
}

function setupExportHandlers() {
  elements.btnExport.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.exportDropdown.classList.toggle('open');
  });

  elements.exportMenu.querySelectorAll('.export-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const exportType = item.dataset.export;
      if (callbacks.handleExport) callbacks.handleExport(exportType);
      elements.exportDropdown.classList.remove('open');
    });
  });

  document.addEventListener('click', (e) => {
    if (!elements.exportDropdown.contains(e.target)) {
      elements.exportDropdown.classList.remove('open');
    }
  });
}

function setupPresetHandlers() {
  elements.btnSavePreset.addEventListener('click', () => {
    if (callbacks.showSavePresetModal) callbacks.showSavePresetModal();
  });
  elements.btnLoadPreset.addEventListener('click', () => {
    if (callbacks.showLoadPresetModal) callbacks.showLoadPresetModal();
  });
  elements.presetModalClose.addEventListener('click', () => {
    if (callbacks.closePresetModal) callbacks.closePresetModal();
  });
}

function setupStatsHandlers() {
  elements.btnStats.addEventListener('click', () => {
    if (callbacks.showStatisticsModal) callbacks.showStatisticsModal();
  });
  elements.statsModalClose.addEventListener('click', () => {
    if (callbacks.closeStatisticsModal) callbacks.closeStatisticsModal();
  });
}

function setupDetailHandlers() {
  elements.btnBack.addEventListener('click', () => {
    showListView();
  });

  elements.btnCopy.addEventListener('click', () => {
    const connection = state.connections[state.selectedConnectionId];
    if (!connection) return;

    const message = connection.messages.find(m => m.id === state.selectedMessageId);
    if (!message) return;

    copyToClipboard(message.data);
  });

  elements.btnReplay.addEventListener('click', () => {
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
  elements.messageSearchInput.addEventListener('input', (e) => {
    setSearchQuery(e.target.value);
    elements.btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
    if (callbacks.renderMessageList) callbacks.renderMessageList();
  });

  elements.btnClearSearch.addEventListener('click', () => {
    setSearchQuery('');
    elements.messageSearchInput.value = '';
    elements.btnClearSearch.style.display = 'none';
    if (callbacks.renderMessageList) callbacks.renderMessageList();
  });
}

function setupModalClickHandlers() {
  elements.presetModal.addEventListener('click', (e) => {
    if (e.target === elements.presetModal) {
      if (callbacks.closePresetModal) callbacks.closePresetModal();
    }
  });

  elements.statsModal.addEventListener('click', (e) => {
    if (e.target === elements.statsModal) {
      if (callbacks.closeStatisticsModal) callbacks.closeStatisticsModal();
    }
  });
}

function toggleFilterContainer() {
  const isHidden = elements.messageFilterContainer.style.display === 'none';
  elements.messageFilterContainer.style.display = isHidden ? 'block' : 'none';

  if (isHidden) {
    elements.btnToggleFilter.classList.add('expanded');
  } else {
    elements.btnToggleFilter.classList.remove('expanded');
  }
}

