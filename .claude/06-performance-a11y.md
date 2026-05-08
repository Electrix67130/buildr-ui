# Performance & Accessibilite

## Performance

- `React.memo` sur les composants rendus dans des listes (FlatList)
- `useCallback` pour les handlers passes en props
- `useMemo` pour les calculs couteux
- `FlatList` pour les listes longues (pas ScrollView + .map())

## Accessibilite

Tous les elements interactifs doivent avoir :

```typescript
<TouchableOpacity
  accessibilityRole="button"
  accessibilityLabel="Creer un chantier"
  accessibilityHint="Ouvre le formulaire de creation"
>
```

### Roles courants

- `button` : boutons, FAB
- `link` : navigation
- `search` : barres de recherche
- `tab` : onglets
- `image` : images avec description
