import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink, Mail } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { DASHBOARD_SIGNUP_URL } from '@/constants/Urls';
import { useTranslation } from '@/contexts/I18nContext';

/**
 * Sur mobile, la création de compte standalone (qui implique la création d'une
 * organisation et donc plus tard de la facturation) renvoie vers le dashboard web.
 * Les rejoins par invitation restent gérés ici via /(auth)/invite/[token].
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* L'invitation d'abord, la creation d'entreprise ensuite.
            L'ecran mettait en avant « cree ton entreprise », alors que la
            plupart des gens qui telechargent l'app sont des ouvriers, chefs de
            chantier ou prestataires invites par quelqu'un d'autre. Un ouvrier
            arrivait ici et se voyait proposer de creer une societe. */}
        <View style={[styles.iconBubble, { backgroundColor: colors.primary + '15' }]}>
          <Mail size={36} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>{t('register.haveInvite')}</Text>
        <Text style={[styles.body, { color: colors.text2 }]}>
          {t('register.inviteBody')}
        </Text>

        <Text style={[styles.hint, { color: colors.mutedText }]}>
          {t('register.noInvite')}
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Text style={[styles.invitationTitle, { color: colors.text }]}>{t('register.companyTitle')}</Text>
        <Text style={[styles.body, { color: colors.text2 }]}>
          {t('register.body')}
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => Linking.openURL(DASHBOARD_SIGNUP_URL)}
          accessibilityRole="link"
          accessibilityLabel={t('register.openDashboardA11y')}
        >
          <ExternalLink size={IconSize.sm} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>{t('register.openDashboard')}</Text>
        </TouchableOpacity>

        <Text style={[styles.hint, { color: colors.mutedText }]}>
          {t('register.hint')}
        </Text>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.linkContainer} accessibilityRole="link">
            <Text style={[styles.linkText, { color: colors.text2 }]}>
              {t('auth.alreadyAccount')}{' '}
              <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>{t('auth.signIn')}</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: Spacing.xxl, justifyContent: 'center' },
  iconBubble: {
    height: 72,
    width: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    alignSelf: 'flex-start',
  },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, marginBottom: Spacing.md },
  body: { fontSize: FontSize.base, lineHeight: 22, marginBottom: Spacing.lg },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  hint: { fontSize: FontSize.sm, marginTop: Spacing.md, textAlign: 'center' },
  divider: { height: 1, marginVertical: Spacing.xl },
  invitationTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, marginBottom: Spacing.sm },
  linkContainer: { alignItems: 'center', marginTop: Spacing.lg },
  linkText: { fontSize: FontSize.base },
});
