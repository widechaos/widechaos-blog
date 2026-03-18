import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE_CONFIG } from "../config/site";

export async function GET(context: { site: URL }) {
  const posts = await getCollection("blog", ({ data }) => !data.draft);

  return rss({
    title: SITE_CONFIG.title,
    description: SITE_CONFIG.description,
    site: context.site,
    items: posts
      .sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime())
      .map((post) => ({
        title: post.data.title,
        description: post.data.description,
        link: `/blog/${post.slug}/`,
        pubDate: post.data.pubDate,
      })),
  });
}
