# 比亚迪售后智能维修管理系统 - 前端

Vue 3 + Vite + Element Plus + ECharts，对接 Spring Boot 后端。

## 技术栈

- Vue 3 + TypeScript
- Vite 8
- Element Plus
- Vue Router + Pinia
- ECharts
- Axios

## 快速开始

```bash
npm install
npm run dev
```

访问 http://localhost:5173

内部账号示例：`advisor001` / `admin001`，密码 `12345678`

## 功能模块

| 路由 | 模块 |
|------|------|
| `/dashboard` | 统计看板 |
| `/vehicle` | 车辆档案 |
| `/appointment` | 车主预约 |
| `/fault` | 故障登记 |
| `/agent` | 智能诊断 |
| `/work-order` | 维修工单 |
| `/parts` | 备件库存 |
| `/battery` | 车辆健康 |
| `/settlement` | 维修结算 |

## 与后端联调

1. 后端启动在 `http://localhost:8080`
2. Vite 代理：`/api` → `http://localhost:8080`
3. 接口定义见 `src/api/index.ts`

## 构建部署

```bash
npm run build
```

产物在 `dist/`，可部署到 Nginx 或 Spring Boot 静态资源目录。
