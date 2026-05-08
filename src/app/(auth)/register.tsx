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

export default function RegisterScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { register } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !phone.trim()) {
      setError('Veuillez remplir les champs obligatoires.');
      return;
    }
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      await register({
        email: email.trim(),
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        company_name: companyName.trim() || undefined,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.statusCode === 409 ? 'Cette adresse email est déjà utilisée.' : String(err.details));
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
          <View style={styles.header}>
            <Text style={[styles.logo, { color: colors.primary }]}>Buildr</Text>
            <Text style={[styles.subtitle, { color: colors.text2 }]}>Créer un compte</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={[styles.label, { color: colors.text }]}>Prénom *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                  placeholder="Julien"
                  placeholderTextColor={colors.placeholder}
                  value={firstName}
                  onChangeText={setFirstName}
                  accessibilityLabel="Prénom"
                />
              </View>
              <View style={styles.halfField}>
                <Text style={[styles.label, { color: colors.text }]}>Nom *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
                  placeholder="Dupont"
                  placeholderTextColor={colors.placeholder}
                  value={lastName}
                  onChangeText={setLastName}
                  accessibilityLabel="Nom"
                />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Email *</Text>
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

            <Text style={[styles.label, { color: colors.text }]}>Mot de passe *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="8 caractères minimum"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              accessibilityLabel="Mot de passe"
            />

            <Text style={[styles.label, { color: colors.text }]}>Téléphone *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="06 12 34 56 78"
              placeholderTextColor={colors.placeholder}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              accessibilityLabel="Téléphone"
            />

            <Text style={[styles.label, { color: colors.text }]}>Entreprise</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.itemBackground, color: colors.text, borderColor: colors.border }]}
              placeholder="EIFFAGE, Bouygues..."
              placeholderTextColor={colors.placeholder}
              value={companyName}
              onChangeText={setCompanyName}
              accessibilityLabel="Nom d'entreprise"
            />

            {error ? <Text style={[styles.error, { color: colors.red }]}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleRegister}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Créer mon compte"
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Créer mon compte</Text>
              )}
            </TouchableOpacity>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.linkContainer} accessibilityRole="link">
                <Text style={[styles.linkText, { color: colors.text2 }]}>
                  Déjà un compte ?{' '}
                  <Text style={{ color: colors.primary, fontWeight: FontWeight.semibold }}>Se connecter</Text>
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
  row: { flexDirection: 'row', gap: Spacing.md },
  halfField: { flex: 1 },
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
  linkContainer: { alignItems: 'center', marginTop: Spacing.xl },
  linkText: { fontSize: FontSize.base },
});
