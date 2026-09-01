import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '@/constants/Colors';
import { FontSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import type { Chantier, ChantierStatus } from '@/api/types';
import type { TranslationKeys } from '@/i18n/translations';
import { useTranslation } from '@/contexts/I18nContext';

const STATUS_COLORS: Record<ChantierStatus, string> = {
  a_venir: '#2563EB',
  en_cours: '#D97706',
  termine: '#16A34A',
};

const STATUS_LABEL_KEYS: Record<ChantierStatus, TranslationKeys> = {
  a_venir: 'chantier.statusUpcoming',
  en_cours: 'chantier.statusInProgress',
  termine: 'chantier.statusCompleted',
};

interface Props {
  chantiers: Chantier[];
  onChantierPress: (id: string) => void;
}

const ChantierMap: React.FC<Props> = ({ chantiers, onChantierPress }) => {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const mappableChantiers = useMemo(
    () => chantiers.filter((c) => c.latitude && c.longitude),
    [chantiers],
  );

  const center = useMemo(() => {
    if (mappableChantiers.length === 0) return { lat: 46.6, lng: 2.3, zoom: 6 };
    const lats = mappableChantiers.map((c) => Number(c.latitude));
    const lngs = mappableChantiers.map((c) => Number(c.longitude));
    const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const spread = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
    const zoom = spread < 0.05 ? 14 : spread < 0.5 ? 11 : spread < 2 ? 9 : spread < 5 ? 7 : 6;
    return { lat, lng, zoom };
  }, [mappableChantiers]);

  const markersJs = useMemo(() => {
    return mappableChantiers.map((c) => {
      const color = STATUS_COLORS[c.status];
      const label = t(STATUS_LABEL_KEYS[c.status]);
      const openLabel = t('chantier.openChantier');
      const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
      const name = esc(c.name);
      const addr = esc([c.address, c.city].filter(Boolean).join(', '));
      return `
        (function(){
          var icon = L.divIcon({
            className: '',
            html: '<div style="background:${color};color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${c.name.charAt(0).toUpperCase()}</div>',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });
          L.marker([${c.latitude}, ${c.longitude}], {icon: icon})
            .addTo(map)
            .bindPopup('<div style="font-family:-apple-system,sans-serif;"><b>${name}</b><br/><span style="color:#78716C;font-size:12px;">${addr}</span><br/><span style="color:${color};font-weight:bold;font-size:12px;">${label}</span><br/><button onclick="window.ReactNativeWebView.postMessage(\\'${c.id}\\')" style="margin-top:6px;background:#D97706;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:13px;font-weight:600;width:100%;">${openLabel}</button></div>');
        })();
      `;
    }).join('\n');
  }, [mappableChantiers]);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; }
        #map { width: 100vw; height: 100vh; }
        .legend {
          position: fixed; top: 10px; right: 10px; background: ${colors.surface};
          padding: 8px 12px; border-radius: 8px; font-family: -apple-system, sans-serif;
          font-size: 11px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); z-index: 1000;
          display: flex; gap: 12px;
        }
        .legend-item { display: flex; align-items: center; gap: 4px; color: ${colors.text2}; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
      </style>
    </head>
    <body>
      <div class="legend">
        <div class="legend-item"><div class="legend-dot" style="background:#2563EB;"></div> ${t('chantier.statusUpcoming')}</div>
        <div class="legend-item"><div class="legend-dot" style="background:#D97706;"></div> ${t('chantier.statusInProgress')}</div>
        <div class="legend-item"><div class="legend-dot" style="background:#16A34A;"></div> ${t('chantier.statusCompleted')}</div>
      </div>
      <div id="map"></div>
      <script>
        var map = L.map('map').setView([${center.lat}, ${center.lng}], ${center.zoom});
        // Attribution en bas a gauche : par defaut Leaflet la place en bas a
        // droite, ou le bouton flottant « + » de la liste la recouvrait. La
        // licence ODbL d'OpenStreetMap impose qu'elle reste lisible, ce n'est
        // donc pas un simple reglage esthetique.
        map.attributionControl.setPosition('bottomleft');
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap'
        }).addTo(map);
        ${markersJs}
      </script>
    </body>
    </html>
  `;

  if (mappableChantiers.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.mutedText }]}>
          {t('chantier.noGpsChantier')}
        </Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ html }}
      style={styles.map}
      onMessage={(event) => {
        const chantierId = event.nativeEvent.data;
        if (chantierId) onChantierPress(chantierId);
      }}
    />
  );
};

const styles = StyleSheet.create({
  map: { flex: 1 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: FontSize.lg },
});

export default React.memo(ChantierMap);
