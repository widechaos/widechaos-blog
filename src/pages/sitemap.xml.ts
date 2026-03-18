import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

function toISODate(date: Date) {
  return date.toISOString().split("T")[0];
}

export const GET: APIRoute = async ({ site }) => {
  if (!site) {
    return new Response("Missing site config", { status: 500 });
  }

  const staticPaths = ["/", "/blog", "/archive", "/tags", "/about", "/proyectos", "/contact", "/rss.xml"];

  const posts = await getCollection("blog", ({ data }) => !data.draft);
  const postUrls = posts.map((p) => ({
    path: `/blog/${p.slug}/`,
    lastmod: p.data.updatedDate ?? p.data.pubDate,
  }));

  const urls = [
    ...staticPaths.map((path) => ({ path, lastmod: undefined as Date | undefined })),
    ...postUrls,
  ];

  const body =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls
      .map(({ path, lastmod }) => {
        const loc = new URL(path, site).href;
        const lastmodTag = lastmod ? `<lastmod>${toISODate(lastmod)}</lastmod>` : "";
        return `<url><loc>${loc}</loc>${lastmodTag}</url>`;
      })
      .join("") +
    `</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
