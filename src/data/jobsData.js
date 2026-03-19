export const jobs = [
  {
    title: "企业智能知识库（RAG 应用）",
    time: ["2023.11 - 2025.6"],
    description:
      "基于 RAGFlow 构建企业内部知识检索与问答系统，支持多源数据与混合检索。",
    list: [
      "层级+重叠切片，ES 全文 + Milvus 向量混合召回",
      "bge-reranker 重排优化答案相关性",
      "FastAPI 流式接口与 IM 工具对接",
    ],
  },
  {
    title: "智能问答助手（客服场景）",
    time: ["2024.2 - 2025.3"],
    description:
      "面向客服场景的大模型问答助手，支持多轮对话、上下文记忆与溯源。",
    list: ["Qwen/ChatGLM 模型接入", "上下文管理与追问澄清", "溯源标注与接口集成"],
  },
  {
    title: "AI Agent 原型",
    time: ["2024.5 - 2025.5"],
    description:
      "基于 LangChain 的工具调用与流程编排，实现常见业务自动化处理。",
    list: ["Function Calling", "内部 API 工具集成", "权限申请/状态查询自动化"],
  },
  {
    title: "Kubernetes 存储插件（CSI）",
    time: ["长期维护"],
    description: "CSI 驱动设计与优化，支持动态卷、快照、克隆等能力。",
    list: ["CNCF 兼容性测试", "多租户隔离与性能优化", "部署与认证流程规范化"],
  },
  {
    title: "OpenStack Cinder 驱动",
    time: ["长期维护"],
    description: "负责 Cinder 驱动设计、优化与社区认证，打通产品在 OpenStack 平台的集成。",
    list: ["性能与兼容性优化", "社区认证自动化流程", "异常与回滚策略"],
  },
];
