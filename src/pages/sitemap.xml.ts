import { getCollection } from "astro:content";

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET(context: { site: URL }) {
  const site = context.site;
  const staticPaths = [
    "/",
    "/blog",
    "/archive",
    "/tags",
    "/about",
    "/projects",
    "/contact",
    "/feed.xml",
  ];

  const posts = await getCollection("blog");
  const postPaths = posts
    .filter((post) => !post.data.draft)
    .map((post) => ({
      path: `/blog/${post.slug}`,
      lastmod: post.data.updatedDate ?? post.data.pubDate,
    }));

  const urls: { loc: string; lastmod?: Date }[] = [
    ...staticPaths.map((p) => ({ loc: new URL(p, site).toString() })),
    ...postPaths.map((p) => ({
      loc: new URL(p.path, site).toString(),
      lastmod: p.lastmod,
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map((u) => {
        const lastmod = u.lastmod ? `<lastmod>${u.lastmod.toISOString()}</lastmod>` : "";
        return `  <url><loc>${escapeXml(u.loc)}</loc>${lastmod}</url>`;
      })
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}

