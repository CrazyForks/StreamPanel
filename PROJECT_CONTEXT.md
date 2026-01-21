# Stream Panel - 项目文档

## 📋 项目概述

**Stream Panel** 是一个 Chrome DevTools 扩展，用于实时监控和调试流式请求（SSE 和 Fetch Stream）。

### 核心功能
- 拦截并显示 EventSource 和 Fetch 流式连接
- 实时查看 JSON 格式的消息数据
- 按字段值筛选消息（支持嵌套字段）
- 全文搜索消息内容
- 数据导出（JSON/CSV 格式）
- 保存和管理筛选预设
- 消息重放功能
- 连接统计分析
- 支持深色模式和列宽调整

---

## 🏗️ 技术架构

### 架构图
```
网页 (Web Page)
  └── inject.js (拦截 EventSource/fetch API)
      └── content.js (消息桥梁)
          └── background.js (数据存储与通信)
              └── devtools/panel (DevTools UI 面板)
```

### 技术栈
- **语言**: JavaScript (ES6+)
- **模块系统**: ES Modules
- **打包工具**: Rollup
- **包管理器**: pnpm
- **扩展类型**: Chrome Extension Manifest V3
- **运行环境**: Chrome DevTools Panel

---

## 📁 项目结构详解

```
StreamPanel/
├── manifest.json                  # Chrome 扩展清单文件 (Manifest V3)
├── background.js                  # 后台 Service Worker，管理数据存储和通信
├── content.js                     # 内容脚本，连接 inject.js 和 background.js
├── inject.js                      # 注入脚本，拦截网页中的 API 调用
├── devtools/                      # DevTools 相关文件
│   ├── devtools.html             # DevTools 入口页面
│   ├── devtools.js               # DevTools 初始化脚本
│   ├── panel.html                # DevTools 面板 UI
│   ├── panel.bundle.js           # 打包后的面板逻辑 (生产用)
│   ├── panel.js                  # 面板入口文件 (ES Modules)
│   ├── panel.css                 # 面板样式
│   └── modules/                  # 模块化源码
│       ├── state.js              # 全局状态管理
│       ├── utils.js              # 工具函数
│       ├── viewManager.js        # 视图管理
│       ├── connectionManager.js  # 连接管理
│       ├── connectionStorageManager.js  # 连接数据持久化
│       ├── savedConnectionsManager.js   # 已保存连接管理
│       ├── messageRenderer.js    # 消息渲染
│       ├── filterManager.js      # 消息筛选
│       ├── searchManager.js      # 搜索功能
│       ├── exportManager.js      # 数据导出
│       ├── presetManager.js      # 筛选预设管理
│       ├── statisticsManager.js  # 统计分析
│       ├── eventHandlers.js      # 事件处理
│       └── columnResizer.js      # 列宽调整
├── rollup.config.js              # Rollup 打包配置
├── package.json                  # 项目依赖和脚本
├── pnpm-lock.yaml                # pnpm 锁定文件
├── icons/                        # 扩展图标资源
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── docs/                         # 文档目录
```

---

## 🔧 关键组件说明

### 1. manifest.json
- **版本**: Manifest V3
- **权限**: scripting, <all_urls>
- **背景脚本**: background.js (Service Worker)
- **内容脚本**: content.js (所有页面)
- **DevTools 页面**: devtools/devtools.html
- **Web 可访问资源**: inject.js

### 2. 核心脚本

#### background.js
- **职责**:
  - 管理来自 DevTools 面板的连接
  - 存储每个标签页的流数据
  - 作为 content script 和 DevTools panel 之间的消息中转站
- **数据结构**: `Map<tabId, { connections: {} }>`

#### content.js
- **职责**:
  - 接收来自 inject.js 的消息
  - 转发到 background.js
  - 确保 iframe 支持 (all_frames: true)

#### inject.js
- **职责**:
  - 劫持 `EventSource` 构造函数
  - 劫持 `fetch` API (检测流式响应)
  - 拦截消息事件
  - 发送数据到 content.js

### 3. DevTools 面板模块 (devtools/modules/)

#### state.js - 状态管理
```javascript
state = {
  connections: {},              // 所有连接数据
  selectedConnectionId: null,   // 当前选中的连接 ID
  selectedMessageId: null,      // 当前选中的消息 ID
  pinnedMessageIds: {},         // 固定的消息 ID 集合
  filter: '',                  // URL 过滤器
  requestTypeFilter: 'all',    // 请求类型过滤器 (all/eventsource/fetch)
  messageFilters: [],          // 消息筛选条件数组
  pendingFilters: [],          // 待应用的筛选条件
  searchQuery: '',             // 搜索关键词
  autoScrollToBottom: true     // 自动滚动到底部
}
```

#### connectionManager.js - 连接管理
- **主要功能**:
  - 创建新连接
  - 更新连接状态 (active/disconnected/error)
  - 管理连接列表
  - 处理连接选中逻辑

