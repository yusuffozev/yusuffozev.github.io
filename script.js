const DATA_PATHS = {
  categories: "/data/categories.json",
  posts: "/data/posts.json",
  projects: "/data/projects.json",
  comments: "/data/comments.json"
};

const COMMENT_INBOX = "https://crudcrud.com/api/1d7c5020f32c4230b2a972247cd8842c/comments";

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} yüklenemedi`);
  return response.json();
}

function postCreatedMs(post) {
  if (post.createdAt) {
    const t = new Date(post.createdAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const d = new Date(post.date).getTime();
  return Number.isNaN(d) ? 0 : d;
}

/** Ana sayfa / tüm yazılar: en yeni üstte */
function sortPostsNewest(posts) {
  return [...posts].sort((a, b) => {
    const byDate = new Date(b.date) - new Date(a.date);
    if (byDate !== 0) return byDate;
    return postCreatedMs(b) - postCreatedMs(a);
  });
}

/** Kategori sayfaları: ilk eklenen solda/üstte (ekleme sırası) */
function sortPostsOldest(posts) {
  return [...posts].sort((a, b) => {
    const byCreated = postCreatedMs(a) - postCreatedMs(b);
    if (byCreated !== 0) return byCreated;
    return String(a.title || "").localeCompare(String(b.title || ""), "tr");
  });
}

function createPostCard(post) {
  const a = document.createElement("a");
  a.className = post.pinned ? "post-card post-card-pinned" : "post-card";
  a.href = "/" + post.url.replace(/^\/+/, "");
  a.innerHTML = `
    ${post.pinned ? '<span class="pinned-badge">📌 Öne Çıkan</span>' : ""}
    <div class="post-cover post-cover-image">
      <img src="${post.image}" alt="${post.title}" loading="lazy">
    </div>
    <div class="post-body">
      <div class="post-category">${post.category} / ${post.subcategory || "Genel"}</div>
      <h3>${post.title}</h3>
      <p>${post.description}</p>
    </div>
    <div class="post-footer">
      <span>${post.date}</span>
      <span>${post.readTime}</span>
    </div>
  `;
  return a;
}

function createProjectCard(project) {
  const a = document.createElement("a");
  a.className = "project-card";
  a.href = "/" + project.url.replace(/^\/+/, "");
  const tags = (project.tags || []).map(t => `<span class="tag">${t}</span>`).join("");
  a.innerHTML = `
    <h3>${project.title}</h3>
    <p>${project.description}</p>
    <div class="tag-row">${tags}</div>
  `;
  return a;
}

function createNavDropdown(category) {
  const wrapper = document.createElement("div");
  wrapper.className = "nav-dropdown";

  const mainLink = document.createElement("a");
  mainLink.className = "nav-main-link";
  mainLink.href = `/kategoriler/${category.slug}/`;
  mainLink.innerHTML = `<span>${category.title}</span>${category.children?.length ? '<span class="nav-arrow">▾</span>' : ""}`;
  wrapper.appendChild(mainLink);

  if (category.children && category.children.length) {
    const menu = document.createElement("div");
    menu.className = "nav-menu";

    category.children.forEach(child => {
      const childLink = document.createElement("a");
      childLink.href = `/kategoriler/${category.slug}/${child.slug}/`;
      childLink.textContent = child.title;
      menu.appendChild(childLink);
    });

    wrapper.appendChild(menu);
  }

  return wrapper;
}

async function renderNav() {
  const nav = document.getElementById("mainNav");
  if (!nav || nav.dataset.rendered === "true") return;

  const categories = await fetchJson(DATA_PATHS.categories);
  categories
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach(category => nav.appendChild(createNavDropdown(category)));

  const projects = document.createElement("a");
  projects.className = "nav-link";
  projects.href = "/projeler.html";
  projects.textContent = "Projeler";
  nav.appendChild(projects);

  const about = document.createElement("a");
  about.className = "nav-link";
  about.href = "/hakkimda.html";
  about.textContent = "Hakkımda";
  nav.appendChild(about);

  nav.dataset.rendered = "true";
}

async function renderHome() {
  const container = document.getElementById("homePosts");
  if (!container) return;
  const posts = sortPostsNewest(await fetchJson(DATA_PATHS.posts));
  container.innerHTML = "";
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state"><p>Henüz yazı eklenmedi.</p></div>`;
    return;
  }
  posts.slice(0, 6).forEach(post => container.appendChild(createPostCard(post)));
}

function renderPostList(container, posts, emptyText = "Aramana uygun yazı bulunamadı.") {
  container.innerHTML = "";
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state"><p>${emptyText}</p></div>`;
    return;
  }
  posts.forEach(post => container.appendChild(createPostCard(post)));
}

