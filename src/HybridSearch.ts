import type { VaultSearch, SearchResult } from "./VaultSearch";
import type { EmbedSearch } from "./EmbedSearch";

const RRF_K = 60;

/**
 * Combines TF-IDF and embedding search via Reciprocal Rank Fusion.
 * Runs both engines in parallel; rank-merges results so neither score
 * space needs normalization. TF-IDF excerpts are preserved in merged output.
 */
export class HybridSearch {
  constructor(
    private tfidf: VaultSearch,
    private embed: EmbedSearch
  ) {}

  isIndexed(): boolean {
    return this.embed.isIndexed();
  }

  async search(query: string, topK = 8): Promise<SearchResult[]> {
    const fetchK = topK * 3;
    const [tfidfResults, embedResults] = await Promise.all([
      this.tfidf.search(query, fetchK),
      this.embed.search(query, fetchK),
    ]);

    const tfidfRank = new Map<string, number>();
    tfidfResults.forEach((r, i) => tfidfRank.set(r.file.path, i));

    const embedRank = new Map<string, number>();
    embedResults.forEach((r, i) => embedRank.set(r.file.path, i));

    const tfidfMap = new Map(tfidfResults.map((r) => [r.file.path, r]));
    const embedMap = new Map(embedResults.map((r) => [r.file.path, r]));

    const allPaths = new Set<string>([
      ...tfidfResults.map((r) => r.file.path),
      ...embedResults.map((r) => r.file.path),
    ]);

    const scored: Array<[string, number]> = [];
    for (const path of allPaths) {
      const tr = tfidfRank.has(path) ? 1 / (RRF_K + tfidfRank.get(path)! + 1) : 0;
      const er = embedRank.has(path) ? 1 / (RRF_K + embedRank.get(path)! + 1) : 0;
      scored.push([path, tr + er]);
    }

    scored.sort((a, b) => b[1] - a[1]);

    return scored.slice(0, topK).map(([path, score]) => {
      const t = tfidfMap.get(path);
      const e = embedMap.get(path);
      const base = t ?? e!;
      return {
        file: base.file,
        score,
        excerpt: t?.excerpt ?? "",
        title: base.title,
        linked: t?.linked ?? e?.linked,
      };
    });
  }
}
