"use client";

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import type { StarItem, StarPayload } from '@/lib/types';

type SortKey = 'stars-desc' | 'stars-asc' | 'recent-starred' | 'repo-asc' | 'repo-desc';

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
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
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

const badgeColorMap: Record<string, string> = {
  'Cloudflare 生态': 'bg-orange-50 text-orange-700 ring-orange-200',
  '逆向2API/AI网关': 'bg-pink-50 text-pink-700 ring-pink-200',
  'Bot/消息桥接': 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  'AI/Agents/Skills': 'bg-violet-50 text-violet-700 ring-violet-200',
  '网站/CMS/博客': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  '开发工具/自动化': 'bg-amber-50 text-amber-700 ring-amber-200',
  '部署运维/网络': 'bg-sky-50 text-sky-700 ring-sky-200',
  '媒体下载/存储': 'bg-rose-50 text-rose-700 ring-rose-200',
};

export function StarExplorer({ data }: { data: StarPayload }) {
  const [keyword, setKeyword] = useState('');
  const [activeCategory, setActiveCategory] = useState('全部');
  const [activeTag, setActiveTag] = useState('全部');
  const [sortBy, setSortBy] = useState<SortKey>('stars-desc');

  const categories = useMemo(() => [
    { key: '全部', count: data.total },
    ...Object.entries(data.categories)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count })),
  ], [data]);

  const tags = useMemo(() => [{ key: '全部', count: data.total }, ...topTags(data.items).map(([key, count]) => ({ key, count }))], [data]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const rows = data.items.filter((item) => {
      const hitCategory = activeCategory === '全部' || item.category === activeCategory;
      const hitTag = activeTag === '全部' || item.topics.includes(activeTag);
      if (!hitCategory || !hitTag) return false;
      if (!kw) return true;
      const blob = [item.repo, item.description, item.category, item.language, ...item.topics].join(' ').toLowerCase();
      return blob.includes(kw);
    });
    return sortItems(rows, sortBy);
  }, [activeCategory, activeTag, data.items, keyword, sortBy]);

  const topCategories = categories.filter((item) => item.key !== '全部').slice(0, 4);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      <header className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-soft backdrop-blur sm:p-6 lg:p-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
              CIYUANCAT · STAR INTELLIGENCE
            </div>
            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                用现代化前端，重新整理次元猫的 GitHub Star 收藏
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                这里不是单纯的 Star 列表，而是一个面向浏览、筛选和发现的项目情报页。保留分类、标签、搜索与排序，把信息层级、视觉结构和交互逻辑一起重做。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <a href="#explore" className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-brand-500 to-sky-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition hover:-translate-y-0.5">
                开始浏览
              </a>
              <a href="https://github.com/moeacgx?tab=stars" target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white">
                查看原始 GitHub Star
              </a>
            </div>
          </div>

          <div className="grid w-full gap-4 sm:grid-cols-2 lg:max-w-xl">
            <StatCard label="项目总数" value={String(data.total)} note="每日自动同步" tone="green" />
            <StatCard label="分类数量" value={String(Object.keys(data.categories).length)} note="固定分类体系" tone="blue" />
            <StatCard label="数据更新时间" value={formatDate(data.generatedAt)} note="描述与标签同步更新" tone="slate" wide />
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr_1fr]" id="explore">
        <div className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
          <div className="mb-3 text-sm font-semibold text-slate-500">搜索项目</div>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索 repo / 描述 / 标签 / 分类"
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-brand-300 focus:bg-white"
          />
        </div>

        <div className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
          <div className="mb-3 text-sm font-semibold text-slate-500">排序方式</div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none focus:border-brand-300 focus:bg-white"
          >
            <option value="stars-desc">按 Star 数从高到低</option>
            <option value="stars-asc">按 Star 数从低到高</option>
            <option value="recent-starred">按收藏时间最新</option>
            <option value="repo-asc">按仓库名 A-Z</option>
            <option value="repo-desc">按仓库名 Z-A</option>
          </select>
        </div>

        <div className="rounded-[24px] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur">
          <div className="mb-2 text-sm font-semibold text-slate-500">当前结果</div>
          <div className="text-sm leading-7 text-slate-700">
            当前展示 <span className="font-bold text-slate-950">{filtered.length}</span> / {data.total} 个项目
            {activeCategory !== '全部' ? <> · 分类：<span className="font-semibold">{activeCategory}</span></> : null}
            {activeTag !== '全部' ? <> · 标签：<span className="font-semibold">#{activeTag}</span></> : null}
            {keyword.trim() ? <> · 关键词：<span className="font-semibold">{keyword.trim()}</span></> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur sm:p-6">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Star Categories</div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">按分类筛选</h2>
            </div>
            <p className="text-sm leading-6 text-slate-500">先按大类收窄范围，再叠加标签和关键词。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {categories.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveCategory(item.key)}
                className={clsx(
                  'rounded-full border px-4 py-2 text-sm font-medium transition',
                  activeCategory === item.key
                    ? 'border-transparent bg-gradient-to-r from-brand-500 to-sky-400 text-white shadow-lg shadow-brand-500/20'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                )}
              >
                {item.key} · {item.count}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur sm:p-6">
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Category Snapshot</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">分类概览</h2>
          </div>
          <div className="space-y-3">
            {topCategories.map((item) => (
              <div key={item.key} className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold text-slate-900">{item.key}</div>
                  <div className="text-sm text-slate-500">{item.count}</div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sky-400" style={{ width: `${Math.max(8, Math.round((item.count / data.total) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-5 shadow-card backdrop-blur sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Popular Tags</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">按标签筛选</h2>
          </div>
          <p className="text-sm leading-6 text-slate-500">把高频 topics 做成第二层过滤器，方便快速切主题。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {tags.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setActiveTag(item.key)}
              className={clsx(
                'rounded-full border px-4 py-2 text-sm font-medium transition',
                activeTag === item.key
                  ? 'border-transparent bg-gradient-to-r from-brand-500 to-sky-400 text-white shadow-lg shadow-brand-500/20'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
              )}
            >
              {item.key === '全部' ? `全部标签 · ${item.count}` : `#${item.key} · ${item.count}`}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-4 pb-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Star Projects</div>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">收藏项目卡片墙</h2>
          </div>
          <p className="text-sm leading-6 text-slate-500">信息层级重构为：仓库名 → 一句话 → 核心元信息 → 标签。</p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center text-sm text-slate-500 shadow-card">
            没找到匹配的项目，换个关键词、分类或标签试试。
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => (
              <article key={item.repo} className="group rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-card transition hover:-translate-y-1 hover:shadow-soft">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <a href={item.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-lg font-black leading-7 text-slate-950 transition group-hover:text-brand-700">
                      {item.repo}
                    </a>
                    <p className="mt-2 line-clamp-4 text-sm leading-7 text-slate-600">{item.description || '暂无描述'}</p>
                  </div>
                  <span className={clsx('shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ring-1', badgeColorMap[item.category] || 'bg-slate-50 text-slate-700 ring-slate-200')}>
                    {item.category}
                  </span>
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <MetaPill>{`★ ${item.stars.toLocaleString('en-US')}`}</MetaPill>
                  <MetaPill>{item.language || 'Unknown'}</MetaPill>
                  <MetaPill>{`收藏于 ${formatDate(item.starredAt)}`}</MetaPill>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.topics.length ? item.topics.slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActiveTag((prev) => prev === tag ? '全部' : tag)}
                      className={clsx(
                        'rounded-full px-3 py-1.5 text-xs font-medium transition',
                        activeTag === tag
                          ? 'bg-gradient-to-r from-brand-500 to-sky-400 text-white'
                          : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                      )}
                    >
                      #{tag}
                    </button>
                  )) : <MetaPill>无标签</MetaPill>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetaPill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">{children}</span>;
}

function StatCard({ label, value, note, tone, wide = false }: { label: string; value: string; note: string; tone: 'green' | 'blue' | 'slate'; wide?: boolean; }) {
  const toneClass = tone === 'green'
    ? 'from-brand-50 to-white'
    : tone === 'blue'
      ? 'from-sky-50 to-white'
      : 'from-slate-50 to-white';

  return (
    <div className={clsx('rounded-[24px] border border-slate-100 bg-gradient-to-b p-5 shadow-card', toneClass, wide && 'sm:col-span-2')}>
      <div className="text-sm font-semibold text-slate-500">{label}</div>
      <div className="mt-3 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">{value}</div>
      <div className="mt-3 text-sm leading-6 text-slate-500">{note}</div>
    </div>
  );
}
