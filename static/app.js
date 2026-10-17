import { demoMarkup, mountDemos } from "./project-demos.js";
import {
  findArticleTranslation,
  selectArticlesForLanguage,
  articleForProject,
  isRouterArticle,
  projectMonogram,
  filterPublishedContent,
  sortProjects,
  selectFeaturedProjects,
  availableTools,
  articlePublishedAt,
  topicLabel,
} from "./content-model.js";
// Server pages carry the content inline; the JSON request is only a fallback.
const inlineData = document.getElementById("site-data")?.textContent;
const data = filterPublishedContent(inlineData ? JSON.parse(inlineData) : await fetch("/static/content.json").then((r) => {
  if (!r.ok) throw new Error("Content unavailable");
  return r.json();
}));
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const arrow = '<span aria-hidden="true">↗</span>';
let lang = localStorage.getItem("wc-site-lang") === "en" ? "en" : "zh";
let cleanup = () => {},
  hero = null,
  searchTerm = "",
  projectFilter = "all",
  journalCategory = "all",
  journalSeries = "",
  journalPage = 1,
  collectionFilter = "reading",
  light = "neon",
  searchNavigating = false;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let motion =
  localStorage.getItem("wc-site-motion") || (reduced.matches ? "off" : "on");
document.documentElement.dataset.motion = motion;
const t = (zh, en) => (lang === "zh" ? zh : en);
const tags = () =>
  t(
    ["科学家", "文豪", "艺术家", "战术大师", "侠", "光"],
    [
      "Scientist",
      "Wordsmith",
      "Artist",
      "Master Tactician",
      "Knight-errant",
      "Light",
    ],
  );
const TAG_KEYS = ["scientist", "wordsmith", "artist", "tactician", "knight", "light"];
// Each signature word reacts in its own way on hover; see .tag-fx in content-layout.css.
const tagFx = (x, i) => `<em class="tag-fx" data-tag="${TAG_KEYS[i]}">${x}</em>`;
const articleSet = () => selectArticlesForLanguage(data.articles, lang);
const projectTitle = (id) => data.projects.find((p) => p.id === id)?.title;
const desc = (p) => p[lang];
const link = (url, label, cls = "") =>
  `<a class="${cls}" href="${esc(url)}"${/^https?:/.test(url) ? ' target="_blank" rel="noopener"' : ""}>${label}</a>`;
const sectionTitle = (n, zh, en, other = "") =>
  `<div class="section-title">${n ? `<span class="index">${n} /</span>` : ""}<h2>${t(zh, en)}</h2>${other}</div>`;
