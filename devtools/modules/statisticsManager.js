// Statistics management module

import { state } from './state.js';
import { escapeHtml, getUrlPath, formatDuration, getStatusText } from './utils.js';

let elements = {};

export function initStatisticsManager(el) {
  elements = el;
}

export function calculateStatistics() {
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

export function showStatisticsModal() {
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

  elements.statsModal.style.display = 'flex';
}

export function closeStatisticsModal() {
  elements.statsModal.style.display = 'none';
}
