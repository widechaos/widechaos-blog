# 邬仁超｜个人技术博客（Astro）

聚焦 RAG、Agent 工程化与云原生落地实践。

## 项目结构

```text
/
├── public/                 # 静态资源（favicon、字体等）
├── src/
│  ├── components/          # 站点组件
│  ├── config/              # 站点配置（站点标题/作者/导航/标签色板）
│  ├── content/blog/        # 博客文章（Markdown/MDX）
│  ├── layouts/             # 页面布局
│  ├── pages/               # 路由页面（首页/博客/归档/标签等）
│  ├── styles/              # 全局样式
│  └── data/                # 数据（经历等）
└── astro.config.mjs
```

## 常用命令

| 命令 | 说明 |
| ---- | ---- |
| `npm install` | 安装依赖 |
| `npm run dev` | 本地开发（默认 `http://localhost:4321`） |
| `npm run build` | 生产构建到 `./dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run astro -- check` | Astro 校验 |