#### messageRenderer.js - 消息渲染
- **主要功能**:
  - 渲染消息列表
  - JSON 语法高亮
  - 显示消息详情
  - 处理消息固定功能

#### filterManager.js - 消息筛选
- **筛选功能**:
  - 按 JSON 字段值筛选
  - 支持嵌套字段 (点号表示法，如 `user.name`)
  - 匹配模式: 全等 (equals) / 包含 (contains)
  - 多条件 AND 逻辑
  - 自动完成字段建议

#### searchManager.js - 搜索功能
- **搜索功能**:
  - 全文搜索消息内容
  - 关键词高亮
  - 实时搜索结果

#### exportManager.js - 数据导出
- **导出格式**:
  - JSON (包含完整元数据)
  - CSV (带 UTF-8 BOM，Excel 兼容)
- **导出范围**:
  - 当前连接
  - 所有连接
- **支持**: 导出筛选后的数据

#### presetManager.js - 筛选预设
- **功能**:
  - 保存当前筛选条件
  - 加载已保存的预设
  - 删除/重命名预设

#### statisticsManager.js - 统计分析
- **统计指标**:
  - 总连接数
  - 总消息数
  - 活跃连接数
  - 每个连接的持续时间

#### savedConnectionsManager.js - 已保存连接
- **功能**:
  - 保存连接配置
  - 加载已保存连接
  - 导入/导出连接配置

#### columnResizer.js - 列宽调整
- **功能**:
  - 可拖动调整列宽
- 支持持久化列宽配置

#### eventHandlers.js - 事件处理
- **职责**:
  - 处理用户交互事件
  - 协调各模块之间的通信
  - 处理 Chrome API 消息

---

## 🔄 数据流

### 1. 捕获流式请求流程
```
网页发起 EventSource/fetch 请求
    ↓
inject.js 拦截 API 调用
    ↓
inject.js 监听消息事件
    ↓
inject.js 通过 postMessage 发送到 content.js
    ↓
content.js 通过 chrome.runtime.sendMessage 发送到 background.js
    ↓
background.js 存储数据并通过端口发送到 DevTools 面板
    ↓
devtools/panel 显示数据
```

### 2. 用户操作流程
```
用户在 DevTools 面板中操作 (点击、筛选等)
    ↓
eventHandlers.js 捕获事件
    ↓
调用相应管理器 (connectionManager/filterManager 等)
    ↓
更新 state.js 中的状态
    ↓
触发 UI 重新渲染
```

---

## 📦 模块依赖关系

```
panel.js (入口)
    ↓
    ├── state.js (所有模块依赖)
    ├── utils.js (通用工具)
    └── eventHandlers.js (事件协调)
            ├── connectionManager.js
            │   └── connectionStorageManager.js
            ├── messageRenderer.js
            ├── filterManager.js
            ├── searchManager.js
            ├── exportManager.js
            ├── presetManager.js
            ├── savedConnectionsManager.js
            ├── statisticsManager.js
            ├── columnResizer.js
            └── viewManager.js
```

---

## 🎯 开发规范

### 代码风格
- 使用 ES6+ 语法
- 模块化设计，每个文件单一职责
- 使用纯函数和不可变数据
- 避免 DOM 操作直接耦合业务逻辑

### 文件命名
- 小驼峰命名法: `connectionManager.js`
- 模块文件放在 `devtools/modules/` 目录
- 每个模块导出相关的函数和状态

### 消息传递
- **inject.js → content.js**: `window.postMessage()`
- **content.js → background.js**: `chrome.runtime.sendMessage()`
- **background.js ↔ devtools/panel**: `chrome.runtime.connect()` 端口通信

### 状态管理
- 所有状态集中在 `state.js`
- 通过导出的 setter 函数修改状态
- UI 组件监听状态变化自动更新

---

## 🛠️ 构建与开发

### 构建命令
```bash
# 开发构建 (带 sourcemap)
pnpm run build

# 生产构建 (压缩)
pnpm run build:prod

# 监听模式 (自动重新构建)
pnpm run watch
```

### 开发流程
1. 编辑 `devtools/modules/` 中的源码
2. 运行 `pnpm run build` 或 `pnpm run watch`
3. 在 `chrome://extensions/` 中重新加载扩展
4. 打开 DevTools 测试功能

### Rollup 配置要点
- **输入**: `devtools/panel.js`
- **输出**: `devtools/panel.bundle.js`
- **格式**: IIFE (立即执行函数表达式)
- **外部依赖**: `chrome` (不打包)
- **插件**: node-resolve, commonjs, terser (生产环境)

---

## 🔒 Chrome Extension API 使用

### Manifest V3 特性
- Service Worker 替代 background page
- 使用声明式权限
- 内容脚本支持 `all_frames: true`

### 关键 API
- `chrome.runtime.onConnect`: DevTools panel 连接
- `chrome.runtime.onMessage`: content script 通信
- `chrome.devtools.panels`: 创建自定义面板
- `chrome.storage`: 数据持久化 (可选)

