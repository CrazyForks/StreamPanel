// Filter management module

import { state } from './state.js';
import { escapeHtml } from './utils.js';

let elements = {};
let callbacks = {
  renderMessageList: null,
  updateFilterStats: null
};

export function initFilterManager(el) {
  elements = el;
}

export function setCallbacks(cb) {
  callbacks = { ...callbacks, ...cb };
}

export function getAvailableFields() {
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

export function extractFields(obj, prefix = '', fields = new Set()) {
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

export function getNestedValue(obj, path) {
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

export function filterMessages(messages) {
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

export function addFilterCondition() {
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

  elements.messageFilterContainer.style.display = 'block';
  elements.btnToggleFilter.classList.add('expanded');
  renderFilterConditions();
}

export function removeFilterCondition(index) {
  state.pendingFilters.splice(index, 1);
  state.messageFilters = JSON.parse(JSON.stringify(state.pendingFilters));
  renderFilterConditions();
  if (callbacks.renderMessageList) callbacks.renderMessageList();
}

export function clearAllFilters() {
  state.pendingFilters = [];
  state.messageFilters = [];
  elements.messageFilterContainer.style.display = 'none';
  elements.btnToggleFilter.classList.remove('expanded');
  renderFilterConditions();
  if (callbacks.renderMessageList) callbacks.renderMessageList();
}

export function applyFilters() {
  state.messageFilters = JSON.parse(JSON.stringify(state.pendingFilters));
  if (callbacks.renderMessageList) callbacks.renderMessageList();
}

export function updatePendingFilterCondition(index, field, mode, value) {
  if (state.pendingFilters[index]) {
    state.pendingFilters[index].field = field;
    state.pendingFilters[index].mode = mode;
    state.pendingFilters[index].value = value;
  }
}

export function renderFilterConditions() {
  const availableFields = getAvailableFields();

  elements.filterConditions.innerHTML = state.pendingFilters.map((filter, index) => {
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
  elements.filterConditions.querySelectorAll('.filter-field-input').forEach(input => {
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

  elements.filterConditions.querySelectorAll('.filter-mode-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      const filter = state.pendingFilters[index];
      updatePendingFilterCondition(index, filter.field, e.target.value, filter.value);
    });
  });

  elements.filterConditions.querySelectorAll('.filter-value-input').forEach(input => {
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

  elements.filterConditions.querySelectorAll('.filter-remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      removeFilterCondition(index);
    });
  });
}

export function toggleFilterContainer() {
  const isHidden = elements.messageFilterContainer.style.display === 'none';
  elements.messageFilterContainer.style.display = isHidden ? 'block' : 'none';

  if (isHidden) {
    elements.btnToggleFilter.classList.add('expanded');
  } else {
    elements.btnToggleFilter.classList.remove('expanded');
  }
}
