import React, { useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet, Platform } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface ActionSheetOption {
  key: string;
  label: string;
  description?: string;
  icon?: React.ComponentType<{ size: number; color: string }>;
  /** Couleur du texte/icone — par defaut primary. 'destructive' = rouge. */
  variant?: 'default' | 'destructive';
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
  options: ActionSheetOption[];
  onClose: () => void;
}

export default function ActionSheet({ visible, title, subtitle, options, onClose }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  // Action mise en attente : on la declenche apres que le modal soit complete-
  // ment ferme (sinon iOS refuse d'ouvrir un autre modal natif comme la camera
  // ou le picker, et erreur silencieuse / "permission missing" trompeuse).
  const pendingActionRef = useRef<(() => void) | null>(null);

  const handlePress = (opt: ActionSheetOption) => {
    pendingActionRef.current = opt.onPress;
    onClose();
    // Fallback Android : pas de onDismiss fiable, on declenche apres l'anim.
    if (Platform.OS !== 'ios') {
      setTimeout(() => {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        action?.();
      }, 350);
    }
  };

  const handleDismiss = () => {
    // iOS : appele apres la fin de l'animation de fermeture du modal.
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? handleDismiss : undefined}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          {title ? <Text style={[styles.title, { color: colors.text }]}>{title}</Text> : null}
          {subtitle ? <Text style={[styles.subtitle, { color: colors.mutedText }]}>{subtitle}</Text> : null}

          {options.map((opt) => {
            const isDestructive = opt.variant === 'destructive';
            const accent = isDestructive ? colors.red : colors.primary;
            const Icon = opt.icon;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.option, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
                onPress={() => handlePress(opt)}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
              >
                {Icon ? (
                  <View style={[styles.iconBox, { backgroundColor: accent + '15' }]}>
                    <Icon size={IconSize.lg} color={accent} />
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: isDestructive ? colors.red : colors.text }]}>
                    {opt.label}
                  </Text>
                  {opt.description ? (
                    <Text style={[styles.desc, { color: colors.mutedText }]}>{opt.description}</Text>
                  ) : null}
                </View>
                <ChevronRight size={IconSize.md} color={colors.mutedText} />
              </TouchableOpacity>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.2)',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { fontSize: FontSize.sm, marginBottom: Spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  desc: { fontSize: FontSize.xs, marginTop: 2 },
});
