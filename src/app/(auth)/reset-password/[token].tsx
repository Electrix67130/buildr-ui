import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch, ApiError } from '@/api/client';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { token } = useLocalSearchParams<{ token: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!password.trim()) {
      setError(t('auth.enterNewPassword'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.passwordMin8'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordsMismatch'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: { token, new_password: password },
        auth: false,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.message.includes('expired')) {
          setError(t('auth.linkExpired'));
        } else {
          setError(err.message);
        }
      } else {
        setError(t('auth.networkError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>Buildr</Text>
            <Text style={[styles.title, { color: colors.text }]}>{t('auth.newPassword')}</Text>
          </View>

          {success ? (
            <View style={[styles.successBox, { backgroundColor: colors.green + '15', borderColor: colors.green + '30' }]}>
              <Text style={[styles.successText, { color: colors.green }]}>
                {t('auth.resetSuccess')}
              </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary, marginTop: Spacing.lg }]}>
                  <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.text }]}>{t('auth.newPassword')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                placeholder={t('auth.min8chars')}
                placeholderTextColor={colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                accessibilityLabel={t('auth.newPassword')}
              />

              <Text style={[styles.label, { color: colors.text }]}>{t('auth.confirmPassword')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                placeholder={t('auth.retypePassword')}
                placeholderTextColor={colors.placeholder}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                accessibilityLabel={t('auth.confirmPassword')}
              />

              {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleReset}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>{t('auth.resetAction')}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logo: { fontSize: FontSize.hero, fontWeight: FontWeight.bold },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.semibold, marginTop: Spacing.md },
  form: { gap: Spacing.sm },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: Spacing.sm },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
  },
  error: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  button: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  buttonText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  successBox: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  successText: { fontSize: FontSize.base, lineHeight: 22 },
});
