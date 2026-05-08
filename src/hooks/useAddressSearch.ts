import { useState, useEffect, useRef } from 'react';

interface AddressFeature {
  properties: {
    label: string;
    housenumber?: string;
    street?: string;
    name: string;
    postcode: string;
    city: string;
    type: string; // 'housenumber' | 'street' | 'municipality'
  };
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
}

export interface AddressSuggestion {
  name: string;
  label: string;
  street: string;
  housenumber?: string;
  city: string;
  postcode: string;
  latitude: number;
  longitude: number;
}

export function useAddressSearch(query: string, cityCode?: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 3 || !cityCode) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          citycode: cityCode,
          limit: '8',
          type: 'housenumber',
        });
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?${params}`);
        const data = await res.json();

        const results: AddressSuggestion[] = (data.features ?? []).map((f: AddressFeature) => {
          const [lng, lat] = f.geometry.coordinates;
          return {
            name: f.properties.name,
            label: f.properties.label,
            street: f.properties.street || f.properties.name,
            housenumber: f.properties.housenumber,
            city: f.properties.city,
            postcode: f.properties.postcode,
            latitude: lat,
            longitude: lng,
          };
        });

        // If no housenumber results, also try street type
        if (results.length === 0) {
          const streetParams = new URLSearchParams({
            q: query,
            citycode: cityCode,
            limit: '8',
            type: 'street',
          });
          const streetRes = await fetch(`https://api-adresse.data.gouv.fr/search/?${streetParams}`);
          const streetData = await streetRes.json();

          for (const f of streetData.features ?? []) {
            const [lng, lat] = f.geometry.coordinates;
            results.push({
              name: f.properties.name,
              label: f.properties.label,
              street: f.properties.street || f.properties.name,
              housenumber: f.properties.housenumber,
              city: f.properties.city,
              postcode: f.properties.postcode,
              latitude: lat,
              longitude: lng,
            });
          }
        }

        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, cityCode]);

  return { suggestions, isLoading };
}
