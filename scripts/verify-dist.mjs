import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve(process.cwd(), "dist");

async function listHtmlFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) return listHtmlFiles(abs);
      if (entry.isFile() && entry.name.endsWith(".html")) return [abs];
      return [];
    })
  );
  return files.flat();
}

function has(html, re) {
  return re.test(html);
}

function is404File(filePath) {
  const rel = path.relative(DIST_DIR, filePath).replaceAll(path.sep, "/");
  return rel === "404.html" || rel.endsWith("/404/index.html");
}

function checkCommonMeta({ html, filePath }) {
  const missing = [];
  if (!has(html, /<title>[^<]+<\/title>/i)) missing.push("title");
  if (!has(html, /<meta\s+name=["']description["'][^>]*content=["'][^"']+["'][^>]*>/i)) {
    missing.push("meta:description");
  }
  if (!has(html, /<link\s+rel=["']canonical["'][^>]*href=["']https?:\/\/[^"']+["'][^>]*>/i)) {
    missing.push("link:canonical");
  }
  if (!has(html, /<meta\s+property=["']og:title["'][^>]*content=["'][^"']+["'][^>]*>/i)) {
    missing.push("meta:og:title");
  }
  if (!has(html, /<meta\s+property=["']og:description["'][^>]*content=["'][^"']+["'][^>]*>/i)) {
    missing.push("meta:og:description");
  }
  if (!has(html, /<meta\s+property=["']twitter:card["'][^>]*content=["'][^"']+["'][^>]*>/i)) {
    missing.push("meta:twitter:card");
  }

  if (missing.length) {
    throw new Error(
      `SEO meta missing in ${filePath}:\n- ${missing.join("\n- ")}`
    );
  }
}

function checkNoindex404({ html, filePath }) {
  if (!has(html, /<meta\s+name=["']robots["'][^>]*content=["'][^"']*noindex[^"']*["'][^>]*>/i)) {
    throw new Error(`404 noindex missing in ${filePath}`);
  }
}

async function main() {
  const htmlFiles = await listHtmlFiles(DIST_DIR);
  if (htmlFiles.length === 0) {
    throw new Error(`No HTML files found under ${DIST_DIR}`);
  }

  const sampleFiles = [
    path.join(DIST_DIR, "index.html"),
    path.join(DIST_DIR, "blog", "index.html"),
    path.join(DIST_DIR, "about", "index.html"),
    path.join(DIST_DIR, "projects", "index.html"),
    path.join(DIST_DIR, "tags", "index.html"),
    path.join(DIST_DIR, "archive", "index.html"),
  ];

  const existingSamples = [];
  for (const f of sampleFiles) {
    try {
      await fs.access(f);
      existingSamples.push(f);
    } catch {
      continue;
    }
  }

  const toCheck = new Set(existingSamples);
  const anyBlogPost = htmlFiles.find((p) => p.includes(`${path.sep}blog${path.sep}`) && p.endsWith(`${path.sep}index.html`) && !p.endsWith(`${path.sep}blog${path.sep}index.html`));
  if (anyBlogPost) toCheck.add(anyBlogPost);

  for (const filePath of toCheck) {
    const html = await fs.readFile(filePath, "utf8");
    checkCommonMeta({ html, filePath });
    if (is404File(filePath)) checkNoindex404({ html, filePath });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
