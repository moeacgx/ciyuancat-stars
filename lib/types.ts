export type StarItem = {
  repo: string;
  url: string;
  description: string;
  category: string;
  topics: string[];
  language: string;
  stars: number;
  starredAt: string;
};

export type StarPayload = {
  title: string;
  generatedAt: string;
  total: number;
  categories: Record<string, number>;
  items: StarItem[];
};