const articleDate = (a) => articlePublishedAt(a).replaceAll("-", ".");
const plainText = (html = "") => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const summary = (a) => a.summary || plainText(a.body).slice(0, 140);
const readMinutes = (a) => {
  const text = plainText(a.body);
  const chinese = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = text.replace(/[\u3400-\u9fff]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(chinese / 400 + words / 220));
};
const readingTime = (a) => t(`约 ${readMinutes(a)} 分钟`, `~${readMinutes(a)} min read`);
const fallbackLanguage = (a) => a.lang === lang ? "" : a.lang === "zh" ? t("仅有中文原文", "Chinese original · translation unavailable") : t("英文原文 · 暂无中文译文", "English original only");
const topicName = (id) => topicLabel(id, lang, data.topics);
const categoryInfo = (id) => (data.categories || []).find((c) => c.id === id);
const categoryName = (id) => (lang === "en" && categoryInfo(id)?.en) || id;
const isRadar = (a) => /^oss-radar-/.test(a.id);
// One shared label row: the section first, then the author's own tags.
const entryLabels = (a, tagLimit = 3) => `${a.category ? `<span class="entry-category">${esc(categoryName(a.category))}</span>` : ""}${(a.tags || []).slice(0, tagLimit).map((tag) => `<span>${esc(tag)}</span>`).join("")}`;
const workKind = (id) => data.projectKinds?.[id]?.[lang] || id;
const toolName = (tool) => lang === "zh" ? tool.titleZh || tool.title : tool.titleEn || tool.title;
const toolLabel = (tool) => tool.availability === "web" ? t("打开工具", "Open tool") : tool.id === "navigator" ? t("安装脚本", "Install userscript") : t("安装说明", "Setup guide");
const articleKey = (a) => a.translationKey || a.id;
const JOURNAL_PAGE_SIZE = 12;
// Public profiles, same set as the GitHub profile page.
const PROFILES = [
  ["GitHub", "widechaos", "https://github.com/widechaos"],
  ["Hugging Face", "WideChaos", "https://huggingface.co/WideChaos"],
  ["Kaggle", "xover2022", "https://www.kaggle.com/xover2022"],
  ["LinkedIn", "renchao-wu-widechaos", "https://www.linkedin.com/in/renchao-wu-widechaos/"],
  ["X", "@thewidechaos", "https://x.com/thewidechaos"],
  ["Bluesky", "widechaos.bsky.social", "https://bsky.app/profile/widechaos.bsky.social"],
  ["DEV", "widechaos", "https://dev.to/widechaos"],
];
// Brand marks from simple-icons (CC0), drawn in the current text colour.
const PROFILE_ICONS = {
  "GitHub": "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12",
  "Hugging Face": "M1.4446 11.5059c0 1.1021.1673 2.1585.4847 3.1563-.0378-.0028-.0691-.0058-.1058-.0058-.4209 0-.8015.16-1.0704.4512-.3454.3737-.4984.8335-.4316 1.293a1.576 1.576 0 0 0 .2148.5978c-.2319.1864-.4018.4456-.4844.7578-.0646.2448-.131.7543.2149 1.2794a1.4552 1.4552 0 0 0-.0625.1055c-.208.3923-.2207.8372-.0371 1.25.2783.6258.9696 1.1175 2.3126 1.6467.8356.3292 1.5988.5411 1.6056.543 1.1046.2847 2.104.4277 2.969.4277 1.4173 0 2.4754-.3849 3.1525-1.1446 1.538.2651 2.791.1403 3.592.006.6773.7555 1.7332 1.1387 3.1467 1.1387.8649 0 1.8643-.143 2.969-.4278.0068-.0019.77-.2138 1.6056-.543 1.343-.5292 2.0343-1.0208 2.3126-1.6466.1836-.4129.171-.8577-.037-1.25a1.4685 1.4685 0 0 0-.0626-.1056c.346-.525.2795-1.0346.2149-1.2793-.0826-.3122-.2525-.5714-.4844-.7579.11-.1816.1831-.3788.2148-.5977.0669-.4595-.0862-.9193-.4316-1.293-.2688-.2913-.6495-.4513-1.0704-.4513-.0209 0-.0376.0008-.0588.0018.3162-.9966.4846-2.0518.4846-3.1523 0-5.807-4.7362-10.5144-10.5789-10.5144-5.8426 0-10.5788 4.7073-10.5788 10.5144Zm10.5788-9.4831c5.2727 0 9.5476 4.246 9.5476 9.483a9.4201 9.4201 0 0 1-.2696 2.2365c-.0039-.0047-.0079-.011-.0117-.0156-.274-.3255-.6679-.5059-1.1075-.5059-.352 0-.714.1155-1.0763.3438-.2403.1517-.5058.422-.7793.7598-.2534-.3492-.608-.5832-1.0137-.6465a1.5174 1.5174 0 0 0-.2344-.0176c-.9263 0-1.4828.7993-1.6935 1.5177-.1046.2426-.6065 1.3482-1.3614 2.0978-1.1681 1.1601-1.4458 2.3534-.8396 3.6382-.843.1029-1.5836.0927-2.365-.006.5906-1.212.3626-2.4388-.8426-3.6322-.755-.7496-1.2568-1.8552-1.3614-2.0978-.2107-.7184-.7673-1.5177-1.6935-1.5177-.078 0-.1568.0054-.2344.0176-.4057.0633-.7604.2973-1.0137.6465-.2735-.3379-.539-.6081-.7794-.7598-.3622-.2283-.7243-.3438-1.0762-.3438-.4266 0-.8094.171-1.0821.4786a9.4208 9.4208 0 0 1-.2598-2.1936c0-5.237 4.2749-9.483 9.5475-9.483zM8.6443 7.0036c-.4838.0043-.9503.2667-1.1934.7227-.3536.6633-.1006 1.4873.5645 1.84.351.1862.4883-.5261.836-.6485.3107-.1095.841.399 1.0078.086.3536-.6634.1025-1.4874-.5625-1.84a1.3659 1.3659 0 0 0-.6524-.1602Zm6.8403 0c-.2199-.002-.4426.05-.6504.1602-.665.3526-.9181 1.1766-.5645 1.84.1669.313.6971-.1955 1.0079-.086.3476.1224.4867.8347.838.6485.6649-.3527.916-1.1767.5624-1.84-.243-.456-.7096-.7184-1.1934-.7227Zm-9.7565 1.418a.8768.8768 0 0 0-.877.877c0 .4846.3925.877.877.877a.8768.8768 0 0 0 .877-.877.8768.8768 0 0 0-.877-.877zm12.6434 0c-.4845 0-.879.3925-.879.877 0 .4846.3945.877.879.877a.8768.8768 0 0 0 .877-.877.8768.8768 0 0 0-.877-.877zM8.7927 11.459c-.179-.003-.2793.1107-.2793.416 0 .8097.3874 2.125 1.4279 2.924.207-.7123 1.3453-1.2832 1.5079-1.2012.2315.1167.2191.4417.6074.7266.3884-.285.374-.6098.6056-.7266.1627-.082 1.3009.4889 1.5079 1.2012 1.0404-.799 1.4278-2.1144 1.4278-2.924 0-1.2212-1.583.6402-3.5413.6485-1.4686-.0061-2.7266-1.0558-3.2639-1.0645zM4.312 14.4768c.5792.365 1.6964 2.2751 2.1056 3.0177.1371.2488.371.3536.582.3536.4188 0 .7465-.4138.0391-.9395-1.0636-.791-.6914-2.0846-.1836-2.1642a.4302.4302 0 0 1 .0664-.004c.4616 0 .666.7892.666.7892s.5959 1.4898 1.6213 2.508c.942.9356 1.062 1.703.4961 2.6661-.0164-.004-.0159.0236-.1484.2149-.1853.2673-.4322.4688-.7188.6152-.5062.2269-1.1397.2696-1.7833.2696-1.037 0-2.1017-.1824-2.6975-.336-.0293-.0075-3.6505-.9567-3.1916-1.8224.0771-.1454.2033-.2031.3633-.2031.6463 0 1.823.9551 2.3283.9551.113 0 .196-.0865.2285-.2031.2249-.8045-3.2787-1.0522-2.9846-2.1642.0519-.1967.193-.2757.3907-.2754.854 0 2.7704 1.4923 3.172 1.4923.0307 0 .0525-.0085.0645-.0274.2012-.3227.1096-.5865-1.3087-1.4395-1.4182-.8533-2.4315-1.329-1.8653-1.9416.0651-.0707.1574-.1015.2695-.1015.8611.0002 2.8948 1.84 2.8948 1.84s.5487.5683.8809.5683c.0762 0 .1416-.0315.1855-.1054.2355-.3946-2.1858-2.2183-2.3224-2.971-.0926-.51.0641-.7676.3555-.7676-.0006.008.1701-.0285.4942.1759zm16.2257.5918c-.1366.7526-2.5579 2.5764-2.3224 2.9709.044.074.1092.1055.1855.1055.3321 0 .881-.5684.881-.5684s2.0336-1.8397 2.8947-1.84c.1121 0 .2044.0308.2695.1016.5662.6125-.447 1.0882-1.8653 1.9415-1.4183.853-1.51 1.1168-1.3087 1.4396.012.0188.0337.0273.0644.0273.4016 0 2.3181-1.4923 3.1721-1.4923.1977-.0002.3388.0787.3907.2754.294 1.112-3.2095 1.3597-2.9846 2.1642.0325.1166.1156.2032.2285.2032.5054 0 1.682-.9552 2.3283-.9552.16 0 .2862.0577.3633.2032.459.8656-3.1623 1.8149-3.1916 1.8224-.5958.1535-1.6605.336-2.6975.336-.6351 0-1.261-.0409-1.7638-.2599-.2949-.1472-.5488-.3516-.7383-.625-.0411-.0682-.1026-.1476-.1426-.205-.5726-.9679-.455-1.7371.4903-2.676 1.0254-1.0182 1.6212-2.508 1.6212-2.508s.2044-.7891.666-.7891a.4318.4318 0 0 1 .0665.0039c.5078.0796.88 1.3732-.1836 2.1642-.7074.5257-.3797.9395.039.9395.211 0 .445-.1047.5821-.3535.4092-.7426 1.5264-2.6527 2.1056-3.0178.5588-.3524.99-.1816.8497.5918z",
  "Kaggle": "M.1025 7.3475c-.0681 0-.1022.0341-.1022.102v6.752c0 .0681.034.1022.1022.1022h.7049c.068 0 .1022-.034.1022-.1023v-1.481l.4187-.3985 1.5016 1.91c.041.0477.0884.0716.143.0716h.9091c.0476 0 .0748-.0135.0817-.0407.0135-.041.0066-.075-.0206-.1023l-1.9816-2.4618 1.9002-1.8384c.0204-.0205.0237-.051.01-.092-.0137-.0339-.0408-.051-.0816-.051h-.9398c-.0477 0-.0953.024-.143.0716L.9096 11.607V7.4496c0-.0679-.0342-.102-.1022-.102zm18.0417 0c-.068 0-.102.0341-.102.102v6.752c0 .0681.034.102.102.102h.705c.068 0 .102-.034.102-.102v-6.752c0-.068-.034-.102-.102-.102zM5.961 9.6254c-.5653 0-1.11.1806-1.6343.5415-.0545.0545-.0648.102-.0307.143l.3676.5208c.0272.0477.0717.0545.133.0204.3948-.2722.783-.4086 1.1644-.4086.2927 0 .5158.0886.669.2656.1532.1771.2197.3917.1992.6436-.6606.0681-1.1545.1495-1.4813.245-.8308.2383-1.2461.6913-1.2461 1.3586 0 .4222.1533.7695.4598 1.0419.3132.2654.6845.3982 1.1134.3982.4698 0 .8545-.1125 1.1542-.3372v.1432c0 .0682.0374.102.1123.102h.7048c.068 0 .102-.0338.102-.102V11.372c0-.6604-.2245-1.1406-.6739-1.4403-.3065-.2043-.6776-.3063-1.1134-.3063zm4.3225 0c-.6742 0-1.195.2622-1.5627.7865-.3133.4359-.4699.9671-.4699 1.5936 0 .6604.1634 1.2087.4903 1.6444.3744.4972.892.7455 1.5526.7455.5313 0 .9567-.1327 1.2768-.3982v.531c0 .858-.4122 1.287-1.236 1.287-.361 0-.732-.1907-1.1132-.572a.098.098 0 00-.0716-.0306c-.034 0-.0613.0102-.0817.0307l-.4802.48c-.0408.0613-.0375.1124.0103.1532.1361.1157.2554.2129.3576.2911.102.0783.1905.1413.2656.189.354.1975.7284.2961 1.1235.2961.6808 0 1.207-.1925 1.5781-.577.3711-.3848.5567-.9484.5567-1.6903V9.8196c0-.068-.034-.102-.102-.102h-.705c-.0682 0-.1021.034-.1021.102v.2043c-.3471-.2657-.7763-.3985-1.287-.3985zm4.8021 0c-.6742 0-1.195.2622-1.5627.7865-.3132.4359-.4699.9671-.4699 1.5936 0 .6604.1633 1.2087.4903 1.6444.3744.4972.892.7455 1.5526.7455.5311 0 .9566-.1327 1.2768-.3982v.531c0 .858-.4122 1.287-1.236 1.287-.361 0-.732-.1907-1.1133-.572a.098.098 0 00-.0716-.0306c-.034 0-.0612.0102-.0816.0307l-.48.48c-.0409.0613-.0376.1124.01.1532.1363.1157.2555.2129.3576.2911.1021.0783.1906.1413.2657.189.354.1975.7285.2961 1.1237.2961.6808 0 1.2068-.1925 1.5781-.577.371-.3848.5565-.9484.5565-1.6903V9.8196c0-.068-.034-.102-.102-.102h-.7049c-.0682 0-.1022.034-.1022.102v.2043c-.3474-.2657-.7763-.3985-1.287-.3985zm6.7457 0c-.6537 0-1.185.211-1.5936.6332-.4427.4632-.664 1.0283-.664 1.6956 0 .7083.225 1.2905.6743 1.7467.463.463 1.042.6945 1.7366.6945.6467 0 1.2154-.1838 1.7057-.5515.0545-.041.0545-.0884 0-.143l-.4802-.4903c-.041-.0409-.0919-.0409-.1533 0-.2998.2112-.6368.3167-1.0112.3167-.4222 0-.7729-.119-1.052-.3576-.2452-.2248-.3882-.5038-.429-.8375h3.3197c.0679 0 .1022-.0341.1022-.1023l.01-.2244c.0341-.6878-.1668-1.26-.6025-1.7162-.4224-.4426-.9432-.664-1.5627-.664zm-.0206.7865c.3268 0 .6062.1056.8377.3166.2452.211.371.4734.378.7865h-2.4618c.0613-.3269.2077-.5925.4392-.7968.2313-.2042.5004-.3063.8069-.3063zm-11.4249.102c.6196 0 1.0146.2181 1.1848.6538v1.6854c-.1702.4358-.5755.6538-1.2155.6538-.3133 0-.5687-.0986-.7661-.2963-.2656-.2518-.3983-.6538-.3983-1.2053 0-.9941.3984-1.4914 1.1951-1.4914zm4.802 0c.6196 0 1.0148.2181 1.1851.6538h-.0002v1.6854c-.1703.4358-.5755.6538-1.2155.6538-.3132 0-.5686-.0986-.7661-.2963-.2655-.2518-.3983-.6538-.3983-1.2053 0-.9941.3983-1.4914 1.195-1.4914zm-8.3586 1.6547v1.0215c-.286.286-.6675.412-1.1441.3779-.1703-.0135-.32-.0663-.4493-.1582-.1294-.0919-.2045-.2129-.2249-.3627-.0341-.2657.1158-.47.4495-.6129.2452-.1088.7013-.1974 1.3688-.2656z",
  "LinkedIn": "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  "X": "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  "Bluesky": "M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z",
  "DEV": "M7.42 10.05c-.18-.16-.46-.23-.84-.23H6l.02 2.44.04 2.45.56-.02c.41 0 .63-.07.83-.26.24-.24.26-.36.26-2.2 0-1.91-.02-1.96-.29-2.18zM0 4.94v14.12h24V4.94H0zM8.56 15.3c-.44.58-1.06.77-2.53.77H4.71V8.53h1.4c1.67 0 2.16.18 2.6.9.27.43.29.6.32 2.57.05 2.23-.02 2.73-.47 3.3zm5.09-5.47h-2.47v1.77h1.52v1.28l-.72.04-.75.03v1.77l1.22.03 1.2.04v1.28h-1.6c-1.53 0-1.6-.01-1.87-.3l-.3-.28v-3.16c0-3.02.01-3.18.25-3.48.23-.31.25-.31 1.88-.31h1.64v1.3zm4.68 5.45c-.17.43-.64.79-1 .79-.18 0-.45-.15-.67-.39-.32-.32-.45-.63-.82-2.08l-.9-3.39-.45-1.67h.76c.4 0 .75.02.75.05 0 .06 1.16 4.54 1.26 4.83.04.15.32-.7.73-2.3l.66-2.52.74-.04c.4-.02.73 0 .73.04 0 .14-1.67 6.38-1.8 6.68z",
};
const profileIcon = (name) => `<svg class="profile-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${PROFILE_ICONS[name]}"/></svg>`;
const FEED = "https://widechaos.cn/blog/rss.xml";
// Feed links open a short "how to subscribe" panel; the raw XML is only for readers.
const rssLink = (label, cls = "") => `<a class="${cls}" href="${FEED}" data-rss>${label}</a>`;
const GITHUB_ICON = '<svg class="gh-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.66.07-.52.28-.87.51-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>';
const repoOf = (href = "") => href.match(/^https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)?.[1];
function articleMeta(a) {
  return `<div class="entry-meta"><time datetime="${esc(articlePublishedAt(a))}">${articleDate(a)}</time><span>${readingTime(a)}</span>${a.category ? `<span>${esc(categoryName(a.category))}</span>` : ""}</div>`;
}
function projectVisual(p) {
  if (p.demo && ["router", "bulletin", "obsidian"].includes(p.demo)) return demoMarkup(p.demo, lang, p.demo === "bulletin" ? streamHeadlines() : []);
  return `<div class="project-poster poster-${esc(p.id)}"><span class="poster-grid"></span><span class="poster-big">${esc(projectMonogram(p))}</span><span class="poster-label">${esc(p.title)}</span><small>${esc(p.tag)}</small></div>`;
}
// Bulletin's demo streams what is actually new here: recent titles and radar picks.
function streamHeadlines() {
  const recent = articleSet().slice(0, 5);
  const radar = recent.find(isRadar);
  const picks = radar ? [...radar.body.matchAll(/<h3[^>]*>\s*\d+\.\s+(\S+)\s+⭐/g)].map((m) => "★ " + m[1]) : [];
  return [...recent.map((a) => a.title), ...picks].slice(0, 9);
}
function featuredWork(p, index) {
  return `<article class="${index === 0 ? "feature-work" : ""} reveal"><div class="work-visual">${projectVisual(p)}</div><div class="${index === 0 ? "work-caption" : "small-caption"}"><div><p class="eyebrow">${esc(p.tag)}</p><h3>${link("/projects/" + p.id, esc(p.title) + " " + arrow)}</h3></div><p>${esc(desc(p))}</p></div></article>`;
}
function toolCard(tool, compact = false) {
  return `<article class="tool-card ${compact ? "compact" : ""}" id="tool-${esc(tool.id)}"><div class="tool-card-top"><span class="eyebrow">${tool.availability === "web" ? t("在线使用", "IN YOUR BROWSER") : t("安装使用", "INSTALL TO USE")}</span><span class="tool-card-symbol" aria-hidden="true">${tool.availability === "web" ? "↗" : "↓"}</span></div><h3>${esc(toolName(tool))}</h3><p>${esc(desc(tool))}</p><div class="tool-card-actions">${link(tool.url, toolLabel(tool) + " " + arrow, "tool-launch")}${tool.projectId ? link("/projects/" + tool.projectId, t("了解作品", "About this work") + " →", "tool-context") : ""}</div></article>`;
}

