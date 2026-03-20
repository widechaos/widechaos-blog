import React, { useState } from "react";

const CategoryIcons = {
  教育背景: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-primary h-6 w-6 opacity-70"
    >
      <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2zm0 13L3 10.88V17l9 5 9-5v-6.12L12 15z"></path>
    </svg>
  ),
  技术领域: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-primary h-6 w-6 opacity-70"
    >
      <path d="M11 2v2H8v2h3v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2c0 1.1.9 2 2 2h4v2h2v-2h3v-2h-3v-2h4v-2h-4v-2c0-1.1-.9-2-2-2h-4V6h4V4h-3V2h-2z"></path>
    </svg>
  ),
  项目方向: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-primary h-6 w-6 opacity-70"
    >
      <path d="M13 7h8v2h-8V7zM3 5h8v4H3V5zm0 10h8v4H3v-4zm10 0h8v2h-8v-2zM13 11h8v2h-8v-2z"></path>
    </svg>
  ),
  工程实践: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-primary h-6 w-6 opacity-70"
    >
      <path d="M14.7 6.3l3 3L9 18H6v-3l8.7-8.7zm3.6-3.6l3 3c.4.4.4 1 0 1.4l-1.8 1.8-4.4-4.4 1.8-1.8c.4-.4 1-.4 1.4 0z"></path>
    </svg>
  ),
};

const SkillsList = () => {
  const [openItem, setOpenItem] = useState(null);

  const skills = {
    "教育背景": ["中南大学 能源与动力工程 本科（辅修工商管理）。"],
    "技术领域": [
      "AI 与大模型（RAGFlow、LangChain、Dify）、Python/Go/TypeScript、FastAPI/Flask、Kubernetes/CSI、Elasticsearch/Milvus、Redis/MySQL。",
    ],
    "项目方向": [
      "RAG 知识库、智能问答助手、Agent 工具编排、云原生存储插件、OpenStack Cinder 驱动。",
    ],
    "工程实践": [
      "重视可维护性与性能：异步并行、缓存层、召回/重排、容错与监控、容器化部署与自动化发布。",
    ],
  };

  const toggleItem = (item) => {
    setOpenItem(openItem === item ? null : item);
  };

  return (
    <div className="flex flex-col items-center px-4 text-left">
      <div className="mx-auto w-full max-w-4xl">
        <h2 className="text-white text-center text-4xl font-bold drop-shadow-[2px_2px_0_#7836cf]">
          常见问答
        </h2>
        <ul className="mt-8 space-y-4 text-lg drop-shadow-[2px_2px_0_#7836cf]">
          {Object.entries(skills).map(([category, items]) => (
            <li key={category} className="w-full">
              <div className="w-full overflow-hidden rounded-2xl bg-gray-900 transition-colors hover:bg-opacity-80">
                <button
                  type="button"
                  onClick={() => toggleItem(category)}
                  aria-expanded={openItem === category}
                  aria-controls={`faq-panel-${category}`}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  {CategoryIcons[category]}
                  <span className="block min-w-0 flex-1 truncate text-lg font-bold text-white drop-shadow-[1px_1px_0_#7836cf]">
                    {category}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`h-6 w-6 shrink-0 transform text-[#6a2cbb] transition-transform ${
                      openItem === category ? "rotate-180" : ""
                    }`}
                    aria-hidden="true"
                  >
                    <path d="M11.9999 13.1714L16.9497 8.22168L18.3639 9.63589L11.9999 15.9999L5.63599 9.63589L7.0502 8.22168L11.9999 13.1714Z"></path>
                  </svg>
                </button>

                {openItem === category && (
                  <div
                    id={`faq-panel-${category}`}
                    className="px-4 pb-4 text-sm text-white/90"
                  >
                    <ul className="space-y-2">
                      {items.map((text, idx) => (
                        <li key={`${category}-${idx}`} className="leading-relaxed">
                          {text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
export default SkillsList;
