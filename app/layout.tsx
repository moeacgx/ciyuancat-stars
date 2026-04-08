import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '次元猫的 GitHub Star 收藏',
  description: '次元猫的 GitHub Star 收藏：现代化分类浏览、标签筛选、关键词搜索与排序。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
