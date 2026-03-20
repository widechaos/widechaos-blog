# widechaos-blog

基于 Astro + React 的个人站点与博客，面向 GitHub Pages 部署。

## 主要特性

- 内容源：Astro Content Collections（博客文章、标签、RSS、Sitemap 一致）
- 安全策略：默认禁用 inline script/style 的 CSP（避免 XSS 风险）
- SEO：统一 Head（canonical / OG / Twitter / noindex），自动生成 sitemap.xml 与 feed.xml
- 体验：主题切换无闪烁（初始化脚本拆到 `public/js/head-init.js`）

## 本次改动记录（与验证方式）

- 去除归档入口：导航菜单移除 `/archive` 入口，并将 `/archive` 重定向到 `/blog`，同时从 sitemap 中移除归档路径
- 首页动态关键词：首页 Typewriter 关键词由内容（博客 tags + 项目 tech）自动聚合，内容更新后随构建自动更新
- About 重构：About 页面按「定位/技术矩阵/案例/开源/博客演讲/联系方式」重写，并增加 JSON-LD（`public/seo/about.jsonld`）
- Pages 稳定性：发布产物包含 `public/CNAME`，避免自定义域名部署后丢失导致 404

## 命令

在项目根目录执行：

| Command | Action |
| --- | --- |
| `npm ci` | 安装依赖 |
| `npm run dev` | 本地开发（默认 `http://localhost:4321`） |
| `npm run build` | 构建到 `./dist/` |
| `npm run preview` | 预览构建产物 |
| `npm run verify:dist` | 校验构建产物 SEO/meta 完整性 |

## CI / 部署

- 工作流：`.github/workflows/deploy.yml`
- 构建产物：`./dist`
- GitHub Pages：通过 GitHub Actions 部署


