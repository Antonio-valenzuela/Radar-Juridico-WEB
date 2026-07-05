import { SearchResultItem } from './searchRanking';

export type SearchFacets = {
  matters: Record<string, number>;
  sources: Record<string, number>;
  authorities: Record<string, number>;
  impactLevels: Record<string, number>;
  entities: Record<string, number>;
  sectors: Record<string, number>;
};

export function computeFacets(results: SearchResultItem[]): SearchFacets {
  const facets: SearchFacets = {
    matters: {},
    sources: {},
    authorities: {},
    impactLevels: {},
    entities: {},
    sectors: {}
  };

  for (const { item } of results) {
    if (item.tema) {
      facets.matters[item.tema] = (facets.matters[item.tema] || 0) + 1;
    }
    if (item.source) {
      facets.sources[item.source] = (facets.sources[item.source] || 0) + 1;
    }
    if (item.authority) {
      facets.authorities[item.authority] = (facets.authorities[item.authority] || 0) + 1;
    }
    if (item.impacto) {
      const imp = item.impacto.toLowerCase();
      facets.impactLevels[imp] = (facets.impactLevels[imp] || 0) + 1;
    }
    if (item.entities && Array.isArray(item.entities)) {
      item.entities.forEach((ent: string) => {
        facets.entities[ent] = (facets.entities[ent] || 0) + 1;
      });
    }
    if (item.affectedSectors && Array.isArray(item.affectedSectors)) {
      item.affectedSectors.forEach((sec: string) => {
        facets.sectors[sec] = (facets.sectors[sec] || 0) + 1;
      });
    }
  }

  return facets;
}