async function renderAllPosts() {
  const container = document.getElementById("allPosts");
  if (!container) return;

  const posts = sortPostsNewest(await fetchJson(DATA_PATHS.posts));
  const input = document.getElementById("postSearchInput");

  renderPostList(container, posts);

  if (input) {
    input.addEventListener("input", () => {
      const q = input.value.trim().toLocaleLowerCase("tr-TR");
      const filtered = posts.filter(post =>
        post.title.toLocaleLowerCase("tr-TR").includes(q) ||
        post.description.toLocaleLowerCase("tr-TR").includes(q) ||
        post.category.toLocaleLowerCase("tr-TR").includes(q) ||
        (post.subcategory || "").toLocaleLowerCase("tr-TR").includes(q)
      );
      renderPostList(container, filtered);
    });
  }
}

async function renderCategoryPosts() {
  const container = document.getElementById("categoryPosts");
  if (!container) return;

  const categorySlug = container.dataset.category || document.body.dataset.category || "";
  const subcategorySlug = container.dataset.subcategory || document.body.dataset.subcategory || "";

  const posts = sortPostsOldest(await fetchJson(DATA_PATHS.posts));
  const filtered = posts.filter(post => {
    const categoryMatch = !categorySlug || post.categorySlug === categorySlug;
    const subcategoryMatch = !subcategorySlug || post.subcategorySlug === subcategorySlug;
    return categoryMatch && subcategoryMatch;
  });

  renderPostList(container, filtered, "Bu konuda henüz yazı yok.");
}

async function renderProjects() {
  const container = document.getElementById("projectsGrid");
  if (!container) return;
  const projects = await fetchJson(DATA_PATHS.projects);
  container.innerHTML = "";
  if (!projects.length) {
    container.innerHTML = `<div class="empty-state"><p>Henüz proje eklenmedi.</p></div>`;
    return;
  }
  projects.forEach(project => container.appendChild(createProjectCard(project)));
}

function setupMobileMenu() {
  const button = document.querySelector(".mobile-menu-button");
  const nav = document.getElementById("mainNav");
  if (!button || !nav) return;
  button.addEventListener("click", () => nav.classList.toggle("open"));
}

function slugifyHeading(text) {
  return String(text || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "baslik";
}

function setupArticleToc() {
  const content = document.getElementById("articleContent");
  const toc = document.getElementById("articleToc");
  const tocList = document.getElementById("articleTocList");
  const tocMobile = document.getElementById("articleTocMobile");
  if (!content || !toc || !tocList) return;

  const headings = [...content.querySelectorAll("h2, h3")];
  if (headings.length < 2) return;

  const used = new Map();
  const items = headings.map((heading) => {
    const text = heading.textContent.trim();
    let id = heading.id || slugifyHeading(text);
    const count = used.get(id) || 0;
    used.set(id, count + 1);
    if (count > 0) id = `${id}-${count + 1}`;
    heading.id = id;
    return { id, text, level: heading.tagName.toLowerCase() };
  });

  tocList.innerHTML = items.map((item) => `
    <li class="toc-${item.level}">
      <a href="#${item.id}">${item.text}</a>
    </li>
  `).join("");
  toc.hidden = false;

  if (tocMobile) {
    tocMobile.innerHTML = `
      <details class="article-toc-details">
        <summary>Bu yazıda</summary>
        <ol class="article-toc-list">${tocList.innerHTML}</ol>
      </details>
    `;
    tocMobile.hidden = false;
  }

  const links = [
    ...tocList.querySelectorAll("a"),
    ...(tocMobile ? tocMobile.querySelectorAll("a") : [])
  ];

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.getElementById(link.getAttribute("href").slice(1));
      if (!target) return;
      event.preventDefault();
      const top = target.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top, behavior: "smooth" });
      history.replaceState(null, "", link.getAttribute("href"));
    });
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const id = entry.target.id;
      [...tocList.querySelectorAll("a")].forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === `#${id}`);
      });
    });
  }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });

  headings.forEach((heading) => observer.observe(heading));
}

function pageKey() {
  let path = decodeURIComponent(location.pathname).replace(/^\/+/, "");
  if (path.endsWith("/")) path += "index.html";
  return path;
}

function commentRoot() {
  const existing = document.getElementById("postComments");
  if (existing) return existing;
  const article = document.getElementById("articleContent");
  if (!article) return null;
  const root = document.createElement("section");
  root.id = "postComments";
  root.className = "post-comments";
  root.setAttribute("aria-label", "Yorumlar");
  const back = article.parentElement?.querySelector(".back-link");
  if (back) back.before(root);
  else article.after(root);
  return root;
}

