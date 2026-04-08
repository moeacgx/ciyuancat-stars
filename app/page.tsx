import { loadStars } from '@/lib/load-stars';
import { StarExplorer } from '@/components/star-explorer';

export default async function HomePage() {
  const data = await loadStars();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(31,202,109,0.12),_transparent_20%),radial-gradient(circle_at_top_right,_rgba(67,191,240,0.14),_transparent_24%),linear-gradient(180deg,_#f7fdfb_0%,_#eef8f4_58%,_#f8fcfb_100%)] text-slate-900">
      <StarExplorer data={data} />
    </main>
  );
}