---

## 📊 数据结构

### 连接对象
```javascript
{
  id: string,              // 唯一标识符
  url: string,             // 请求 URL
  type: 'eventsource' | 'fetch',
  status: 'active' | 'disconnected' | 'error',
  startTime: timestamp,   // 连接开始时间
  endTime: timestamp,      // 连接结束时间
  messageCount: number,    // 消息总数
  filteredCount: number,   // 筛选后的消息数
  messages: [              // 消息数组
    {
      id: string,
      data: any,          // JSON 数据
      timestamp: timestamp,
      type: string
    }
  ]
}
```

### 筛选条件
```javascript
{
  field: string,           // JSON 字段路径 (如 'user.name')
  operator: 'equals' | 'contains',
  value: any              // 筛选值
}
```

### 预设对象
```javascript
{
  id: string,
  name: string,
  filters: [],            // 筛选条件数组
  createdAt: timestamp
}
```

---

## 🚀 功能特性映射

| 功能 | 实现模块 |
|------|---------|
| 实时监控流连接 | inject.js + background.js |
| 显示连接列表 | connectionManager.js |
| 显示消息详情 | messageRenderer.js |
| URL 过滤 | connectionManager.js |
| 消息字段筛选 | filterManager.js |
| 全文搜索 | searchManager.js |
| 数据导出 | exportManager.js |
| 筛选预设 | presetManager.js |
| 连接统计 | statisticsManager.js |
| 列宽调整 | columnResizer.js |
| 固定消息 | messageRenderer.js + state.js |

---

## 🐛 调试技巧

### 启用调试日志
在 `background.js` 中设置:
```javascript
const DEBUG = true;
```

### 查看 DevTools 日志
- background.js: `chrome://extensions/` → Service Worker 链接
- content.js/inject.js: 网页控制台
- devtools/panel: DevTools 自身的 Console 面板

### 检查构建输出
- `panel.bundle.js` 应正确生成
- 检查 sourcemap 是否工作

---

## 📝 开发注意事项

### 1. Chrome 限制
- Service Worker 有 5 分钟空闲限制
- 某些 API 在 Service Worker 中不可用 (DOM 操作等)

### 2. 性能考虑
- 大量消息时需要虚拟滚动
- 避免频繁的 DOM 操作
- 使用事件委托处理列表点击

### 3. 兼容性
- 支持 Chrome 88+
- Manifest V3 要求

### 4. 安全
- 不执行用户提供的脚本
- 对数据进行适当的转义
- 使用 HTTPS 连接 (开发模式除外)

---

## 🎨 UI 特性

### 响应式设计
- 使用 flexbox 布局
- 自动适应 DevTools 面板大小
- 支持深色模式 (系统偏好)

### 交互优化
- 可拖动列宽
- 可固定重要消息
- 自动滚动到底部 (可关闭)
- 实时搜索高亮

---

## 🔮 未来计划

- [ ] WebSocket 监控支持
- [ ] GraphQL 订阅支持
- [ ] 数据可视化图表
- [ ] 自定义主题
- [ ] 云同步配置
- [ ] 团队协作功能

---

## 📚 相关资源

- **Chrome Extension 文档**: https://developer.chrome.com/docs/extensions/
- **DevTools 协议**: https://chromedevtools.github.io/devtools-protocol/
- **Rollup 文档**: https://rollupjs.org/

---

## 💡 AI 开发提示

当进行代码修改或新功能开发时，AI 应注意：

1. **保持模块化**: 新功能应拆分为独立模块或扩展现有模块
2. **遵循现有模式**: 参考类似功能的实现方式
3. **更新状态**: 状态修改必须通过 `state.js` 的 setter 函数
4. **处理消息流**: 新数据需要经过 background.js 中转
5. **UI 渲染**: 使用 messageRenderer.js 的渲染方法
6. **事件处理**: 在 eventHandlers.js 中添加事件监听
7. **类型安全**: 虽然 JS 无类型，但应保持数据结构一致
8. **测试验证**: 构建后在实际环境中测试

### 常见任务

**添加新的筛选器类型**:
1. 在 `filterManager.js` 中添加筛选逻辑
2. 在 `state.js` 中添加相关状态
3. 更新 `eventHandlers.js` 处理用户输入
4. 更新 UI 渲染

**添加新的导出格式**:
1. 在 `exportManager.js` 中添加导出函数
2. 更新 `eventHandlers.js` 添加导出按钮处理
3. 更新 UI 显示新导出选项

**修改消息显示**:
1. 在 `messageRenderer.js` 中修改渲染逻辑
2. 更新 `eventHandlers.js` 中的交互处理
3. 确保状态正确更新

**添加统计数据**:
1. 在 `statisticsManager.js` 中添加计算逻辑
2. 更新 UI 显示
3. 在数据更新时触发统计计算

---

*最后更新: 2026-01-21*
