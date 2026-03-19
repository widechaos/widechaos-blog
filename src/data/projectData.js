import p1 from "../assets/blog-placeholder-1.jpg";
import p2 from "../assets/blog-placeholder-2.jpg";
import p3 from "../assets/blog-placeholder-3.jpg";
import p4 from "../assets/blog-placeholder-4.jpg";
import p5 from "../assets/blog-placeholder-5.jpg";

export const proyectos = [
  {
    titulo: "企业智能知识库（RAGFlow）",
    descripcion: "多源文档接入、混合检索、重排排序与 FastAPI 问答接口。",
    imagen: p1.src,
    tecnologias: ["Python", "FastAPI", "Elasticsearch", "Milvus", "RAGFlow"],
    demo: "#",
    codigo: "https://github.com/widechaos",
    categoria: "ai",
  },
  {
    titulo: "智能问答助手（多轮对话）",
    descripcion: "上下文记忆、溯源标注、Qwen/ChatGLM 模型接入。",
    imagen: p2.src,
    tecnologias: ["LangChain", "Qwen", "FastAPI"],
    demo: "#",
    codigo: "https://github.com/widechaos",
    categoria: "ai",
  },
  {
    titulo: "AI Agent 原型",
    descripcion: "Function Calling 与工具链编排，实现常见请求自动化处理。",
    imagen: p3.src,
    tecnologias: ["LangChain", "Python"],
    demo: "#",
    codigo: "https://github.com/widechaos",
    categoria: "ai",
  },
  {
    titulo: "Kubernetes 存储插件（CSI）",
    descripcion: "动态卷、快照/克隆、兼容性测试与性能优化。",
    imagen: p4.src,
    tecnologias: ["Kubernetes", "CSI", "Golang"],
    demo: "#",
    codigo: "https://github.com/widechaos",
    categoria: "cloud",
  },
  {
    titulo: "OpenStack Cinder 驱动",
    descripcion: "存储驱动集成、兼容性与性能优化、社区认证与自动化。",
    imagen: p5.src,
    tecnologias: ["OpenStack", "Cinder", "Python"],
    demo: "#",
    codigo: "https://github.com/widechaos",
    categoria: "storage",
  },
];
