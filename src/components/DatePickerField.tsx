import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { Calendar, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { monthLabel, weekDayLabels } from '@/utils/calendar';

interface Props {
  label: string;
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
}

const DatePickerField: React.FC<Props> = ({ label, value, onChange, placeholder }) => {
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [showPicker, setShowPicker] = useState(false);

  const today = new Date();
  const parsedValue = value ? new Date(value) : null;
  const [viewYear, setViewYear] = useState(parsedValue?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedValue?.getMonth() ?? today.getMonth());

  const formatDisplay = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Monday = 0
  };

  const handleSelectDay = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(dateStr);
    setShowPicker(false);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1);

  const days: { day: number; current: boolean }[] = [];
  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    days.push({ day: prevMonthDays - i, current: false });
  }
  // Current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ day: i, current: true });
  }
  // Next month leading days (fill to complete last row)
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, current: false });
    }
  }

  const selectedDay = parsedValue && parsedValue.getFullYear() === viewYear && parsedValue.getMonth() === viewMonth
    ? parsedValue.getDate() : null;

  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
        onPress={() => setShowPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.fieldText, { color: value ? colors.text : colors.placeholder }]}>
          {value ? formatDisplay(value) : placeholder ?? t('date.selectDate')}
        </Text>
        <Calendar size={IconSize.md} color={colors.mutedText} />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }, Shadow.lg]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={prevMonth} accessibilityRole="button" accessibilityLabel={t('date.prevMonth')}>
                <Text style={[styles.navBtn, { color: colors.primary }]}>{'<'}</Text>
              </TouchableOpacity>
              <Text style={[styles.monthYear, { color: colors.text }]}>
                {monthLabel(locale, viewYear, viewMonth)} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} accessibilityRole="button" accessibilityLabel={t('date.nextMonth')}>
                <Text style={[styles.navBtn, { color: colors.primary }]}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            {/* Day names */}
            <View style={styles.weekRow}>
              {weekDayLabels(locale).map((d) => (
                <Text key={d} style={[styles.weekDay, { color: colors.mutedText }]}>{d}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.daysGrid}>
              {days.map((item, idx) => {
                const isSelected = item.current && item.day === selectedDay;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: colors.primary, borderRadius: 20 },
                    ]}
                    onPress={() => item.current && handleSelectDay(item.day)}
                    disabled={!item.current}
                    accessibilityRole="button"
                    accessibilityLabel={
                      item.current
                        ? new Date(viewYear, viewMonth, item.day).toLocaleDateString(locale, {
                            day: 'numeric',
                            month: 'long',
                          })
                        : undefined
                    }
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: isSelected ? '#FFFFFF' : item.current ? colors.text : colors.mutedText + '60' },
                      ]}
                    >
                      {item.day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Close */}
            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: colors.border }]}
              onPress={() => setShowPicker(false)}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
            >
              <Text style={[styles.closeBtnText, { color: colors.text2 }]}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  label: { fontSize: FontSize.base, fontWeight: FontWeight.medium, marginTop: Spacing.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.md,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  fieldText: { fontSize: FontSize.base },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { width: 320, borderRadius: Radius.xl, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  navBtn: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.md },
  monthYear: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  weekRow: { flexDirection: 'row', marginBottom: Spacing.sm },
  weekDay: { flex: 1, textAlign: 'center', fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: FontSize.base },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
    borderTopWidth: 1,
  },
  closeBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
});

export default DatePickerField;
