import { promises as fs } from 'fs';
import path from 'path';
import type { StarPayload } from '@/lib/types';

export async function loadStars(): Promise<StarPayload> {
  const file = path.join(process.cwd(), 'data.json');
  const raw = await fs.readFile(file, 'utf8');
  return JSON.parse(raw) as StarPayload;
}
