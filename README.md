# 比亚迪售后智能维修管理系统 - 前端

Vue 3 + Vite + Element Plus + ECharts，对接 Spring Boot 后端。

## 技术栈

- Vue 3 + TypeScript
- Vite 8
- Element Plus（UI 组件库）
- Vue Router + Pinia
- ECharts（统计看板）
- Axios（HTTP 请求）

## 快速开始

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

演示账号：`admin` / `123456`

## 功能模块

| 路由 | 模块 |
|------|------|
| `/dashboard` | 统计看板 |
| `/vehicle` | 车辆档案 |
| `/appointment` | 车主预约 |
| `/fault` | 故障登记 |
| `/agent` | Agent 智能诊断 |
| `/work-order` | 维修工单 |
| `/parts` | 备件库存 |
| `/battery` | 电池健康预警 |
| `/settlement` | 维修结算 |

## 与 Spring Boot 联调

1. 后端启动在 `http://localhost:8080`
2. Vite 已配置代理：`/api` → `http://localhost:8080`
3. API 接口定义见 `src/api/index.ts`
4. 当前页面使用 `src/mock/data.ts` 演示数据，联调时替换为 API 调用即可

### 后端 CORS 配置示例

```java
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins("http://localhost:5173")
            .allowedMethods("*");
    }
}
```

## 构建部署

```bash
npm run build
```

产物在 `dist/` 目录，可：

- 部署到 Nginx
- 复制到 Spring Boot `src/main/resources/static/`

## 答辩演示路径

登录 → 统计看板 → 车辆档案 → 车主预约 → 故障登记 → Agent 诊断 → 维修工单 → 备件领用 → 电池预警 → 维修结算
