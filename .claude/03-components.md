# Composants — Patterns

## Structure standard

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, FontSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  title: string;
  onPress?: () => void;
}

const MyComponent: React.FC<Props> = ({ title, onPress }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: Spacing.lg },
  title: { fontSize: FontSize.lg },
});

export default MyComponent;
```

## Regles

- Props typees avec `interface` (pas inline)
- StyleSheet en bas du fichier
- Pas de style inline sauf pour les couleurs dynamiques
- `SafeAreaView` pour tous les screens
- `KeyboardAvoidingView` pour les formulaires
- `FlatList` pour les listes longues (pas `ScrollView` + `.map()`)
