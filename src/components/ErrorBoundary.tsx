import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { reportError } from '@/api/errorReport';

/**
 * Filet de securite autour de l'application.
 *
 * Sans lui, une erreur de rendu laisse un **ecran blanc** : l'utilisateur n'a
 * aucun recours et toi aucune trace. Ici on remonte l'erreur dans error_log et
 * on propose de reessayer.
 *
 * Volontairement sans dependance a un contexte (theme, i18n, navigation) : si
 * l'un d'eux est la cause du plantage, l'ecran de secours doit quand meme
 * s'afficher. D'ou les couleurs en dur et le texte en francais.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // La pile de composants React reste lisible meme sur un bundle minifie :
    // c'est souvent elle qui permet de localiser l'ecran fautif.
    const componentStack = info.componentStack?.trim().split('\n')[0]?.trim();
    void reportError(error, { screen: componentStack || 'inconnu' });
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Une erreur est survenue</Text>
        <Text style={styles.body}>
          L&apos;application a rencontré un problème inattendu. Il a été signalé
          automatiquement.
        </Text>
        <Text style={styles.detail} numberOfLines={3}>
          {error.message}
        </Text>
        <TouchableOpacity style={styles.button} onPress={this.reset} accessibilityRole="button">
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1917',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  body: { color: '#D6D3D1', fontSize: 15, textAlign: 'center', lineHeight: 21 },
  detail: { color: '#A8A29E', fontSize: 12, textAlign: 'center', marginTop: 4 },
  button: {
    marginTop: 16,
    backgroundColor: '#D97706',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
