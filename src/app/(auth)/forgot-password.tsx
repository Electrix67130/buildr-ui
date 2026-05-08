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
import { ArrowLeft } from 'lucide-react-native';
import { apiFetch, ApiError } from '@/api/client';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function ForgotPasswordScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim() },
        auth: false,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Erreur de connexion. Vérifiez votre réseau.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.backBtn} accessibilityRole="link" accessibilityLabel="Retour">
              <ArrowLeft size={IconSize.lg} color={colors.text} />
            </TouchableOpacity>
          </Link>

          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Mot de passe oublié</Text>
            <Text style={[styles.subtitle, { color: colors.text2 }]}>
              Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </Text>
          </View>

          {success ? (
            <View style={[styles.successBox, { backgroundColor: colors.green + '15', borderColor: colors.green + '30' }]}>
              <Text style={[styles.successText, { color: colors.green }]}>
                Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé. Vérifiez votre boîte de réception.
              </Text>
              <Link href="/(auth)/login" asChild>
                <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary, marginTop: Spacing.lg }]}>
                  <Text style={styles.buttonText}>Retour à la connexion</Text>
                </TouchableOpacity>
              </Link>
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={[styles.label, { color: colors.text }]}>Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                placeholder="votre@email.com"
                placeholderTextColor={colors.placeholder}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Adresse email"
              />

              {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleSubmit}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Envoyer le lien</Text>
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
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.lg },
  backBtn: { marginBottom: Spacing.lg },
  header: { marginBottom: Spacing.xxl },
  title: { fontSize: FontSize.title, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.base, marginTop: Spacing.sm, lineHeight: 22 },
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
