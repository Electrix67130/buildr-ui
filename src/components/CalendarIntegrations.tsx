import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, ImageSourcePropType } from 'react-native';
import { Calendar, Check, Copy, Link2, Unlink } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  useCalendarIntegrations,
  useConnectApple,
  useDisconnectIntegration,
  useStartOAuth,
  CalendarProvider,
  CalendarIntegration,
} from '@/api/hooks/useCalendarIntegrations';
import type { TranslationKeys } from '@/i18n/translations';
import { useTranslation } from '@/contexts/I18nContext';

interface ProviderMeta {
  key: CalendarProvider;
  labelKey: TranslationKeys;
  hintKey: TranslationKeys;
  logo?: ImageSourcePropType;
  badgeColor?: string;
  badgeLetter?: string;
}

// Quand tu veux passer aux vrais logos officiels, depose le PNG dans src/assets/logos/
// puis decommente la ligne `logo: require(...)` correspondante. Le rendu bascule automatiquement.
const PROVIDERS: ProviderMeta[] = [
  {
    key: 'google',
    labelKey: 'calendar.google',
    hintKey: 'calendar.oauthHint',
    logo: require('@/assets/images/google-calendar.png'),
  },
  {
    key: 'outlook',
    labelKey: 'calendar.outlook',
    hintKey: 'calendar.oauthHint',
    logo: require('@/assets/images/outlook-calendar.png'),
  },
  {
    key: 'apple',
    labelKey: 'calendar.apple',
    hintKey: 'calendar.appleHint',
    badgeColor: '#1F1F1F',
    // Pas de logo Apple : marque protegee + on integre via iCal standard, pas via une API Apple
  },
];

export default function CalendarIntegrations() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const integrations = useCalendarIntegrations();
  const startOAuth = useStartOAuth();
  const connectApple = useConnectApple();
  const disconnect = useDisconnectIntegration();
  const [busyProvider, setBusyProvider] = useState<CalendarProvider | null>(null);
  const [copiedFlash, setCopiedFlash] = useState(false);

  // Refresh integrations when user comes back from the OAuth in-app browser
  useEffect(() => {
    const sub = WebBrowser.maybeCompleteAuthSession();
    return () => {
      // no-op
      void sub;
    };
  }, []);

  const findIntegration = (provider: CalendarProvider): CalendarIntegration | undefined =>
    integrations.data?.find((i) => i.provider === provider);

  const handleConnectGoogleOrOutlook = async (provider: 'google' | 'outlook') => {
    setBusyProvider(provider);
    try {
      const { auth_url } = await startOAuth.mutateAsync(provider);
      const result = await WebBrowser.openAuthSessionAsync(auth_url, 'buildr://calendar-callback');
      if (result.type === 'success') {
        await integrations.refetch();
      }
    } catch (err) {
      Alert.alert(t('calendar.connectFailed'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setBusyProvider(null);
    }
  };

  const handleConnectApple = async () => {
    setBusyProvider('apple');
    try {
      const result = await connectApple.mutateAsync();
      if (result.ical_url) {
        await Clipboard.setStringAsync(result.ical_url);
        setCopiedFlash(true);
        setTimeout(() => setCopiedFlash(false), 2500);
        Alert.alert(t('calendar.urlCopied'), t('calendar.urlCopiedBody'));
      }
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setBusyProvider(null);
    }
  };

  const handleDisconnect = (provider: CalendarProvider) => {
    Alert.alert(
      t('calendar.disconnectTitle'),
      t('calendar.disconnectBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('calendar.disconnect'),
          style: 'destructive',
          onPress: async () => {
            setBusyProvider(provider);
            try {
              await disconnect.mutateAsync(provider);
            } finally {
              setBusyProvider(null);
            }
          },
        },
      ],
    );
  };

  const handleCopyAppleUrl = async (url: string) => {
    await Clipboard.setStringAsync(url);
    setCopiedFlash(true);
    setTimeout(() => setCopiedFlash(false), 2000);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Calendar size={IconSize.md} color={colors.primary} />
        <Text style={[styles.headerText, { color: colors.text }]}>
          {t('calendar.intro')}
        </Text>
      </View>

      {integrations.isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: Spacing.lg }} />
      ) : (
        PROVIDERS.map((p) => {
          const integration = findIntegration(p.key);
          const isConnected = !!integration;
          const isBusy = busyProvider === p.key;

          return (
            <View key={p.key} style={[styles.providerRow, { borderColor: colors.border }]}>
              <View style={styles.providerInfo}>
                {p.logo ? (
                  <Image source={p.logo} style={styles.providerLogo} resizeMode="contain" />
                ) : (
                  <View
                    style={[
                      styles.providerLogo,
                      styles.providerLogoFallback,
                      { backgroundColor: p.badgeColor ?? colors.itemBackground },
                    ]}
                  >
                    <Calendar size={22} color={p.badgeColor ? '#FFFFFF' : colors.text2} strokeWidth={2.4} />
                    {p.badgeLetter ? <Text style={styles.providerLogoLetter}>{p.badgeLetter}</Text> : null}
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.providerLabel, { color: colors.text }]}>{t(p.labelKey)}</Text>
                  <Text style={[styles.providerHint, { color: colors.mutedText }]}>{t(p.hintKey)}</Text>
                  {p.key === 'apple' && integration?.ical_url ? (
                    <TouchableOpacity onPress={() => handleCopyAppleUrl(integration.ical_url!)} style={styles.icalUrlRow}>
                      <Text numberOfLines={1} style={[styles.icalUrl, { color: colors.primary }]}>
                        {integration.ical_url}
                      </Text>
                      {copiedFlash ? (
                        <Check size={14} color={colors.green} />
                      ) : (
                        <Copy size={14} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              {isBusy ? (
                <ActivityIndicator color={colors.primary} />
              ) : isConnected ? (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.red }]}
                  onPress={() => handleDisconnect(p.key)}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.disconnectA11y', { provider: t(p.labelKey) })}
                >
                  <Unlink size={IconSize.sm} color={colors.red} />
                  <Text style={[styles.actionBtnText, { color: colors.red }]}>{t('calendar.disconnect')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: colors.primary }]}
                  onPress={() => (p.key === 'apple' ? handleConnectApple() : handleConnectGoogleOrOutlook(p.key))}
                  accessibilityRole="button"
                  accessibilityLabel={t('calendar.connectA11y', { provider: t(p.labelKey) })}
                >
                  <Link2 size={IconSize.sm} color="#FFFFFF" />
                  <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>
                    {p.key === 'apple' ? t('calendar.getUrl') : t('calendar.connect')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  headerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    flex: 1,
  },
  providerLogo: { width: 40, height: 40, marginTop: 2 },
  providerLogoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  providerLogoLetter: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    position: 'absolute',
    bottom: 4,
  },
  providerLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  providerHint: { fontSize: FontSize.xs, marginTop: 2 },
  icalUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  icalUrl: { fontSize: FontSize.xs, flex: 1 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  actionBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
});
