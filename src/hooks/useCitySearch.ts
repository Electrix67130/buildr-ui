import { useState, useEffect, useRef } from 'react';

interface CityResult {
  nom: string;
  code: string;
  codesPostaux: string[];
  departement: { code: string; nom: string };
  population: number;
  centre: { type: string; coordinates: [number, number] }; // [lng, lat]
}

export interface CitySuggestion {
  name: string;
  cityCode: string; // INSEE code — unique per commune
  postalCode: string;
  department: string;
  latitude: number;
  longitude: number;
  label: string;
}

export function useCitySearch(query: string) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(query)}&fields=nom,code,codesPostaux,departement,population,centre&boost=population&limit=8`,
        );
        const data: CityResult[] = await res.json();

        const results: CitySuggestion[] = [];
        for (const city of data) {
          const [lng, lat] = city.centre?.coordinates ?? [0, 0];
          for (const cp of city.codesPostaux) {
            results.push({
              name: city.nom,
              cityCode: city.code,
              postalCode: cp,
              department: city.departement?.nom ?? '',
              latitude: lat,
              longitude: lng,
              label: `${city.nom} (${cp})`,
            });
          }
        }

        // Deduplicate and limit
        setSuggestions(results.slice(0, 10));
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return { suggestions, isLoading };
}