function header() {
  const path = location.pathname;
  $("#header").innerHTML =
    `<a class="brand" href="/" aria-label="十方空烬 · Ember 首页"><span class="brand-mark" aria-hidden="true"><img src="/static/x-sword.svg" alt="" width="42" height="49"></span><span>WIDECHAOS<small>${t("十方空烬 · Ember", "Ember · 十方空烬")}</small></span></a><nav aria-label="${t("主导航", "Main navigation")}">${[
      ["/", "首页", "Home"],
      ["/projects", "作品", "Work"],
      ["/blog", "十方志", "Journal"],
      ["/tools", "工具", "Tools"],
      ["/about", "关于", "About"],
    ]
      .map(
        ([p, z, e]) =>
          `<a href="${p}" ${path === p || (p !== "/" && path.startsWith(p + "/")) ? 'aria-current="page"' : ""}>${t(z, e)}</a>`,
      )
      .join(
        "",
      )}</nav><div class="header-actions"><button id="search-open" class="search-icon" aria-label="${t("搜索", "Search")}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></button><button id="language" aria-label="${t("Switch to English", "切换到中文")}">${t("English", "中文")}</button><button id="motion" class="motion" aria-pressed="${motion === "on"}" aria-label="${t("动态效果", "Motion effects")}"><i></i><span>${t("动态", "Motion")}</span></button></div>`;
  $("#footer").innerHTML =
    `<div class="footer-top"><a class="footer-name" href="/">WIDECHAOS<span>↗</span></a><p>Per aspera ad astra.</p></div><div class="footer-links"><span>十方空烬 · Ember</span><div>${link("/projects", t("作品", "Work"))}${link("/blog", t("十方志", "Journal"))}${link("/tools", t("工具", "Tools"))}${link("/now", t("现在", "Now"))}${rssLink("RSS ↗")}</div><div class="footer-profiles">${PROFILES.map(([name, , url]) => `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${name}" title="${name}">${profileIcon(name)}</a>`).join("")}</div><button data-top>${t("返回顶部 ↑", "Back to top ↑")}</button></div>`;
  $("#language").onclick = () => {
    lang = lang === "zh" ? "en" : "zh";
    localStorage.setItem("wc-site-lang", lang);
    const article = data.articles.find(
      (a) => location.pathname.replace(/\/$/, "") === "/blog/" + a.id,
    );
    const translated = findArticleTranslation(data.articles, article, lang);
    if (translated && translated.id !== article.id)
      navigate("/blog/" + translated.id, true);
    else {
      render(false);
      $("#language").focus({ preventScroll: true });
    }
  };
  $("#motion").onclick = () => {
    motion = motion === "on" ? "off" : "on";
    localStorage.setItem("wc-site-motion", motion);
    document.documentElement.dataset.motion = motion;
    header();
    bindGlobal();
    $("#motion").focus({ preventScroll: true });
  };
  $("#search-open").onclick = openSearch;
}
function projectMini(p, i) {
  return `<a class="project-row" href="/projects/${p.id}"><span class="row-number">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(p.title)}</h3><p>${esc(desc(p))}</p></div><span class="project-type">${esc(p.tag)}</span>${arrow}</a>`;
}
function articleRow(a, i = 0, level = 3) {
  return `<a class="article-row" href="/blog/${a.id}" lang="${a.lang}"><span class="article-date"><time datetime="${esc(articlePublishedAt(a))}">${articleDate(a)}</time><small>${readingTime(a)}</small></span><div class="article-row-copy"><div class="entry-topics">${entryLabels(a)}</div><h${level}>${esc(a.title)}</h${level}><p>${esc(summary(a))}</p>${a.seriesCount > 1 ? `<span class="series-note">${esc(a.series)} · ${t(`共 ${a.seriesCount} 期，这是最新一期`, `${a.seriesCount} issues · latest shown`)}</span>` : ""}${fallbackLanguage(a) ? `<span class="language-note">${fallbackLanguage(a)}</span>` : ""}</div><span class="article-number" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>${arrow}</a>`;
}
function homeJournal() {
  const [first, ...rest] = articleSet().slice(0, 3);
  if (!first) return "";
  return `<section class="section home-journal" id="latest">${sectionTitle("01", "最近写了", "Latest writing", link("/blog", t("全部文章", "All writing") + " " + arrow, "section-more"))}<div class="latest-layout"><a class="latest-story" href="/blog/${first.id}" lang="${first.lang}"><span class="latest-glyph" aria-hidden="true">誌</span>${articleMeta(first)}<h2>${esc(first.title)}</h2><p>${esc(summary(first))}</p>${fallbackLanguage(first) ? `<span class="language-note">${fallbackLanguage(first)}</span>` : ""}<span class="story-open">${t("阅读全文", "Read the article")} ${arrow}</span></a><div class="latest-side">${rest.map(a => `<a href="/blog/${a.id}" lang="${a.lang}">${articleMeta(a)}<h3>${esc(a.title)}</h3>${fallbackLanguage(a) ? `<span class="language-note">${fallbackLanguage(a)}</span>` : ""}${arrow}</a>`).join("")}<div class="follow-writing"><p>thinking out loud,<br><em>in the open.</em></p>${rssLink(t("RSS 订阅", "Subscribe via RSS") + " " + arrow)}</div></div></div></section>`;
}
function home() {
  const featured = selectFeaturedProjects(data.projects, 3);
  const tools = availableTools(data).filter((tool) => !featured.some((p) => p.id === tool.projectId));
  return `<section class="hero" id="intro"><div class="hero-art" id="hero-art"><img src="/static/city-art.png" alt="" fetchpriority="high"></div><div class="hero-shade"></div><div class="hero-copy"><p class="eyebrow"><span class="accent-dot"></span> EMBER / RENCHAO WU</p><h1 aria-label="十方空烬"><span>十方</span><span class="name-second">空烬<span class="name-star" aria-hidden="true"><img src="/static/x-sword.svg" alt="" width="96" height="112"></span></span></h1><p class="hero-slogan">BUILD. BREAK. REBUILD.</p><p class="identity-tags">${tags()
    .map((x, i) => `<span>${tagFx(x, i)}</span>`)
    .join(
      "",
    )}</p><div class="hero-links">${link("/projects", t("看作品", "Explore work") + " " + arrow, "primary-link")}${link("/blog", t("读十方志", "Read the journal") + " <span>↗</span>", "text-link")}</div></div>${lang === "zh" ? `<div class="hero-poem" lang="zh-CN"><span>智灯已灭余空烬</span><span>犹自光明照十方</span></div>` : `<div class="hero-poem hero-poem-en" lang="en"><p>From the ashes a fire shall be woken,<br>a light from the shadows shall spring.</p><small>— J.R.R. Tolkien</small></div>`}<div class="hero-bottom"><a href="#latest" class="scroll-cue"><span>↓</span> ${t("向下浏览", "SCROLL TO EXPLORE")}</a><span class="hero-location">WIDECHAOS.CN</span><button id="art-mode" aria-pressed="${light === "etch"}">${t("画面", "VIEW")} <b>${light === "neon" ? t("夜景", "NIGHT") : t("线描", "ETCH")}</b> ⇄</button></div></section>
 ${homeJournal()}
 ${featured.length ? `<section class="section selected" id="selected">${sectionTitle("02", "精选作品", "Selected work", link("/projects", t("全部作品", "All work") + " " + arrow, "section-more"))}${featuredWork(featured[0], 0)}${featured.length > 1 ? `<div class="work-pair">${featured.slice(1).map((p, i) => featuredWork(p, i + 1)).join("")}</div>` : ""}</section>` : ""}
 ${tools.length ? `<section class="section home-tools" id="home-tools">${sectionTitle("03", "工具", "Tools", link("/tools", t("全部工具", "All tools") + " " + arrow, "section-more"))}<div class="home-tool-grid">${tools.slice(0, 2).map(tool => toolCard(tool, true)).join("")}</div></section>` : ""}

 <section class="manifesto-section" id="manifesto"><div class="manifesto-caption"><span class="eyebrow">${t("MANIFESTO / 宣言", "MANIFESTO")}</span>${link("/about", t("关于我", "About me") + " " + arrow)}</div><p class="manifesto-text">${t("短期促进生产，<br><span>长期促进革命。</span>", "Short-term,<br>fueling production.<br><span>Long-term,<br>fueling the revolution.</span>")}</p><p class="manifesto-tribute"${lang === "zh" ? ' lang="zh-CN"' : ""}>${t("<span>星星之火，可以燎原</span><small>毛泽东　一九三〇</small>", "<span>A single spark can start a prairie fire.</span><small>— Mao Zedong, 1930</small>")}</p><div class="manifesto-bottom"><span>Build. Break. Rebuild.</span><span>十方空烬 · Ember</span></div></section>`;
}
function pageHead(n, zh, en, sub = "") {
  return `<div class="page-head"><span class="eyebrow">${n} / WIDECHAOS</span><h1>${t(zh, en)}<span class="heading-star" aria-hidden="true">✳</span></h1>${sub ? `<p>${sub}</p>` : ""}</div>`;
}
function projects() {
  const kinds = [...new Set(data.projects.map(p => p.kind))];
  if (!kinds.includes(projectFilter)) projectFilter = "all";
  const selected = sortProjects(data.projects).filter(p => projectFilter === "all" || p.kind === projectFilter);
  return `<div class="page-wrap">${pageHead("01", "作品", "Work", "Build. Break. Rebuild.")}<div class="filter-bar" aria-label="${t("作品筛选", "Filter work")}">${["all", ...kinds].map(id => `<button data-filter="${esc(id)}" aria-pressed="${projectFilter === id}">${id === "all" ? t("全部", "All") : esc(workKind(id))}</button>`).join("")}<span class="result-count">${selected.length} ${t("项作品", "PROJECTS")}</span></div><div class="project-list">${selected.map(projectMini).join("")}</div><aside class="work-foot"><span>${t("想直接使用？", "Looking for something to use?")}</span>${link("/tools", t("打开工具目录", "Browse the tools") + " " + arrow)}</aside></div>`;
}
function projectDetail(id) {
  const p = data.projects.find((p) => p.id === id);
  if (!p) return notFound();
  const visual = projectVisual(p);
  const next =
    data.projects[(data.projects.indexOf(p) + 1) % data.projects.length];
  const related = articleForProject(data.articles, p, lang);
  return `<div class="page-wrap project-detail"><a class="back-link" href="/projects">← ${t("全部作品", "All work")}</a><header class="project-heading"><p class="eyebrow">${esc(p.tag)}</p><h1>${esc(p.title)}</h1><p>${esc(desc(p))}</p></header><div class="detail-visual">${visual}</div><div class="project-body"><div><h2>${t("源码与资料", "Source & resources")}</h2><p class="activity-line" data-activity="${esc(p.url)}">${t("正在读取最近更新…", "Checking latest activity…")}</p></div><div class="resource-links">${link(p.url, sourceLabel(p.url) + " " + arrow, "resource")}${id === "router" ? link("https://huggingface.co/datasets/WideChaos/bilingual-router-lora-v2", t("合成数据集", "Synthetic dataset") + " " + arrow, "resource") + link("https://www.kaggle.com/code/xover2022/bilingual-router-lora-v2-frozen-output-check", t("复现与核对", "Reproduction & checks") + " " + arrow, "resource") : ""}${id === "navigator" ? link("https://greasyfork.org/zh-CN/scripts/560039-deepseek-chat-navigator", t("安装脚本", "Install userscript") + " " + arrow, "resource") : ""}</div></div>${related ? `<a class="related-article" href="/blog/${related.id}"><span>${t("相关文字", "Related writing")} →</span><h2>${esc(related.title)}</h2>${arrow}</a>` : ""}${data.projects.length > 1 ? `<a class="next-project" href="/projects/${next.id}"><span>${t("下一件作品", "Next project")}</span><h2>${esc(next.title)}</h2>${arrow}</a>` : ""}</div>`;
}
function sourceLabel(url) {
  if (repoOf(url)) return t("GitHub 源码", "Source on GitHub");
  if (/huggingface\.co\/datasets\//.test(url)) return t("Hugging Face 数据集", "Dataset on Hugging Face");
  if (/huggingface\.co\/spaces\//.test(url)) return t("在线演示 · Hugging Face", "Live demo on Hugging Face");
  if (/huggingface\.co\//.test(url)) return t("Hugging Face 模型", "Model on Hugging Face");
  return t("项目主页", "Project page");
}
// Latest public activity, read in the visitor's browser and cached for the visit.
async function activity(url) {
  const key = "wc-activity:" + url;
  try { const hit = JSON.parse(sessionStorage.getItem(key)); if (hit) return hit; } catch {}
  const repo = repoOf(url);
  const hf = url.match(/^https:\/\/huggingface\.co\/(datasets\/|spaces\/)?([\w.-]+\/[\w.-]+)/);
  let result = null;
  if (repo) {
    const [info, release] = await Promise.all([fetch("https://api.github.com/repos/" + repo), fetch("https://api.github.com/repos/" + repo + "/releases/latest")]);
    if (!info.ok) return null;
    const meta = await info.json();
    const latest = release.ok ? await release.json() : null;
    result = { date: meta.pushed_at?.slice(0, 10), version: latest?.tag_name || "", versionDate: latest?.published_at?.slice(0, 10) || "" };
  } else if (hf) {
    const kind = { "datasets/": "datasets", "spaces/": "spaces" }[hf[1]] || "models";
    const info = await fetch(`https://huggingface.co/api/${kind}/${hf[2]}`);
    if (!info.ok) return null;
    result = { date: (await info.json()).lastModified?.slice(0, 10), version: "" };
  }
  if (result?.date) try { sessionStorage.setItem(key, JSON.stringify(result)); } catch {}
  return result?.date ? result : null;
}
function activityText(info) {
  return t(`最近更新 ${info.date}`, `Updated ${info.date}`) + (info.version ? ` · ${info.version}${info.versionDate ? t(`（${info.versionDate} 发布）`, ` (released ${info.versionDate})`) : ""}` : "");
}
function fillActivity() {
  const nodes = [...document.querySelectorAll("[data-activity]")];
  return Promise.all(nodes.map(async (node) => {
    const info = await activity(node.dataset.activity).catch(() => null);
    if (!node.isConnected) return null;
    node.textContent = info ? activityText(info) : "";
    if (info) node.closest("[data-activity-row]")?.setAttribute("data-date", info.date);
    return info?.date;
  }));
}
function filteredArticles() {
  const query = searchTerm.trim().toLowerCase();
  return articleSet().filter(a => (journalCategory === "all" || a.category === journalCategory) && (!journalSeries || a.series === journalSeries) && (a.title + " " + summary(a) + " " + plainText(a.body)).toLowerCase().includes(query));
}
// A daily series would bury everything else, so the default list shows only its newest issue.
function collapseSeries(list) {
  if (journalSeries || searchTerm.trim()) return list;
  const counts = new Map();
  list.forEach((a) => a.series && counts.set(a.series, (counts.get(a.series) || 0) + 1));
  const shown = new Set();
  return list.filter((a) => !a.series || (!shown.has(a.series) && shown.add(a.series))).map((a) => a.series ? { ...a, seriesCount: counts.get(a.series) } : a);
}
function journalUrl(page = 1) {
  const q = new URLSearchParams();
  if (journalCategory !== "all") q.set("c", journalCategory);
  if (journalSeries) q.set("series", journalSeries);
  if (searchTerm.trim()) q.set("q", searchTerm.trim());
  if (page > 1) q.set("page", page);
  return "/blog" + (q.size ? "?" + q.toString() : "");
}
function journalResults() {
  const list = collapseSeries(filteredArticles());
  const pages = Math.max(1, Math.ceil(list.length / JOURNAL_PAGE_SIZE));
  journalPage = Math.min(Math.max(1, journalPage), pages);
  const offset = (journalPage - 1) * JOURNAL_PAGE_SIZE;
  const rows = list.slice(offset, offset + JOURNAL_PAGE_SIZE);
  return `${rows.length ? rows.map((a, i) => articleRow(a, offset + i, 2)).join("") : `<div class="empty-state"><p>${t("没有匹配的文章。", "No matching articles.")}</p><button data-reset-journal>${t("清除筛选", "Clear filters")}</button></div>`}${pages > 1 ? `<nav class="pagination" aria-label="${t("文章分页", "Article pages")}">${journalPage > 1 ? link(journalUrl(journalPage - 1), "← " + t("上一页", "Previous")) : "<span></span>"}<span>${journalPage} / ${pages}</span>${journalPage < pages ? link(journalUrl(journalPage + 1), t("下一页", "Next") + " →") : "<span></span>"}</nav>` : ""}`;
}
function journal() {
  const list = filteredArticles();
  const all = articleSet();
  const categories = (data.categories || []).filter((c) => all.some((a) => a.category === c.id));
  const series = [...new Set(all.map((a) => a.series).filter(Boolean))];
  const motto = categoryInfo(journalCategory)?.[lang === "zh" ? "motto" : "desc"];
  return `<div class="page-wrap journal-page"><div class="journal-page-top"><div>${pageHead("02", "十方志", "Journal")}<p class="journal-intro">${t("一个人的公开笔记。谋、谈、形、动、生活、造物，如九畦花木，各生其姿。<br>读过的书、想过的事、练过的手艺，都在这里缓慢生长。", "A public notebook. Mind, voice, body, craft, life, works: nine plots, each growing its own way.<br>Books read, thoughts worked through, crafts practised, all growing here slowly.")}</p></div><div class="journal-subscribe">${rssLink(t("RSS 订阅更新", "Follow with RSS") + " " + arrow)}</div></div>${categories.length ? `<div class="filter-bar topic-filters" aria-label="${t("文章分区", "Sections")}">${[{ id: "all" }, ...categories].map(c => `<button data-category="${esc(c.id)}" aria-pressed="${!journalSeries && journalCategory === c.id}">${c.id === "all" ? t("全部", "All") : esc(categoryName(c.id))}<small>${c.id === "all" ? all.length : all.filter(a => a.category === c.id).length}</small></button>`).join("")}${series.map(name => `<button class="series-filter" data-series="${esc(name)}" aria-pressed="${journalSeries === name}">${t("系列", "Series")} · ${esc(name)}<small>${all.filter(a => a.series === name).length}</small></button>`).join("")}</div>` : ""}${motto && !journalSeries ? `<p class="category-motto">${esc(motto)}</p>` : ""}<div class="blog-search"><label for="blog-query">${t("查找文章", "Find an article")}</label><input id="blog-query" type="search" value="${esc(searchTerm)}" placeholder="${t("按标题或正文搜索", "Search titles or text")}"><span aria-live="polite">${list.length} ${t("篇", "ARTICLES")}</span></div><div id="article-list">${journalResults()}</div><div class="journal-end"><p>Build. Break. Rebuild.</p>${link("/projects", t("看看文字背后的作品", "Explore the work behind the writing") + " " + arrow)}</div></div>`;
}
function relatedContent(a) {
  const projects = data.projects.filter(p => articleKey(articleForProject(data.articles, p, lang) || {}) === articleKey(a));
  const others = articleSet().filter(item => articleKey(item) !== articleKey(a));
  const overlap = item => (item.category === a.category ? 2 : 0) + (item.tags || []).filter(tag => a.tags?.includes(tag)).length - (item.series && item.series === a.series ? 3 : 0);
  others.sort((x, y) => overlap(y) - overlap(x));
  return `${projects.length ? `<section class="article-linked-work"><p class="eyebrow">${t("文中作品", "WORK IN THIS ARTICLE")}</p>${projects.map(projectMini).join("")}</section>` : ""}${others.length ? `<section class="continue-reading"><div class="section-title"><h2>${t("接着读", "Keep reading")}</h2>${link("/blog", t("全部文章", "All writing") + " " + arrow)}</div>${others.slice(0, 2).map((item, i) => articleRow(item, i)).join("")}</section>` : ""}`;
}
function articleResponse(a) {
  const email = data.contact?.email;
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent(t("关于：", "Re: ") + a.title)}&body=${encodeURIComponent(a.title + "\n" + a.url + "\n\n")}` : "";
  return `<section class="article-response" aria-labelledby="response-title"><div><p class="eyebrow">${t("读完以后", "AFTER READING")}</p><h2 id="response-title">${t("你怎么看？", "What do you think?")}</h2><p>${t("不同意见、补充，或者一个新问题，都可以写给我。", "A different view, a correction, or a new question — write to me.")}</p>${email ? `<small>${esc(email)} · ${t("邮件仅发给我，不会公开。", "Your email comes to me, not a public thread.")}</small>` : ""}</div><div class="response-actions">${mail ? link(mail, t("邮件回应这篇文章", "Reply by email") + " " + arrow, "primary-link") : ""}${a.discussionUrl ? link(a.discussionUrl, t("参与公开讨论", "Join the discussion") + " " + arrow, "response-secondary") : ""}<button class="response-secondary" data-copy-url="${esc(a.url)}">${t("复制文章链接", "Copy article link")}</button>${rssLink(t("通过 RSS 订阅", "Subscribe with RSS"), "response-secondary")}<span class="copy-status" role="status"></span><input class="copy-fallback" aria-label="${t("文章公开链接", "Public article URL")}" value="${esc(a.url)}" readonly hidden></div></section>`;
}
function articleDetail(id) {
  const a = data.articles.find((a) => a.id === id);
  if (!a) return notFound();
  const routerArticle = isRouterArticle(a);
  const box = document.createElement("div");
  box.innerHTML = a.body;
  if (isRadar(a)) radarLayout(box);
  box.querySelectorAll("a").forEach((link) => {
    if (link.href.startsWith("http")) {
      link.target = "_blank";
      link.rel = "noopener";
    }
    const repo = repoOf(link.getAttribute("href"));
    if (!repo || link.classList.contains("gh-link")) return;
    if (link.textContent.trim().replace(/\/$/, "") === link.getAttribute("href").replace(/\/$/, "")) link.textContent = repo;
    link.classList.add("gh-link");
    link.insertAdjacentHTML("afterbegin", GITHUB_ICON);
  });
  // Contents follow the article's own top two heading levels, whichever they are.
  const found = [...box.querySelectorAll("h2,h3,h4")];
  const top = Math.min(...found.map((h) => +h.tagName[1]));
  const headings = found.filter((h) => +h.tagName[1] <= top + 1).map((h, i) => {
    h.id = "section-" + i;
    return { id: h.id, text: h.dataset.toc || h.textContent.trim(), depth: +h.tagName[1] - top };
  });
  return `<div class="article-page"><div class="article-top"><a class="back-link" href="/blog">← ${t("十方志", "Journal")}</a><span>${articleDate(a)} · ${readingTime(a)}${a.updatedAt && a.updatedAt !== a.publishedAt ? ` · ${t("修订", "Updated")} ${esc(a.updatedAt)}` : ""}</span></div><header class="article-heading"><p class="eyebrow">${routerArticle ? "MLX / LoRA / EXPERIMENT" : [a.category && categoryName(a.category), a.series].filter(Boolean).map(esc).join(" / ") || "JOURNAL"}</p><h1>${esc(a.title)}</h1><div class="article-byline"><img src="/static/avatar.png" width="38" height="38" alt=""><span>Renchao Wu · 十方空烬</span>${fallbackLanguage(a) ? `<span class="language-note">${fallbackLanguage(a)}</span>` : ""}</div></header>${routerArticle ? `<div class="article-data-strip"><span><small>${t("严格全字段通过率", "STRICT ALL-FIELD")}</small>7.6% <i>→</i> 47.2%</span><span><small>${t("JSON 合法率", "VALID JSON")}</small>98.6% <b>→</b> 95.5%</span><em>${t("576 条留出合成测试", "576 held-out synthetic tests")}</em></div>` : ""}<div class="article-layout"><article class="article-body" lang="${a.lang}">${box.innerHTML}</article><aside class="article-toc"><p class="eyebrow">${t("本文目录", "ON THIS PAGE")}</p>${headings.map((h) => `<a class="toc-depth-${h.depth}" href="#${h.id}">${esc(h.text)}</a>`).join("")}<div class="toc-bottom">${link(a.url, t("公开原文", "Published original") + " " + arrow)}<button data-top>${t("回到开头 ↑", "Back to top ↑")}</button></div></aside></div>${articleResponse(a)}${relatedContent(a)}</div>`;
}
// Radar issues follow a fixed shape: "N. owner/repo ⭐ stars · language", then a GitHub line.
function radarLayout(box) {
  const pattern = /^(\d+)\.\s+(\S+)\s+⭐\s*([\d,]+)\s*·\s*(.+)$/;
  for (const h of [...box.querySelectorAll("h3")]) {
    const match = h.textContent.trim().match(pattern);
    if (!match) continue;
    const card = document.createElement("section");
    card.className = "radar-item";
    h.before(card);
    let node = h;
    while (node && !(node !== h && /^H[23]$/.test(node.tagName))) {
      const next = node.nextElementSibling;
      card.append(node);
      node = next;
    }
    const source = [...card.querySelectorAll("p")].find((p) => /^GitHub[：:]/.test(p.textContent.trim()) && p.querySelector("a"));
    const url = source?.querySelector("a").getAttribute("href") || "https://github.com/" + match[2];
    source?.remove();
    const [owner, name] = match[2].includes("/") ? match[2].split("/") : ["", match[2]];
    h.dataset.toc = match[2];
    h.innerHTML = `<span class="radar-no">${match[1].padStart(2, "0")}</span><span class="radar-repo">${owner ? `<small>${esc(owner)} /</small>` : ""}${esc(name)}</span>`;
    h.insertAdjacentHTML("afterend", `<div class="radar-stats"><span>★ ${esc(match[3])}</span><span>${esc(match[4])}</span><a class="gh-link" href="${esc(url)}">${GITHUB_ICON}${t("在 GitHub 打开", "Open on GitHub")}</a></div>`);
    card.querySelectorAll("p").forEach((p) => {
      const text = p.textContent.trim();
      if (/^(我的看法|My take)[：:]/.test(text)) p.classList.add("radar-verdict");
      if (p.children.length === 1 && p.firstElementChild.tagName === "EM" && /^(核验|Checked|Verification)/.test(text)) p.classList.add("radar-check");
    });
  }
}
function about() {
  const unique = [
    ...new Map(data.collection.map((x) => [x.image + "|" + x.url, x])).values(),
  ];
  const selected = unique.filter((x) => x.kind === collectionFilter);
  return `<div class="page-wrap about-page">${pageHead("04", "关于我", "About me", "Build. Break. Rebuild.")}<div class="about-identity"><div class="portrait-wrap"><img src="/static/avatar.png" alt="十方空烬 · Ember" width="480" height="480"><div class="portrait-lines" aria-hidden="true"></div><span>RENCHAO WU / EMBER</span></div><div class="identity-block"><p class="eyebrow">十方空烬 · Ember</p><div class="large-tags">${tags()
    .map((x, i) => `<span><small>0${i + 1}</small>${tagFx(x, i)}</span>`)
    .join(
      "",
    )}</div><p class="identity-signature">Per aspera ad astra.</p></div></div><div class="about-poem"><span>智灯已灭余空烬</span><span>犹自光明照十方</span></div><blockquote class="tolkien">“From the ashes a fire shall be woken,<br>a light from the shadows shall spring.”<cite>— J.R.R. Tolkien</cite></blockquote><section class="about-manifesto" id="manifesto"><span class="eyebrow">MANIFESTO</span><h2>${t("短期促进生产，<br>长期促进革命。", "Short-term, fueling production.<br>Long-term, fueling the revolution.")}</h2></section><div class="about-follow">${link("/now", t("现在关注什么", "What I’m exploring now") + " " + arrow)}${data.contact?.email ? link("mailto:" + data.contact.email, t("给我写信", "Write to me") + " " + arrow) : ""}</div><section class="profiles" id="elsewhere">${sectionTitle("", "在别处", "Elsewhere")}<div class="profile-list">${PROFILES.map(([name, handle, url]) => link(url, `<span>${profileIcon(name)}${name}</span><small>${esc(handle)}</small>${arrow}`)).join("")}</div></section><section class="collection" id="collection">${sectionTitle("", "收藏与学习", "Collection")}<div class="filter-bar">${[
    ["reading", "阅读", "Reading"],
    ["learning", "学习", "Learning"],
    ["community", "社区", "Community"],
  ]
    .map(
      ([id, z, e]) =>
        `<button data-collection="${id}" aria-pressed="${collectionFilter === id}">${t(z, e)}</button>`,
    )
    .join("")}</div><div class="badge-grid">${selected
    .slice(0, 18)
    .map(
      (x) =>
        `<a href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.image)}" alt="${esc(x.title)}" loading="lazy"><span>${esc(x.title)}</span></a>`,
    )
    .join("")}</div>${
    selected.length > 18
      ? `<details class="more-badges"><summary>${t("展开更多阅读记录", "Show more reading milestones")} <span>+</span></summary><div class="badge-grid">${selected
          .slice(18)
          .map(
            (x) =>
              `<a href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.image)}" alt="${esc(x.title)}" loading="lazy"><span>${esc(x.title)}</span></a>`,
          )
          .join("")}</div></details>`
      : ""
  }</section></div>`;
}
function toolsPage() {
  const tools = availableTools(data);
  const web = tools.filter(tool => tool.availability === "web");
  const install = tools.filter(tool => tool.availability === "install");
  return `<div class="page-wrap tools-page">${pageHead("03", "工具", "Tools", t("挑一件，拿去用。", "Find something useful."))}${web.length ? `<section class="tool-group"><div class="tool-group-heading"><h2>${t("直接在浏览器使用", "Use in your browser")}</h2><span>${t("打开即可", "READY TO OPEN")}</span></div><div class="tool-grid">${web.map(tool => toolCard(tool)).join("")}</div></section>` : ""}${install.length ? `<section class="tool-group"><div class="tool-group-heading"><h2>${t("装进你的工作环境", "Add to your workspace")}</h2><span>${t("按项目说明安装", "FOLLOW THE SETUP GUIDE")}</span></div><div class="tool-grid">${install.map(tool => toolCard(tool)).join("")}</div></section>` : ""}<aside class="work-foot"><span>${t("想看它们怎么做出来的？", "Curious how these were made?")}</span>${link("/projects", t("查看作品与实验", "Explore work & experiments") + " " + arrow)}</aside></div>`;
}
function nowPage() {
  const latest = articleSet()[0];
  const rows = data.projects.map((p, i) => `<a class="project-row" href="/projects/${p.id}" data-activity-row><span class="row-number">${String(i + 1).padStart(2, "0")}</span><div><h3>${esc(p.title)}</h3><p>${esc(desc(p))}</p><small class="activity-line" data-activity="${esc(p.url)}"></small></div><span class="project-type">${esc(p.tag)}</span>${arrow}</a>`).join("");
  return `<div class="page-wrap now-page">${pageHead("05", "现在", "Now")}<p class="now-updated">${t("更新于", "Updated")} <time id="now-date">${latest ? articlePublishedAt(latest) : ""}</time></p><p class="now-statement">AI scientist,<br>full stack<span>.</span></p><div class="now-direction"><span>From research to product, end to end.</span><span>Build intelligence. Test everything.</span></div>${sectionTitle("", "最近在动的", "Recently active")}<div class="project-list" id="now-projects">${rows}</div>${latest ? `${sectionTitle("", "最近写的", "Latest writing", link("/blog", t("全部文章", "All writing") + " " + arrow, "section-more"))}${articleSet().slice(0, 3).map((a, i) => articleRow(a, i)).join("")}` : ""}</div>`;
}
// Order the work by real activity once the public repositories answer.
async function settleNow() {
  const dates = (await fillActivity()).filter(Boolean);
  const list = $("#now-projects");
  if (!list?.isConnected) return;
  const rows = [...list.children].sort((a, b) => (b.dataset.date || "").localeCompare(a.dataset.date || ""));
  rows.forEach((row, i) => { list.append(row); row.querySelector(".row-number").textContent = String(i + 1).padStart(2, "0"); });
  const newest = [$("#now-date")?.textContent, ...dates].filter(Boolean).sort().pop();
  if (newest && $("#now-date")) $("#now-date").textContent = newest;
}
function notFound() {
  return `<div class="page-wrap">${pageHead("404", "这一页还没写下", "Nothing here yet")}${link("/", t("回到首页", "Back home") + " " + arrow, "primary-link")}</div>`;
}
function render(scroll = true) {
  cleanup();
  hero?.dispose();
  hero = null;
  const path = location.pathname.replace(/\/$/, "") || "/";
  if (path === "/blog") {
    const params = new URLSearchParams(location.search);
    searchTerm = params.get("q") || "";
    journalCategory = params.get("c") || "all";
    if (!articleSet().some((a) => a.category === journalCategory)) journalCategory = "all";
    journalSeries = params.get("series") || "";
    if (!articleSet().some((a) => a.series === journalSeries)) journalSeries = "";
    journalPage = Math.max(1, parseInt(params.get("page"), 10) || 1);
  }
  const routeArticle = data.articles.find((a) => path === "/blog/" + a.id);
  if (
    routeArticle &&
    findArticleTranslation(
      data.articles,
      routeArticle,
      routeArticle.lang === "zh" ? "en" : "zh",
    )
  ) {
    lang = routeArticle.lang;
    localStorage.setItem("wc-site-lang", lang);
  }
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
  document.body.dataset.page = path === "/" ? "home" : path.split("/")[1];
  header();
  let html =
    path === "/"
      ? home()
      : path === "/projects"
        ? projects()
        : path.startsWith("/projects/")
          ? projectDetail(path.split("/")[2])
          : path === "/blog"
            ? journal()
            : path.startsWith("/blog/")
              ? articleDetail(path.split("/")[2])
              : path === "/about"
                ? about()
                : path === "/tools"
                  ? toolsPage()
                  : path === "/now"
                    ? nowPage()
                    : notFound();
  $("#main").innerHTML = html;
  const h = $("#main h1");
  document.title =
    (h?.textContent.replace("✳", "").trim() || "十方空烬") + " · Ember";
  updatePageMetadata(path, routeArticle);
  const demoCleanup = mountDemos($("#main"));
  const observer = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          observer.unobserve(e.target);
        }
      }),
    { threshold: 0.07 },
  );
  document.querySelectorAll(".reveal").forEach((e) => observer.observe(e));
  cleanup = () => {
    if (typeof demoCleanup === "function") demoCleanup();
    observer.disconnect();
  };
  if ($("#hero-art")) {
    // The 3D layer is heavy and only the homepage uses it; the image shows meanwhile.
    const host = $("#hero-art");
    import("./hero-art.js").then(({ mountHero }) => {
      if (!host.isConnected) return;
      hero = mountHero(host, { image: "/static/city-art.png" });
      hero.setMode(light);
    });
    $("#art-mode").onclick = () => {
      light = light === "neon" ? "etch" : "neon";
      hero?.setMode(light);
      $("#art-mode").setAttribute("aria-pressed", light === "etch");
      $("#art-mode b").textContent =
        light === "neon" ? t("夜景", "NIGHT") : t("线描", "ETCH");
    };
  }
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        projectFilter = b.dataset.filter;
        render(false);
        document
          .querySelector('[data-filter="' + projectFilter + '"]')
          .focus({ preventScroll: true });
      }),
  );
  document.querySelectorAll("[data-collection]").forEach(
    (b) =>
      (b.onclick = () => {
        const y = scrollY;
        collectionFilter = b.dataset.collection;
        render(false);
        window.scrollTo(0, y);
        document
          .querySelector('[data-collection="' + collectionFilter + '"]')
          .focus({ preventScroll: true });
      }),
  );
  document.querySelectorAll("[data-category],[data-series]").forEach(b => b.onclick = () => {
    const key = b.dataset.series ? "series" : "category";
    journalSeries = b.dataset.series && journalSeries !== b.dataset.series ? b.dataset.series : "";
    if (key === "category") journalCategory = b.dataset.category;
    else journalCategory = "all";
    journalPage = 1;
    history.replaceState({}, "", journalUrl());
    render(false);
    document.querySelector(`[data-${key}="${CSS.escape(b.dataset[key])}"]`)?.focus({preventScroll: true});
  });
  if ($("#blog-query")) $("#blog-query").oninput = (e) => {
    searchTerm = e.target.value;
    journalPage = 1;
    history.replaceState({}, "", journalUrl());
    $("#article-list").innerHTML = journalResults();
    $(".blog-search>span").textContent = filteredArticles().length + " " + t("篇", "ARTICLES");
    bindJournalReset();
  };
  bindJournalReset();
  bindCopy(document);
  bindGlobal();
  if (path === "/now") settleNow();
  else if (path.startsWith("/projects/")) fillActivity();
  if (scroll) window.scrollTo({ top: 0, behavior: "instant" });
  if (location.hash) {
    requestAnimationFrame(() =>
      document
        .getElementById(decodeURIComponent(location.hash.slice(1)))
        ?.scrollIntoView(),
    );
  }
  $("#announcer").textContent = document.title;
  document.documentElement.classList.remove("booting");
}
function bindCopy(root) {
  root.querySelectorAll("[data-copy-url]").forEach(button => button.onclick = async () => {
    const status = button.parentElement.querySelector(".copy-status");
    try {
      await navigator.clipboard.writeText(button.dataset.copyUrl);
      status.textContent = t("链接已复制", "Link copied");
    } catch {
      const input = button.parentElement.querySelector(".copy-fallback");
      input.hidden = false;
      input.focus();
      input.select();
      status.textContent = t("请选择并复制下方链接", "Select and copy the link below");
    }
  });
}
function updatePageMetadata(path, article) {
  const canonical = article?.url || "https://widechaos.cn" + (path === "/" ? "/" : path);
  let canonicalLink = document.head.querySelector('link[rel="canonical"]');
  if (!canonicalLink) { canonicalLink = document.createElement("link"); canonicalLink.rel = "canonical"; document.head.append(canonicalLink); }
  canonicalLink.href = canonical;
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(node => node.remove());
  if (article) {
    for (const language of ["zh", "en"]) {
      const version = findArticleTranslation(data.articles, article, language);
      if (!version) continue;
      const link = document.createElement("link"); link.rel = "alternate"; link.hreflang = language === "zh" ? "zh-CN" : "en"; link.href = version.url; document.head.append(link);
    }
  }
  const description = article ? summary(article) : t("十方空烬 · Ember。作品、文字与持续的探索。", "Ember · 十方空烬. Work, writing and ongoing exploration.");
  for (const [key, value] of [["description", description], ["og:title", document.title], ["og:description", description], ["og:url", canonical]]) {
    const attribute = key.startsWith("og:") ? "property" : "name";
    let meta = document.head.querySelector(`meta[${attribute}="${key}"]`);
    if (!meta) { meta = document.createElement("meta"); meta.setAttribute(attribute, key); document.head.append(meta); }
    meta.content = value;
  }
}
function bindJournalReset() {
  document.querySelectorAll("[data-reset-journal]").forEach(button => button.onclick = () => {
    searchTerm = "";
    journalCategory = "all";
    journalSeries = "";
    journalPage = 1;
    history.replaceState({}, "", "/blog");
    render(false);
    $("#blog-query")?.focus({preventScroll: true});
  });
}
function bindGlobal() {
  document
    .querySelectorAll("[data-top]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          window.scrollTo({
            top: 0,
            behavior: motion === "off" ? "instant" : "smooth",
          })),
    );
}
function navigate(url, replace = false) {
  const run = () => {
    history[replace ? "replaceState" : "pushState"]({}, "", url);
    render();
    $("#main").focus({ preventScroll: true });
  };
  run();
}
function openFeed() {
  $("#rss-content").innerHTML = `<h2 id="rss-title">${t("用 RSS 订阅十方志", "Follow the journal with RSS")}</h2><p>${t("把下面的地址加进任意 RSS 阅读器（Folo、Feedly、Inoreader、NetNewsWire 等），新文章会自动送到那里。", "Add this address to any feed reader (Folo, Feedly, Inoreader, NetNewsWire…) and new writing arrives there.")}</p><div class="feed-copy"><input value="${FEED}" readonly aria-label="${t("订阅地址", "Feed address")}"><button type="button" data-copy-url="${FEED}">${t("复制地址", "Copy")}</button><span class="copy-status" role="status"></span><input class="copy-fallback" value="${FEED}" readonly hidden></div><a class="feed-raw" href="${FEED}" target="_blank" rel="noopener">${t("查看原始订阅文件", "View the raw feed")} ${arrow}</a>`;
  bindCopy($("#rss-content"));
  $("#rss-dialog").showModal();
}
document.addEventListener("click", (e) => {
  const feed = e.target.closest("a[data-rss]");
  if (feed && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
    e.preventDefault();
    openFeed();
    return;
  }
  const a = e.target.closest("a");
  if (
    !a ||
    a.target ||
    e.metaKey ||
    e.ctrlKey ||
    e.altKey ||
    e.shiftKey ||
    e.button !== 0
  )
    return;
  const u = new URL(a.href, location.href);
  if (u.origin !== location.origin) return;
  if (u.pathname === location.pathname && u.hash) return;
  e.preventDefault();
  navigate(u.pathname + u.search + u.hash);
});
window.addEventListener("popstate", () => render());
window.addEventListener(
  "scroll",
  () => {
    const r = document.documentElement;
    const progress = scrollY / Math.max(1, r.scrollHeight - innerHeight);
    $(".reading-progress").style.transform = `scaleX(${progress})`;
    $("#header").classList.toggle("scrolled", scrollY > 20);
  },
  { passive: true },
);
function searchResults(q = "") {
  const query = q.trim().toLowerCase();
  const hits = [
    ...data.projects.map((p) => ({
      title: p.title,
      sub: desc(p),
      url: "/projects/" + p.id,
      type: t("作品", "WORK"),
    })),
    ...articleSet().map((a) => ({
      title: a.title,
      sub: articleDate(a) + " · " + summary(a),
      url: "/blog/" + a.id,
      type: t("文章", "JOURNAL"),
    })),
    ...availableTools(data).map(tool => ({title: toolName(tool), sub: desc(tool), url: "/tools#tool-" + tool.id, type: t("工具", "TOOLS")})),
  ].filter((x) => (x.title + " " + x.sub).toLowerCase().includes(query));
  $("#search-results").innerHTML = hits.length
    ? hits
        .map(
          (x) =>
            `<a href="${x.url}"><small>${x.type}</small><strong>${esc(x.title)}</strong>${arrow}</a>`,
        )
        .join("")
    : `<p class="empty-state">${t("没有匹配内容", "No matches")}</p>`;
  $("#search-results")
    .querySelectorAll("a")
    .forEach((a) =>
      a.addEventListener("click", () => {
        searchNavigating = true;
        $("#search-dialog").close();
      }),
    );
}
function openSearch() {
  $("#search-label").textContent = t(
    "搜索作品、文章和工具",
    "Search work, writing & tools",
  );
  $("#global-search").value = "";
  searchResults();
  $("#search-dialog").showModal();
  $("#global-search").focus();
}
$("#global-search").oninput = (e) => searchResults(e.target.value);
$("#search-dialog").addEventListener("click", (e) => {
  if (e.target === $("#search-dialog")) $("#search-dialog").close();
});
$("#search-dialog").addEventListener("close", () => {
  if (!searchNavigating) $("#search-open")?.focus({ preventScroll: true });
  searchNavigating = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("#search-dialog").open) {
    e.preventDefault();
    $("#search-dialog").close();
    return;
  }
  if (
    e.key === "/" &&
    !e.metaKey &&
    !e.ctrlKey &&
    !document.activeElement.isContentEditable &&
    !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)
  ) {
    e.preventDefault();
    openSearch();
  }
});
render();
