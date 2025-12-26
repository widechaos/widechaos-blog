// 个人站点配置
export const SITE_CONFIG = {
  // 基本信息
  title: "十方空烬的博客",
  description: "voidemper | 十方空烬 - 技术探索与生活思考",
  author: "十方空烬",
  email: "你的邮箱（可选）",
  
  // 社交链接
  social: {
    github: "https://github.com/widechaos",
    twitter: "",  // 如果有
    linkedin: "",  // 如果有
    bilibili: "",  // 如果有
    zhihu: "",     // 如果有
  },
  
  // 站点设置
  postsPerPage: 10,
  recentPostsCount: 5,
  
  // 个人信息
  bio: "开发者 | 量化交易爱好者 | 数字游民",
  avatar: "/avatar.png", // 会在public目录放头像
  
  // 功能开关
  features: {
    search: true,
    darkMode: true,
    comments: false, // 暂时关闭，后面再集成
    analytics: false,
  },
  
  // 导航菜单
  navItems: [
    { label: "首页", href: "/" },
    { label: "博客", href: "/blog" },
    { label: "归档", href: "/archive" },
    { label: "标签", href: "/tags" },
    { label: "关于", href: "/about" },
    { label: "项目", href: "/projects" },
  ],
};

// 标签配置
export const TAG_CONFIG = {
  colors: {
    '技术': '#3b82f6',
    '编程': '#8b5cf6',
    '生活': '#10b981',
    '思考': '#f59e0b',
    '读书': '#ef4444',
    '量化': '#6366f1',
    'AI': '#ec4899',
    '默认': '#6b7280',
  },
};

// 项目展示
export const PROJECTS = [
  {
    title: "个人量化系统",
    description: "基于FastAPI的量化交易系统",
    tech: ["Python", "FastAPI", "PostgreSQL"],
    github: "https://github.com/widechaos/quant-system",
    demo: "https://quant.widechaos.cn",
    status: "进行中",
  },
  {
    title: "数字花园",
    description: "个人知识管理系统与第二大脑",
    tech: ["TypeScript", "Astro", "RAG"],
    github: "https://github.com/widechaos/digital-garden",
    demo: "https://blog.widechaos.cn",
    status: "进行中",
  },
  {
    title: "任务管理中心",
    description: "个人任务与成就管理系统",
    tech: ["Vue.js", "FastAPI", "SQLite"],
    github: "https://github.com/widechaos/task-manager",
    demo: "https://task.widechaos.cn",
    status: "已完成",
  },
];