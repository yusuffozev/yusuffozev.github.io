import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const contentDir = path.join(root, "content", "posts");
const templatePath = path.join(root, "templates", "post.html");
const postsOutRoot = path.join(root, "posts");
const categoriesPath = path.join(root, "data", "categories.json");
const postsJsonPath = path.join(root, "data", "posts.json");
const kategorilerRoot = path.join(root, "kategoriler");
const distDir = path.join(root, "dist");

const SITE_ORIGIN = "https://yusufozev.com.tr";

const PUBLISH_ENTRIES = [
  "index.html",
  "yazilar.html",
  "projeler.html",
  "hakkimda.html",
  "iletisim.html",
  "404.html",
  "CNAME",
  "favicon.svg",
  "styles.css",
  "script.js",
  "robots.txt",
  "sitemap.xml",
  "data",
  "images",
  "kategoriler",
  "posts",
  "projects",
  ".nojekyll"
];

const SKIP_FROM_DIST = new Set([
  "admin",
  "content",
  "templates",
  "scripts",
  "node_modules",
  "dist",
  ".git",
  ".github"
]);

marked.setOptions({ gfm: true, breaks: false });

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(value) {
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value ?? "").slice(0, 10);
}

function absoluteUrl(pathname = "/") {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_ORIGIN}${path}`;
}

function applyTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key === "content" || key === "jsonLd") return data[key] ?? "";
    return escapeHtml(data[key] ?? "");
  });
}

function pageShell({ title, description, bodyAttrs, mainHtml, canonicalPath = "/", ogImage = "/images/logo.svg" }) {
  const canonical = absoluteUrl(canonicalPath);
  const image = absoluteUrl(ogImage);
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <link rel="stylesheet" href="/styles.css">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:site_name" content="Yusuf Özev">
  <meta property="og:locale" content="tr_TR">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:title" content="${escapeHtml(title)} | Yusuf Özev">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)} | Yusuf Özev">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <title>${escapeHtml(title)} | Yusuf Özev</title>
</head>
<body${bodyAttrs ? ` ${bodyAttrs}` : ""}>
  <header class="site-header">
    <div class="container nav-container">
      <a class="brand" href="/">
        <img class="brand-icon" src="/images/logo.svg" alt="YO" width="36" height="36">
        <span class="brand-text">Yusuf Özev</span>
      </a>
      <button class="mobile-menu-button" aria-label="Menüyü aç/kapat">☰</button>
      <nav class="main-nav" id="mainNav"><a class="nav-link" href="/">Ana Sayfa</a></nav>
      <div class="header-actions"><a class="contact-button" href="/iletisim.html">İletişim</a></div>
    </div>
  </header>
  <main>${mainHtml}</main>
  <footer class="site-footer">
    <div class="container footer-inner">
      <p>© 2026. Tüm hakları saklıdır.</p>
      <div class="footer-links">
        <a href="https://github.com/yusuffozev" target="_blank" rel="noopener">GitHub</a>
        <a href="#" target="_blank" rel="noopener">LinkedIn</a>
        <a href="mailto:info@yusufozev.com.tr">Mail</a>
      </div>
    </div>
  </footer>
  <script src="/script.js"></script>
</body>
</html>
`;
}

