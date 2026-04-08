"use client";

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StarItem, StarPayload } from '@/lib/types';

type SortKey = 'stars-desc' | 'stars-asc' | 'recent-starred' | 'repo-asc' | 'repo-desc';
type IconName = 'sparkles' | 'cloud' | 'satellite' | 'message' | 'bot' | 'globe' | 'wrench' | 'server' | 'play';

const CATEGORY_META: Record<string, { icon: IconName; tone: string }> = {
  '全部': { icon: 'sparkles', tone: 'bg-slate-900 text-white border-slate-900' },
  'Cloudflare 生态': { icon: 'cloud', tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  '逆向2API/AI网关': { icon: 'satellite', tone: 'bg-pink-50 text-pink-700 border-pink-200' },
  'Bot/消息桥接': { icon: 'message', tone: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  'AI/Agents/Skills': { icon: 'bot', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  '网站/CMS/博客': { icon: 'globe', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  '开发工具/自动化': { icon: 'wrench', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  '部署运维/网络': { icon: 'server', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  '媒体下载/存储': { icon: 'play', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const CATEGORY_BADGE: Record<string, string> = {
  'Cloudflare 生态': 'bg-orange-50 text-orange-700 ring-orange-200',
  '逆向2API/AI网关': 'bg-pink-50 text-pink-700 ring-pink-200',
  'Bot/消息桥接': 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  'AI/Agents/Skills': 'bg-violet-50 text-violet-700 ring-violet-200',
  '网站/CMS/博客': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  '开发工具/自动化': 'bg-amber-50 text-amber-700 ring-amber-200',
  '部署运维/网络': 'bg-sky-50 text-sky-700 ring-sky-200',
  '媒体下载/存储': 'bg-rose-50 text-rose-700 ring-rose-200',
};

function formatDate(input: string) {
  if (!input) return '时间未知';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function topTags(items: StarItem[]) {
  const map = new Map<string, number>();
  items.forEach((item) => {
    item.topics.forEach((tag) => map.set(tag, (map.get(tag) ?? 0) + 1));
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
}

function sortItems(items: StarItem[], sortBy: SortKey) {
  const rows = [...items];
  switch (sortBy) {
    case 'stars-asc':
      rows.sort((a, b) => a.stars - b.stars || a.repo.localeCompare(b.repo));
      break;
    case 'recent-starred':
      rows.sort((a, b) => b.starredAt.localeCompare(a.starredAt) || b.stars - a.stars);
      break;
    case 'repo-asc':
      rows.sort((a, b) => a.repo.localeCompare(b.repo));
      break;
    case 'repo-desc':
      rows.sort((a, b) => b.repo.localeCompare(a.repo));
      break;
    case 'stars-desc':
    default:
      rows.sort((a, b) => b.stars - a.stars || a.repo.localeCompare(b.repo));
      break;
  }
  return rows;
}

function getInitialBatch() {
  if (typeof window === 'undefined') return 18;
  if (window.innerWidth < 640) return 12;
  if (window.innerWidth < 1024) return 18;
  return 24;
}

function getStep() {
  if (typeof window === 'undefined') return 12;
  if (window.innerWidth < 640) return 8;
  if (window.innerWidth < 1024) return 12;
  return 15;
}

function CategoryIcon({ name, className }: { name: IconName; className?: string }) {
  const base = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    className,
  };

  switch (name) {
    case 'cloud':
      return <svg {...base}><path d="M7 18a4 4 0 1 1 .8-7.92A5.5 5.5 0 0 1 18.5 12H19a3 3 0 1 1 0 6H7Z" /></svg>;
    case 'satellite':
      return <svg {...base}><path d="m14 10 4-4" /><path d="m15 3 6 6" /><path d="M7 14a5 5 0 0 0 3 3" /><path d="M4 17l3-3" /><path d="M2 22l4-4" /><rect x="9" y="9" width="6" height="6" rx="1.2" transform="rotate(45 12 12)" /></svg>;
    case 'message':
      return <svg {...base}><path d="M6 18 3 21V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6Z" /><path d="M8 9h8" /><path d="M8 13h5" /></svg>;
    case 'bot':
      return <svg {...base}><path d="M12 3v3" /><rect x="5" y="8" width="14" height="10" rx="3" /><path d="M8 8V7a4 4 0 1 1 8 0v1" /><path d="M9 12h.01" /><path d="M15 12h.01" /><path d="M9 16h6" /></svg>;
    case 'globe':
      return <svg {...base}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a15 15 0 0 1 0 18" /><path d="M12 3a15 15 0 0 0 0 18" /></svg>;
    case 'wrench':
      return <svg {...base}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.4 2.4-2-2 2.4-2.4Z" /></svg>;
    case 'server':
      return <svg {...base}><rect x="4" y="4" width="16" height="6" rx="2" /><rect x="4" y="14" width="16" height="6" rx="2" /><path d="M8 7h.01" /><path d="M8 17h.01" /><path d="M12 7h5" /><path d="M12 17h5" /></svg>;
    case 'play':
      return <svg {...base}><rect x="4" y="5" width="16" height="14" rx="2.5" /><path d="m10 9 5 3-5 3V9Z" /></svg>;
    case 'sparkles':
    default:
      return <svg {...base}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /><path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z" /></svg>;
  }
}

export function StarExplorer({ data }: { data: StarPayload }) {
  const [keyword, setKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>('stars-desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(18);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(getInitialBatch());
  }, []);

  const categories = useMemo(
    () => [
      { key: '全部', count: data.total },
      ...Object.entries(data.categories)
        .sort((a, b) => b[1] - a[1])
        .map(([key, count]) => ({ key, count })),
    ],
    [data]
  );

  const tags = useMemo(
    () => topTags(data.items).map(([key, count]) => ({ key, count })),
    [data.items]
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const rows = data.items.filter((item) => {
      const hitCategory = activeCategory === '全部' || item.category === activeCategory;
      const hitTags = !activeTags.length || activeTags.every((tag) => item.topics.includes(tag));
      if (!hitCategory || !hitTags) return false;
      if (!kw) return true;
      const blob = [item.repo, item.description, item.category, item.language, ...item.topics].join(' ').toLowerCase();
      return blob.includes(kw);
    });
    return sortItems(rows, sortBy);
  }, [activeCategory, activeTags, data.items, keyword, sortBy]);

  useEffect(() => {
    setVisibleCount(getInitialBatch());
  }, [keyword, activeCategory, activeTags, sortBy]);

  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleCount((prev) => Math.min(prev + getStep(), filtered.length));
          }
        });
      },
      { rootMargin: '300px 0px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [filtered.length, hasMore]);

  const visibleItems = filtered.slice(0, visibleCount);
  const activeFilterCount = (activeCategory !== '全部' ? 1 : 0) + activeTags.length + (keyword.trim() ? 1 : 0);

  const clearFilters = () => {
    setKeyword('');
    setActiveCategory('全部');
    setActiveTags([]);
    setSortBy('stars-desc');
  };

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <header className="mb-4 flex flex-col gap-3 rounded-[24px] border border-white/70 bg-white/90 px-4 py-4 shadow-soft backdrop-blur sm:px-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-700">CIYUANCAT STARS</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">次元猫的 GitHub Star 收藏</h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{data.total} 个项目</span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{Object.keys(data.categories).length} 个分类</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://github.com/moeacgx?tab=stars"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              GitHub 原始页
            </a>
            <span className="rounded-full bg-brand-50 px-3 py-2 text-xs font-medium text-brand-700">
              更新于 {formatDate(data.generatedAt)}
            </span>
          </div>
        </div>
      </header>

      <section className="sticky top-0 z-20 -mx-4 border-y border-white/60 bg-[#f7fdfbcc]/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {categories.map((item) => {
              const meta = CATEGORY_META[item.key] ?? CATEGORY_META['全部'];
              const active = activeCategory === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveCategory(item.key)}
                  className={clsx(
                    'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                    active ? meta.tone : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  )}
                >
                  <CategoryIcon name={meta.icon} className="h-4 w-4" />
                  <span>{item.key}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_auto_auto]">
            <div className="relative">
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索 repo / 描述 / 标签"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-300"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none focus:border-brand-300"
            >
              <option value="stars-desc">Star 从高到低</option>
              <option value="stars-asc">Star 从低到高</option>
              <option value="recent-starred">最近收藏</option>
              <option value="repo-asc">仓库名 A-Z</option>
              <option value="repo-desc">仓库名 Z-A</option>
            </select>

            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className={clsx(
                'inline-flex h-11 items-center justify-center rounded-2xl border px-4 text-sm font-semibold transition',
                filtersOpen || activeTags.length
                  ? 'border-brand-200 bg-brand-50 text-brand-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              )}
            >
              标签筛选{activeTags.length ? ` · ${activeTags.length}` : ''}
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              清空
            </button>
          </div>

          {(filtersOpen || activeTags.length > 0 || activeFilterCount > 0) && (
            <div className="rounded-[22px] border border-white/70 bg-white/90 p-3 shadow-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800">热门标签</div>
                <div className="text-xs text-slate-500">支持多选，自动缩小结果范围</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((item) => {
                  const active = activeTags.includes(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleTag(item.key)}
                      className={clsx(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition',
                        active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      )}
                    >
                      #{item.key} · {item.count}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="py-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-white px-3 py-1.5 shadow-card">当前展示 {visibleItems.length} / {filtered.length}</span>
            {activeCategory !== '全部' && <ActiveChip>{activeCategory}</ActiveChip>}
            {activeTags.map((tag) => <ActiveChip key={tag}>#{tag}</ActiveChip>)}
            {keyword.trim() && <ActiveChip>“{keyword.trim()}”</ActiveChip>}
          </div>
          <div className="text-sm text-slate-500">向下滚动自动加载更多</div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center text-sm text-slate-500 shadow-card">
            没找到匹配项目，换个关键词、分类或标签试试。
          </div>
        ) : (
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleItems.map((item) => (
              <article
                key={item.repo}
                className="group flex h-full min-h-[360px] flex-col rounded-[26px] border border-white/70 bg-white/95 p-4 shadow-card transition hover:-translate-y-1 hover:shadow-soft sm:p-5"
              >
                <div className="mb-4 flex min-h-[150px] items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 text-base font-black leading-7 text-slate-950 transition group-hover:text-brand-700 sm:text-lg"
                    >
                      {item.repo}
                    </a>
                    <p className="mt-2 line-clamp-4 min-h-[112px] text-sm leading-7 text-slate-600">{item.description || '暂无描述'}</p>
                  </div>
                  <span
                    className={clsx(
                      'shrink-0 self-start rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1',
                      CATEGORY_BADGE[item.category] || 'bg-slate-50 text-slate-700 ring-slate-200'
                    )}
                  >
                    {item.category}
                  </span>
                </div>

                <div className="mb-4 flex min-h-[72px] flex-wrap content-start gap-2">
                  <MetaPill>{`★ ${item.stars.toLocaleString('en-US')}`}</MetaPill>
                  <MetaPill>{item.language || 'Unknown'}</MetaPill>
                  <MetaPill>{`收藏于 ${formatDate(item.starredAt)}`}</MetaPill>
                </div>

                <div className="mt-auto flex min-h-[84px] flex-wrap content-start gap-2">
                  {item.topics.length ? (
                    item.topics.slice(0, 6).map((tag) => {
                      const active = activeTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={clsx(
                            'rounded-full px-3 py-1.5 text-xs font-medium transition',
                            active ? 'bg-slate-900 text-white' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          )}
                        >
                          #{tag}
                        </button>
                      );
                    })
                  ) : (
                    <MetaPill>无标签</MetaPill>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {hasMore ? (
          <div ref={sentinelRef} className="flex items-center justify-center py-8 text-sm text-slate-500">
            正在准备更多项目…
          </div>
        ) : filtered.length > 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-400">已加载全部结果</div>
        ) : null}
      </section>
    </div>
  );
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">{children}</span>;
}

function ActiveChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">{children}</span>;
}
