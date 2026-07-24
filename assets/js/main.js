const PINNED_HOME_POST = {
  title: "SQL Sorgu Atölyesi",
  category: "SQL",
  subcategory: "Uygulamalı Çalışma",
  description: "6 veritabanı ve 240 SQL sorusu ile sorgu yaz, çalıştır, kontrol et ve ilerlemeni takip et.",
  date: "Öne Çıkan",
  readTime: "Etkileşimli",
  image: "/assets/images/covers/sql-sorgu-atolyesi-card.webp",
  url: "kategoriler/sql/sql-sorgu-atolyesi/",
  pinned: true
};

const DATA_PATHS = {
  categories: "/data/categories.json",
  posts: "/data/posts.json",
  projects: "/data/projects.json"
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} yüklenemedi`);
  return response.json();
}

function sortPosts(posts) {
  return [...posts].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function createPostCard(post) {
  const a = document.createElement("a");
  a.className = post.pinned ? "post-card post-card-pinned" : "post-card";
  a.href = "/" + post.url.replace(/^\/+/, "");
  a.innerHTML = `
    ${post.pinned ? '<span class="pinned-badge">📌 Öne Çıkan</span>' : ''}
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
  const posts = sortPosts(await fetchJson(DATA_PATHS.posts));
  container.innerHTML = "";
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state"><p>Henüz yazı eklenmedi.</p></div>`;
    return;
  }
  container.appendChild(createPostCard(PINNED_HOME_POST));
  posts.slice(0, 5).forEach(post => container.appendChild(createPostCard(post)));
}

function renderPostList(container, posts) {
  container.innerHTML = "";
  if (!posts.length) {
    container.innerHTML = `<div class="empty-state"><p>Aramana uygun yazı bulunamadı.</p></div>`;
    return;
  }
  posts.forEach(post => container.appendChild(createPostCard(post)));
}

async function renderAllPosts() {
  const container = document.getElementById("allPosts");
  if (!container) return;

  const posts = sortPosts(await fetchJson(DATA_PATHS.posts));
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

  const posts = sortPosts(await fetchJson(DATA_PATHS.posts));
  const filtered = posts.filter(post => {
    const categoryMatch = !categorySlug || post.categorySlug === categorySlug;
    const subcategoryMatch = !subcategorySlug || post.subcategorySlug === subcategorySlug;
    return categoryMatch && subcategoryMatch;
  });

  renderPostList(container, filtered);
}

async function renderProjects() {
  const container = document.getElementById("projectsGrid");
  if (!container) return;
  const projects = await fetchJson(DATA_PATHS.projects);
  container.innerHTML = "";
  projects.forEach(project => container.appendChild(createProjectCard(project)));
}

function setupMobileMenu() {
  const button = document.querySelector(".mobile-menu-button");
  const nav = document.getElementById("mainNav");
  if (!button || !nav) return;
  button.addEventListener("click", () => nav.classList.toggle("open"));
}

document.addEventListener("DOMContentLoaded", async () => {
  setupMobileMenu();

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
