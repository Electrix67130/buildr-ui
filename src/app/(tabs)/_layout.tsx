import React from 'react';
import { Tabs } from 'expo-router';
import { HardHat, Users, Archive, UserCircle } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { IconSize } from '@/constants/Layout';
import { useTranslation } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const { t } = useTranslation();
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.chantiers'),
          tabBarIcon: ({ color }) => <HardHat size={IconSize.lg} color={color} />,
        }}
      />
      <Tabs.Screen
        name="collaborateurs"
        options={{
          title: t('tabs.team'),
          tabBarIcon: ({ color }) => <Users size={IconSize.lg} color={color} />,
          href: isClient ? null : '/(tabs)/collaborateurs',
        }}
      />
      <Tabs.Screen
        name="archives"
        options={{
          title: t('tabs.archives'),
          tabBarIcon: ({ color }) => <Archive size={IconSize.lg} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <UserCircle size={IconSize.lg} color={color} />,
        }}
      />
    </Tabs>
  );
}
