import React, { useState, useEffect } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Link } from 'expo-router';
import { MailCheck } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch, ApiError } from '@/api/client';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  employee: 'Employé',
  client: 'Client',
};

export default function InviteScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { register } = useAuth();

  const [invitation, setInvitation] = useState<{ email: string; role: string; organization_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [invitationError, setInvitationError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isClient = invitation?.role === 'client';

  // Fetch invitation info on mount
  useEffect(() => {
    if (!token) {
      setInvitationError('Lien d\'invitation invalide.');
      setLoading(false);
      return;
    }

    apiFetch<{ email: string; role: string; organization_name: string }>(`/invitations/by-token/${token}`, { auth: false })
      .then((data) => {
        setInvitation(data);
        // For employees: company is automatically the inviting org (non-editable)
        // For clients: leave blank so they fill their own
        if (data.role !== 'client') {
          setCompanyName(data.organization_name);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.statusCode === 400) {
          setInvitationError('Cette invitation a expiré.');
        } else {
          setInvitationError('Invitation introuvable ou déjà utilisée.');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!invitation || !token) return;
    if (!firstName.trim() || !lastName.trim() || !password.trim() || !phone.trim()) {
      setFormError('Veuillez remplir les champs obligatoires.');
      return;
    }
    if (password.length < 8) {
      setFormError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setFormError('');
    setSubmitting(true);

    try {
      await register({
        email: invitation.email,
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        company_name: companyName.trim() || undefined,
        invitation_token: token,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(String(err.details));
      } else {
        setFormError('Erreur lors de l\'inscription.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (invitationError || !invitation) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.errorTitle, { color: colors.red }]}>Invitation invalide</Text>
          <Text style={[styles.errorText, { color: colors.text2 }]}>{invitationError}</Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]}>
              <Text style={styles.backBtnText}>Aller à la connexion</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
              <MailCheck size={IconSize.xxl} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Invitation à rejoindre Buildr</Text>
            <Text style={[styles.subtitle, { color: colors.text2 }]}>
              <Text style={{ fontWeight: FontWeight.bold, color: colors.primary }}>
                {invitation.organization_name}
              </Text> vous invite en tant que <Text style={{ fontWeight: FontWeight.bold, color: colors.primary }}>
                {ROLE_LABELS[invitation.role] || invitation.role}
              </Text>
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>Email</Text>
            <TextInput
              style={[styles.inputDisabled, { backgroundColor: colors.itemBackground, color: colors.text2, borderColor: colors.border }]}
              value={invitation.email}
              editable={false}
              accessibilityLabel="Email"
            />

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

            <Text style={[styles.label, { color: colors.text }]}>
              Entreprise {isClient ? '' : '(définie par l\'invitant)'}
            </Text>
            <TextInput
              style={[
                isClient ? styles.input : styles.inputDisabled,
                { backgroundColor: colors.itemBackground, color: isClient ? colors.text : colors.text2, borderColor: colors.border },
              ]}
              placeholder={isClient ? 'Votre entreprise (ex: EIFFAGE)' : ''}
              placeholderTextColor={colors.placeholder}
              value={companyName}
              onChangeText={setCompanyName}
              editable={isClient}
              accessibilityLabel="Entreprise"
            />

            {formError ? <Text style={[styles.error, { color: colors.red }]}>{formError}</Text> : null}

            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Accepter l'invitation"
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Accepter l'invitation</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  scrollContent: { paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.md },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, textAlign: 'center' },
  subtitle: { fontSize: FontSize.base, textAlign: 'center' },
  form: { gap: Spacing.sm },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: Spacing.sm },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
  },
  inputDisabled: {
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: FontSize.base,
    opacity: 0.7,
  },
  row: { flexDirection: 'row', gap: Spacing.md },
  halfField: { flex: 1 },
  error: { fontSize: FontSize.sm, marginTop: Spacing.xs },
  button: {
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  buttonText: { color: '#FFFFFF', fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  errorTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  errorText: { fontSize: FontSize.base, textAlign: 'center' },
  backBtn: { paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md, borderRadius: Radius.md, marginTop: Spacing.lg },
  backBtnText: { color: '#FFFFFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
});