async function ensureEmptyDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function copyPath(src, dest) {
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src);
    for (const entry of entries) {
      if (SKIP_FROM_DIST.has(entry)) continue;
      await copyPath(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(src, dest);
}

async function buildPosts() {
  const template = await fs.readFile(templatePath, "utf8");
  await fs.rm(postsOutRoot, { recursive: true, force: true });
  await fs.mkdir(postsOutRoot, { recursive: true });

  let files = [];
  try {
    files = (await fs.readdir(contentDir)).filter((f) => f.endsWith(".md"));
  } catch {
    files = [];
  }

  const posts = [];

  for (const file of files) {
    const slug = file.replace(/\.md$/i, "");
    const raw = await fs.readFile(path.join(contentDir, file), "utf8");
    const { data, content } = matter(raw);

    const required = ["title", "description", "date", "category", "categorySlug", "subcategory", "subcategorySlug"];
    for (const key of required) {
      if (!data[key]) throw new Error(`${file}: eksik alan → ${key}`);
    }

    const readTime = data.readTime || "5 dk";
    const image = data.image || "/images/logo.svg";
    const url = `posts/${data.categorySlug}/${data.subcategorySlug}/${slug}.html`;
    const htmlBody = marked.parse(content.trim());
    const date = formatDate(data.date);

    const canonical = absoluteUrl(`/${url}`);
    const ogImage = absoluteUrl(image);
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: data.title,
      description: data.description,
      datePublished: date,
      dateModified: date,
      image: [ogImage],
      author: { "@type": "Person", name: "Yusuf Özev", url: SITE_ORIGIN },
      publisher: {
        "@type": "Person",
        name: "Yusuf Özev",
        url: SITE_ORIGIN
      },
      mainEntityOfPage: canonical,
      inLanguage: "tr-TR",
      articleSection: `${data.category} / ${data.subcategory}`
    });

    const html = applyTemplate(template, {
      title: data.title,
      description: data.description,
      date,
      readTime,
      category: data.category,
      subcategory: data.subcategory,
      image,
      canonical,
      ogImage,
      jsonLd,
      content: htmlBody
    });

    const outFile = path.join(postsOutRoot, data.categorySlug, data.subcategorySlug, `${slug}.html`);
    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.writeFile(outFile, html, "utf8");

    const createdAt = data.createdAt
      ? String(data.createdAt)
      : `${date}T00:00:00.000Z`;

    posts.push({
      title: data.title,
      category: data.category,
      categorySlug: data.categorySlug,
      subcategory: data.subcategory,
      subcategorySlug: data.subcategorySlug,
      description: data.description,
      date,
      createdAt,
      readTime,
      cover: data.categorySlug,
      image,
      url
    });
  }

  // JSON'da en yeni üstte (ana sayfa için); kategori sayfaları createdAt ile eskiden yeniye dizer
  posts.sort((a, b) => {
    const byDate = new Date(b.date) - new Date(a.date);
    if (byDate !== 0) return byDate;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  await fs.mkdir(path.dirname(postsJsonPath), { recursive: true });
  await fs.writeFile(postsJsonPath, JSON.stringify(posts, null, 2) + "\n", "utf8");
  console.log(`Built ${posts.length} post(s).`);
}

async function buildCategories() {
  const categories = JSON.parse(await fs.readFile(categoriesPath, "utf8"));
  await ensureEmptyDir(kategorilerRoot);

  for (const category of categories.sort((a, b) => (a.order || 0) - (b.order || 0))) {
    const catDir = path.join(kategorilerRoot, category.slug);
    await fs.mkdir(catDir, { recursive: true });

    const children = category.children || [];
    const cards = children.length
      ? children
          .map((child) => {
            const image = child.image || category.image || "/images/logo.svg";
            return `<a class="category-card category-image-card" href="/kategoriler/${category.slug}/${child.slug}/">
  <div class="category-cover"><img src="${escapeHtml(image)}" alt="${escapeHtml(child.title)}" loading="lazy"></div>
  <div class="category-card-body"><span>${escapeHtml(category.title)}</span><h3>${escapeHtml(child.title)}</h3></div>
</a>`;
          })
          .join("")
      : `<div class="empty-state"><p>Bu kategoride henüz alt kategori yok. Panelden alt kategori ekleyebilirsin.</p></div>`;

    const categoryHtml = pageShell({
      title: category.title,
      description: `${category.title} kategorisi: yazılar ve alt konular.`,
      bodyAttrs: `data-category="${escapeHtml(category.slug)}"`,
      canonicalPath: `/kategoriler/${category.slug}/`,
      ogImage: category.image || "/images/logo.svg",
      mainHtml: `<section class="section page-top"><div class="container"><div class="page-header"><div class="page-kicker">Kategori</div><h1>${escapeHtml(category.title)}</h1></div><div class="category-grid">${cards}</div></div></section>`
    });
    await fs.writeFile(path.join(catDir, "index.html"), categoryHtml, "utf8");

    for (const child of children) {
      const childDir = path.join(catDir, child.slug);
      await fs.mkdir(childDir, { recursive: true });
      const childHtml = pageShell({
        title: child.title,
        description: `${category.title} kategorisinde ${child.title} yazıları.`,
        bodyAttrs: `data-category="${escapeHtml(category.slug)}" data-subcategory="${escapeHtml(child.slug)}"`,
        canonicalPath: `/kategoriler/${category.slug}/${child.slug}/`,
        ogImage: child.image || category.image || "/images/logo.svg",
        mainHtml: `<section class="section page-top"><div class="container"><div class="page-header"><div class="page-kicker">${escapeHtml(category.title)} / ${escapeHtml(child.title)}</div><h1>${escapeHtml(child.title)}</h1><p>Bu konudaki yazılar aşağıda listelenir.</p></div><div class="post-grid" id="categoryPosts" data-category="${escapeHtml(category.slug)}" data-subcategory="${escapeHtml(child.slug)}"></div></div></section>`
      });
      await fs.writeFile(path.join(childDir, "index.html"), childHtml, "utf8");
    }
  }

  console.log(`Built ${categories.length} categor(y/ies).`);
}

async function buildSeo() {
  const posts = JSON.parse(await fs.readFile(postsJsonPath, "utf8").catch(() => "[]"));
  const categories = JSON.parse(await fs.readFile(categoriesPath, "utf8").catch(() => "[]"));

  const urls = [
    { loc: absoluteUrl("/"), priority: "1.0", changefreq: "weekly" },
    { loc: absoluteUrl("/yazilar.html"), priority: "0.9", changefreq: "weekly" },
    { loc: absoluteUrl("/projeler.html"), priority: "0.6", changefreq: "monthly" },
    { loc: absoluteUrl("/hakkimda.html"), priority: "0.5", changefreq: "monthly" },
    { loc: absoluteUrl("/iletisim.html"), priority: "0.4", changefreq: "yearly" }
  ];

  for (const category of categories) {
    urls.push({
      loc: absoluteUrl(`/kategoriler/${category.slug}/`),
      priority: "0.7",
      changefreq: "weekly"
    });
    for (const child of category.children || []) {
      urls.push({
        loc: absoluteUrl(`/kategoriler/${category.slug}/${child.slug}/`),
        priority: "0.7",
        changefreq: "weekly"
      });
    }
  }

  for (const post of posts) {
    urls.push({
      loc: absoluteUrl(`/${post.url}`),
      priority: "0.8",
      changefreq: "monthly",
      lastmod: post.date || undefined
    });
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  const robots = `User-agent: *
Allow: /

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;

  await fs.writeFile(path.join(root, "sitemap.xml"), sitemap, "utf8");
  await fs.writeFile(path.join(root, "robots.txt"), robots, "utf8");
  console.log(`SEO: sitemap (${urls.length} URL) + robots.txt`);
}

async function prepareDist() {
  await ensureEmptyDir(distDir);
  await fs.writeFile(path.join(distDir, ".nojekyll"), "", "utf8");

  for (const entry of PUBLISH_ENTRIES) {
    if (entry === ".nojekyll") continue;
    const src = path.join(root, entry);
    try {
      await fs.access(src);
    } catch {
      continue;
    }
    await copyPath(src, path.join(distDir, entry));
  }

  console.log(`Dist ready at ${distDir}.`);
}

async function buildAll() {
  await buildPosts();
  await buildCategories();
  await buildSeo();
  await prepareDist();
}

const mode = process.argv[2] || "all";
if (mode === "posts") {
  await buildPosts();
  await buildSeo();
} else if (mode === "categories") {
  await buildCategories();
  await buildSeo();
} else if (mode === "dist") {
  await buildPosts();
  await buildCategories();
  await buildSeo();
  await prepareDist();
} else {
  await buildAll();
}
