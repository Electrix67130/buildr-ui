import { useTheme } from '@/contexts/ThemeContext';

export function useColorScheme() {
  return useTheme().scheme;
}
