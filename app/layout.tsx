import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Github项目收藏夹',
  description: 'Github项目收藏夹：现代化分类浏览、标签筛选、关键词搜索与排序。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
