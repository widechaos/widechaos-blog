# fix-build.ps1 - 修复构建问题
Write-Host "🔧 开始修复构建问题..." -ForegroundColor Yellow

# 1. 解决路由冲突
Write-Host "1. 解决路由冲突..." -ForegroundColor Cyan
if (Test-Path "src/pages/blog/index.astro") {
    $choice = Read-Host "发现冲突路由，删除哪个？(输入 1 删除 index.astro，2 删除 blog.astro)"
    if ($choice -eq "1") {
        Remove-Item "src/pages/blog/index.astro" -Force
        Write-Host "✅ 已删除 src/pages/blog/index.astro" -ForegroundColor Green
    } elseif ($choice -eq "2") {
        Remove-Item "src/pages/blog.astro" -Force
        Write-Host "✅ 已删除 src/pages/blog.astro" -ForegroundColor Green
    }
}

# 2. 修复 Tailwind CSS 配置
Write-Host "2. 修复 Tailwind 配置..." -ForegroundColor Cyan

# 创建正确的 global.css
$globalCss = @"
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 自定义样式 */
body {
  @apply antialiased;
}

.prose {
  @apply max-w-none;
}

.prose h1 {
  @apply text-4xl font-bold mt-8 mb-4;
}

.prose h2 {
  @apply text-3xl font-bold mt-6 mb-3;
}

.prose p {
  @apply my-4 leading-relaxed;
}

.prose code {
  @apply bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm;
}

/* 深色模式 */
.dark {
  color-scheme: dark;
}
"@

# 确保 styles 目录存在
if (-not (Test-Path "src/styles")) {
    New-Item -ItemType Directory -Path "src/styles" -Force
}

Set-Content -Path "src/styles/global.css" -Value $globalCss -Encoding UTF8

# 3. 创建 tailwind.config.js
$tailwindConfig = @"
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        }
      }
    },
  },
  plugins: [],
}
"@

Set-Content -Path "tailwind.config.js" -Value $tailwindConfig -Encoding UTF8

# 4. 更新 astro.config.mjs
$astroConfig = @"
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.widechaos.cn',
  integrations: [tailwind()],
});
"@

Set-Content -Path "astro.config.mjs" -Value $astroConfig -Encoding UTF8

# 5. 安装必要依赖
Write-Host "3. 安装依赖..." -ForegroundColor Cyan
npm install -D @astrojs/tailwind tailwindcss

# 6. 测试构建
Write-Host "4. 测试构建..." -ForegroundColor Cyan
try {
    npm run build
    Write-Host "✅ 构建成功！" -ForegroundColor Green
} catch {
    Write-Host "❌ 构建失败，查看上面的错误信息" -ForegroundColor Red
}

Write-Host "🎉 修复完成！" -ForegroundColor Green
Write-Host "运行以下命令：" -ForegroundColor Yellow
Write-Host "  npm run dev    # 本地预览" -ForegroundColor Cyan
Write-Host "  npm run build  # 构建测试" -ForegroundColor Cyan