// 个人站点配置
export const SITE_CONFIG = {
  // 基本信息
  title: "邬仁超｜AI应用与大模型工程",
  description: "高级AI应用开发工程师 / 大模型应用开发专家｜聚焦RAG、Agent工程化与云原生落地",
  author: "邬仁超",
  location: "广东深圳",
  phone: "15200850083",
  email: "xe333@sina.com",
  
  // 社交链接
  social: {
    github: "",
    twitter: "",
    linkedin: "",
    bilibili: "",
    zhihu: "",
  },
  
  // 站点设置
  postsPerPage: 10,
  recentPostsCount: 5,
  
  // 个人信息
  bio: "高级AI应用开发工程师 / 技术负责人｜RAG、Agent、多智能体协作与云原生工程化",
  avatarText: "邬仁超",
  
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
    { label: "项目", href: "/proyectos" },
    { label: "联系", href: "/contact" },
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
    'AI': '#ec4899',
    'RAG': '#6366f1',
    'Agent': '#0ea5e9',
    '云原生': '#22c55e',
    '存储': '#a855f7',
    '默认': '#6b7280',
  },
};

// 项目展示
export const PROJECTS = [
  {
    title: "企业智能知识库系统（RAG应用）",
    description: "面向企业内部文档与案例的检索增强问答平台，强调召回质量、答案可追溯与反馈闭环",
    tech: ["RAGFlow", "Elasticsearch", "向量检索", "重排", "FastAPI"],
    status: "已落地",
  },
  {
    title: "智能问答助手（面向客服团队）",
    description: "支持多轮对话、上下文理解与知识溯源的客服辅助能力，降低人工介入率并提升响应效率",
    tech: ["多轮对话", "上下文管理", "溯源", "服务化接口"],
    status: "已落地",
  },
  {
    title: "云原生存储集成（CSI / Cinder）",
    description: "存储系统对接主流云平台与容器平台，覆盖动态卷供给、快照、克隆等能力并完善测试与认证流程",
    tech: ["Kubernetes", "CSI", "OpenStack", "Cinder", "Docker"],
    status: "已落地",
  },
];
