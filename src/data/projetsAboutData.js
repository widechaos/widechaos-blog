import placeholder1 from "../assets/blog-placeholder-1.jpg";
import placeholder2 from "../assets/blog-placeholder-2.jpg";
import placeholder3 from "../assets/blog-placeholder-3.jpg";

export const proyectos = [
  {
    titulo: "企业智能知识库（RAG）",
    imagen: placeholder1.src,
    tecnologias: ["Python", "FastAPI", "Elasticsearch", "Milvus", "RAGFlow"],
    demo: "#",
    codigo: "https://github.com/widechaos",
  },
  {
    titulo: "智能问答助手（多轮对话）",
    descripcion: "Descripción breve del proyecto 1。",
    imagen: placeholder2.src,
    tecnologias: ["LangChain", "Qwen", "FastAPI"],
    demo: "#",
    codigo: "https://github.com/widechaos",
  },
  {
    titulo: "Kubernetes 存储插件（CSI）",
    imagen: placeholder3.src,
    tecnologias: ["Kubernetes", "CSI", "Golang"],
    demo: "#",
    codigo: "https://github.com/widechaos",
  },
];