function commentCard(comment) {
  const card = document.createElement("article");
  card.className = "comment-card";

  const user = document.createElement("div");
  user.className = "comment-user";
  const avatar = document.createElement("div");
  avatar.className = "comment-avatar";
  avatar.textContent = (comment.username || "?").trim().charAt(0).toLocaleUpperCase("tr-TR");
  const meta = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = comment.username || "Ziyaretçi";
  const time = document.createElement("time");
  if (comment.createdAt) {
    time.dateTime = comment.createdAt;
    time.textContent = new Date(comment.createdAt).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }
  meta.append(name, time);
  user.append(avatar, meta);

  const body = document.createElement("p");
  body.className = "comment-body";
  body.textContent = comment.body || "";
  card.append(user, body);

  if (comment.reply) {
    const reply = document.createElement("div");
    reply.className = "comment-reply";
    const label = document.createElement("span");
    label.textContent = "Yusuf Özev";
    const text = document.createElement("p");
    text.textContent = comment.reply;
    reply.append(label, text);
    card.append(reply);
  }
  return card;
}

async function setupComments() {
  const root = commentRoot();
  if (!root) return;

  const key = pageKey();
  let comments = [];
  try {
    const all = await fetchJson(DATA_PATHS.comments);
    comments = (Array.isArray(all) ? all : [])
      .filter((item) => item.postUrl === key)
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  } catch {
    comments = [];
  }

  const heading = document.createElement("h2");
  heading.textContent = "Yorumlar";
  const lead = document.createElement("p");
  lead.className = "comment-lead";
  lead.textContent = "Yorum onaylandıktan sonra yayınlanır.";

  const list = document.createElement("div");
  list.className = "comment-list";
  if (!comments.length) {
    const empty = document.createElement("p");
    empty.className = "comment-empty";
    empty.textContent = "Henüz yorum yok.";
    list.append(empty);
  } else {
    comments.forEach((comment) => list.append(commentCard(comment)));
  }

  const form = document.createElement("form");
  form.className = "comment-form";
  const honey = document.createElement("input");
  honey.className = "comment-honey";
  honey.type = "text";
  honey.name = "_honey";
  honey.tabIndex = -1;
  honey.autocomplete = "off";
  honey.setAttribute("aria-hidden", "true");

  const nameLabel = document.createElement("label");
  nameLabel.append("Ad");
  const nameInput = document.createElement("input");
  nameInput.name = "Ad";
  nameInput.required = true;
  nameInput.minLength = 2;
  nameInput.maxLength = 32;
  nameInput.autocomplete = "name";
  nameInput.placeholder = "Adın";
  nameLabel.append(nameInput);

  const bodyLabel = document.createElement("label");
  bodyLabel.append("Yorum");
  const bodyInput = document.createElement("textarea");
  bodyInput.name = "Yorum";
  bodyInput.required = true;
  bodyInput.minLength = 2;
  bodyInput.maxLength = 2000;
  bodyInput.placeholder = "Yorumunu yaz";
  bodyLabel.append(bodyInput);

  const button = document.createElement("button");
  button.type = "submit";
  button.textContent = "Yorumu gönder";
  const status = document.createElement("p");
  status.className = "comment-status";
  form.append(honey, nameLabel, bodyLabel, button, status);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "";
    if (honey.value) return;

    const username = nameInput.value.replace(/\s+/g, " ").trim();
    const body = bodyInput.value.replace(/\r\n/g, "\n").trim();
    if (username.length < 2 || username.length > 32) {
      status.textContent = "Ad 2–32 karakter olmalı.";
      return;
    }
    if (!/^[\p{L}\p{N} ._'-]+$/u.test(username)) {
      status.textContent = "Ad sadece harf, rakam ve boşluk içerebilir.";
      return;
    }
    if (body.length < 2 || body.length > 2000) {
      status.textContent = "Yorum 2–2000 karakter olmalı.";
      return;
    }
    if (/[<>]/.test(body)) {
      status.textContent = "Yorum HTML içeremez.";
      return;
    }

    button.disabled = true;
    try {
      const response = await fetch(COMMENT_INBOX, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postUrl: key,
          username,
          body,
          createdAt: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error("save failed");
      form.reset();
      status.textContent = "Yorumun alındı. Onaylandıktan sonra burada görünecek.";
    } catch {
      status.textContent = "Yorum gönderilemedi. Biraz sonra tekrar dene.";
    } finally {
      button.disabled = false;
    }
  });

  root.replaceChildren(heading, lead, list, form);
}

document.addEventListener("DOMContentLoaded", async () => {
  setupMobileMenu();
  setupArticleToc();
  setupComments();

  try {
    await renderNav();
    await renderHome();
    await renderAllPosts();
    await renderCategoryPosts();
    await renderProjects();
  } catch (error) {
    console.error(error);
  }
});
