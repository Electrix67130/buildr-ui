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
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/api/client';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import BuildrLogo from '@/components/BuildrLogo';
import { useTranslation } from '@/contexts/I18nContext';

export default function LoginScreen() {
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError(t('auth.fillAllFields'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      await login({ email: email.trim(), password });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.statusCode === 401 ? t('auth.invalidCredentials') : String(err.details));
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
            <BuildrLogo size={80} color={colors.primary} />
            <Text style={[styles.subtitle, { color: colors.text2 }]}>{t('auth.tagline')}</Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>{t('auth.email')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={t('a11y.emailAddress')}
            />

            <Text style={[styles.label, { color: colors.text }]}>{t('auth.password')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="••••••••"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              accessibilityLabel={t('auth.password')}
            />

            {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotContainer} accessibilityRole="link">
                <Text style={[styles.forgotText, { color: colors.primary }]}>{t('auth.forgotPasswordQ')}</Text>
              </TouchableOpacity>
            </Link>

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={t('auth.signIn')}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.linkContainer} accessibilityRole="link">
                <Text style={[styles.linkText, { color: colors.text2 }]}>
                  {t('auth.noAccount')}{' '}
                  <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>{t('auth.signUpLink')}</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
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
  subtitle: { fontSize: FontSize.lg, marginTop: Spacing.xs },
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
  forgotContainer: { alignSelf: 'flex-end', marginTop: Spacing.xs },
  forgotText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  button: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  buttonText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  linkContainer: { alignItems: 'center', marginTop: Spacing.xl },
  linkText: { fontSize: FontSize.base },
});
