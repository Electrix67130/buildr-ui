# Style & Theme

## Theme

```typescript
const colorScheme = useColorScheme(); // 'light' | 'dark'
const colors = Colors[colorScheme];
```

## Palette BTP

- **Primary** : Amber/Orange (`#D97706` light, `#F59E0B` dark)
- **Neutral** : Stone (`#FAFAF9` light bg, `#1C1917` dark bg)
- **Status chantier** :
  - A venir : Bleu (`#2563EB` / `#60A5FA`)
  - En cours : Amber (`#D97706` / `#FBBF24`)
  - Termine : Vert (`#16A34A` / `#4ADE80`)

## Design Tokens

**Jamais de magic numbers** dans les StyleSheets.

- `Spacing` : xs(4), sm(8), md(12), lg(16), xl(20), xxl(24), xxxl(32)
- `Radius` : xs(4), sm(8), md(10), lg(12), xl(16), xxl(20), round(25), pill(30)
- `FontSize` : xs(11) → hero(32)
- `FontWeight` : light(300) → bold(700)
- `Shadow` : sm, md, lg
- `IconSize` : sm(16) → xxl(32)
- `AvatarSize` : sm(32) → xl(60)
