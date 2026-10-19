# BotB 美业门店智能体 Demo

面向美容院 / 皮肤管理中心的 AI 经营助手工作台演示项目。  
演示门店：**悦颜皮肤管理中心**

本项目仅使用前端模拟数据，不接入外部 API、后端或数据库。

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS v4
- lucide-react（图标）

## 启动方式

```bash
cd botb-beauty-demo
npm install
npm run dev
```

浏览器访问终端输出的本地地址（默认 `http://127.0.0.1:5173/`）。

## 当前阶段（Phase 1）

已完成整体工作台框架与基础页面：

- 左侧导航 + 顶部栏 + 主内容区布局
- 经营概览（完整模拟数据）
- AI 智能接待（静态聊天工作台）
- 预约管理（列表 + 筛选框架）
- 客户管理（列表 + 意向筛选）
- 营销助手（需求输入 + 场景入口 + 示例结果）

## 目录结构

```
src/
  components/layout/   # 侧边栏、顶栏、整体布局
  components/ui/       # 通用 UI 组件
  data/mockData.ts     # 模拟数据
  pages/               # 五个业务页面
  types/               # 类型定义
```
