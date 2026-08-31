import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/Layout';
import BuildrLogo from '@/components/BuildrLogo';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Props {
  children?: React.ReactNode;
}

const AppHeader: React.FC<Props> = ({ children }) => {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <BuildrLogo size={30} showText={false} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
});

export default React.memo(AppHeader);
