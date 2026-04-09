const state = {
  data: null,
  activeCategory: '全部',
  activeTag: '全部',
  keyword: '',
  sortBy: 'recent-starred',
};

const els = {
  totalCount: document.getElementById('totalCount'),
  categoryCount: document.getElementById('categoryCount'),
  generatedAt: document.getElementById('generatedAt'),
  summaryText: document.getElementById('summaryText'),
  categoryFilters: document.getElementById('categoryFilters'),
  tagFilters: document.getElementById('tagFilters'),
  repoGrid: document.getElementById('repoGrid'),
  searchInput: document.getElementById('searchInput'),
  sortSelect: document.getElementById('sortSelect'),
  repoCardTemplate: document.getElementById('repoCardTemplate'),
};

const CATEGORY_CLASS = {
  'Cloudflare 生态': 'cat-cloudflare',
  '逆向2API/AI网关': 'cat-api',
  'Bot/消息桥接': 'cat-bot',
  'AI/Agents/Skills': 'cat-ai',
  '网站/CMS/博客': 'cat-web',
  '开发工具/自动化': 'cat-dev',
  '部署运维/网络': 'cat-ops',
  '媒体下载/存储': 'cat-media',
};

function formatDate(v) {
  if (!v) return '--';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString('zh-CN', { hour12: false });
}

function safeNum(v) {
  return Number(v || 0);
}

function tagStats(items) {
  const stats = new Map();
  items.forEach((item) => {
    (item.topics || []).forEach((tag) => {
      stats.set(tag, (stats.get(tag) || 0) + 1);
    });
  });
  return [...stats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 36);
}

function sortRows(rows) {
  const cloned = [...rows];
  switch (state.sortBy) {
    case 'stars-asc':
      cloned.sort((a, b) => safeNum(a.stars) - safeNum(b.stars) || a.repo.localeCompare(b.repo));
      break;
    case 'recent-starred':
      cloned.sort((a, b) => String(b.starredAt || '').localeCompare(String(a.starredAt || '')) || safeNum(b.stars) - safeNum(a.stars));
      break;
    case 'repo-asc':
      cloned.sort((a, b) => a.repo.localeCompare(b.repo));
      break;
    case 'repo-desc':
      cloned.sort((a, b) => b.repo.localeCompare(a.repo));
      break;
    case 'stars-desc':
    default:
      cloned.sort((a, b) => safeNum(b.stars) - safeNum(a.stars) || a.repo.localeCompare(b.repo));
      break;
  }
  return cloned;
}

function card(item) {
  const node = els.repoCardTemplate.content.firstElementChild.cloneNode(true);
  const link = node.querySelector('.repo-name');
  link.href = item.url;
  link.textContent = item.repo;
  node.classList.add(CATEGORY_CLASS[item.category] || 'cat-default');
  node.querySelector('.repo-desc').textContent = item.description || '暂无描述';
  node.querySelector('.category-badge').textContent = item.category;
  node.querySelector('.repo-stars').textContent = `★ ${safeNum(item.stars).toLocaleString('en-US')}`;
  node.querySelector('.repo-lang').textContent = item.language || 'Unknown';
  node.querySelector('.repo-starred-at').textContent = item.starredAt ? `收藏于 ${formatDate(item.starredAt)}` : '收藏时间未知';
  const tags = node.querySelector('.repo-tags');
  if (item.topics?.length) {
    item.topics.slice(0, 8).forEach((tag) => {
      const el = document.createElement('button');
      el.className = `tag ${state.activeTag === tag ? 'active' : ''}`;
      el.type = 'button';
      el.textContent = `#${tag}`;
      el.addEventListener('click', () => {
        state.activeTag = state.activeTag === tag ? '全部' : tag;
        render();
      });
      tags.appendChild(el);
    });
  } else {
    const el = document.createElement('span');
    el.className = 'meta-pill';
    el.textContent = '无标签';
    tags.appendChild(el);
  }
  return node;
}

function match(item) {
  const hitCategory = state.activeCategory === '全部' || item.category === state.activeCategory;
  const hitTag = state.activeTag === '全部' || (item.topics || []).includes(state.activeTag);
  if (!hitCategory || !hitTag) return false;
  const kw = state.keyword.trim().toLowerCase();
  if (!kw) return true;
  const blob = [item.repo, item.description, item.category, item.language, ...(item.topics || [])].join(' ').toLowerCase();
  return blob.includes(kw);
}

function renderChipGroup(container, options, active, onClick, formatter) {
  container.innerHTML = '';
  options.forEach((option) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `chip ${active === option.key ? 'active' : ''}`;
    btn.textContent = formatter(option);
    btn.addEventListener('click', () => onClick(option.key));
    container.appendChild(btn);
  });
}

function renderFilters() {
  const categories = [
    { key: '全部', count: state.data.total },
    ...Object.keys(state.data.categories)
      .sort((a, b) => state.data.categories[b] - state.data.categories[a])
      .map((name) => ({ key: name, count: state.data.categories[name] })),
  ];
  renderChipGroup(
    els.categoryFilters,
    categories,
    state.activeCategory,
    (name) => {
      state.activeCategory = name;
      render();
    },
    (item) => `${item.key} · ${item.count}`
  );

  const tags = [{ key: '全部', count: state.data.total }, ...tagStats(state.data.items).map(([tag, count]) => ({ key: tag, count }))];
  renderChipGroup(
    els.tagFilters,
    tags,
    state.activeTag,
    (tag) => {
      state.activeTag = tag;
      render();
    },
    (item) => item.key === '全部' ? `全部标签 · ${item.count}` : `#${item.key} · ${item.count}`
  );
}

function renderGrid() {
  const rows = sortRows(state.data.items.filter(match));
  els.repoGrid.innerHTML = '';
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '没有匹配到项目，换个关键词、分类或标签试试。';
    els.repoGrid.appendChild(empty);
  } else {
    rows.forEach((item) => els.repoGrid.appendChild(card(item)));
  }
  const suffix = [];
  if (state.activeCategory !== '全部') suffix.push(`分类：${state.activeCategory}`);
  if (state.activeTag !== '全部') suffix.push(`标签：#${state.activeTag}`);
  if (state.keyword.trim()) suffix.push(`关键词：${state.keyword.trim()}`);
  els.summaryText.textContent = `当前展示 ${rows.length} / ${state.data.total} 个项目${suffix.length ? ' · ' + suffix.join(' · ') : ''}`;
}

function renderHeader() {
  els.totalCount.textContent = state.data.total;
  els.categoryCount.textContent = Object.keys(state.data.categories).length;
  els.generatedAt.textContent = formatDate(state.data.generatedAt);
  if (els.sortSelect) {
    els.sortSelect.value = state.sortBy;
  }
}

function render() {
  renderHeader();
  renderFilters();
  renderGrid();
}

function init() {
  if (!window.__STAR_PAGE_DATA__) throw new Error('缺少页面数据');
  state.data = window.__STAR_PAGE_DATA__;
  els.searchInput.addEventListener('input', (e) => {
    state.keyword = e.target.value;
    renderGrid();
  });
  els.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderGrid();
  });
  render();
}

try {
  init();
} catch (err) {
  els.summaryText.textContent = `加载失败：${err.message}`;
}
