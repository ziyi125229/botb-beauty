# BotB 美业门店智能体

面向美容院 / 皮肤管理中心的 AI 经营助手工作台。  
门店示例：**悦颜皮肤管理中心**

本项目使用前端本地模拟数据，不接入外部 API、后端或数据库。

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS v4
- lucide-react（图标）

## 启动方式

```bash
cd botb-beauty
npm install
npm run dev
```

浏览器访问终端输出的本地地址（默认 `http://127.0.0.1:5173/`）。

## 功能模块

- 经营概览（动态统计，与各模块数据联动）
- AI 智能接待（规则回复 + 预约闭环）
- 预约管理（创建 / 确认 / 改期 / 取消与档期释放）
- 客户管理（意向等级、跟进事项、预约历史）
- 营销助手（本地模板生成与方案保存）

## 目录结构

```
src/
  components/layout/   # 侧边栏、顶栏、整体布局
  components/ui/       # 通用 UI 组件
  data/mockData.ts     # 本地模拟数据
  lib/                 # 预约、意向、营销、统计等业务逻辑
  pages/               # 五个业务页面
  store/               # AppDataContext 本地持久化
  types/               # 类型定义
```

## 仓库

https://github.com/ziyi125229/botb-beauty
