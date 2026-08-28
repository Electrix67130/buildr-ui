import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { Spacing, Radius, FontSize, FontWeight, IconSize, Shadow } from '@/constants/Layout';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/contexts/I18nContext';
import { monthLabel, weekDayLabels } from '@/utils/calendar';

interface Props {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const getFirstDay = (y: number, m: number) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; };
const toDateStr = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const DateRangePicker: React.FC<Props> = ({ startDate, endDate, onChange }) => {
  const { t, locale } = useTranslation();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const [showPicker, setShowPicker] = useState(false);
  const [step, setStep] = useState<'start' | 'end'>('start');
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const today = new Date();
  const ref = tempStart ? new Date(tempStart) : today;
  const [viewYear, setViewYear] = useState(ref.getFullYear());
  const [viewMonth, setViewMonth] = useState(ref.getMonth());

  const formatDisplay = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const handleOpen = () => {
    setTempStart(startDate);
    setTempEnd(endDate);
    setStep('start');
    const r = startDate ? new Date(startDate) : today;
    setViewYear(r.getFullYear());
    setViewMonth(r.getMonth());
    setShowPicker(true);
  };

  const handleDayPress = (day: number) => {
    const dateStr = toDateStr(viewYear, viewMonth, day);
    if (step === 'start') {
      setTempStart(dateStr);
      setTempEnd('');
      setStep('end');
    } else {
      // If user picks a date before start, swap
      if (dateStr < tempStart) {
        setTempEnd(tempStart);
        setTempStart(dateStr);
      } else {
        setTempEnd(dateStr);
      }
      onChange(dateStr < tempStart ? dateStr : tempStart, dateStr < tempStart ? tempStart : dateStr);
      setShowPicker(false);
    }
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const weekDays = useMemo(() => weekDayLabels(locale), [locale]);

  // Build days grid
  const days = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDay(viewYear, viewMonth);
    const prevDays = getDaysInMonth(viewYear, viewMonth - 1);

    const result: { day: number; current: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) result.push({ day: prevDays - i, current: false });
    for (let i = 1; i <= daysInMonth; i++) result.push({ day: i, current: true });
    const remaining = 7 - (result.length % 7);
    if (remaining < 7) for (let i = 1; i <= remaining; i++) result.push({ day: i, current: false });
    return result;
  }, [viewYear, viewMonth]);

  // Check if a date is in the selected range
  const getDayState = (day: number, current: boolean) => {
    if (!current) return 'outside';
    const dateStr = toDateStr(viewYear, viewMonth, day);
    if (dateStr === tempStart && dateStr === tempEnd) return 'both';
    if (dateStr === tempStart) return 'start';
    if (dateStr === tempEnd) return 'end';
    if (tempStart && tempEnd && dateStr > tempStart && dateStr < tempEnd) return 'between';
    if (tempStart && !tempEnd && dateStr === tempStart) return 'start';
    return 'normal';
  };

  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>{t('chantier.dates')}</Text>
      <TouchableOpacity
        style={[styles.field, { backgroundColor: colors.itemBackground, borderColor: colors.border }]}
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={t('date.selectDates')}
      >
        <Text style={[styles.fieldText, { color: startDate || endDate ? colors.text : colors.placeholder }]}>
          {startDate || endDate
            ? `${formatDisplay(startDate)} → ${formatDisplay(endDate)}`
            : t('date.selectStartEnd')}
        </Text>
        <Calendar size={IconSize.md} color={colors.mutedText} />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowPicker(false)}>
          <View
            style={[styles.modal, { backgroundColor: colors.surface }, Shadow.lg]}
            onStartShouldSetResponder={() => true}
          >
            {/* Step indicator */}
            <Text style={[styles.stepText, { color: colors.primary }]}>
              {step === 'start' ? t('date.pickStart') : t('date.pickEnd')}
            </Text>

            {/* Month nav */}
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} accessibilityLabel={t('date.prevMonth')}>
                <Text style={[styles.navBtn, { color: colors.primary }]}>{'‹'}</Text>
              </TouchableOpacity>
              <Text style={[styles.monthYear, { color: colors.text }]}>
                {monthLabel(locale, viewYear, viewMonth)} {viewYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} accessibilityLabel={t('date.nextMonth')}>
                <Text style={[styles.navBtn, { color: colors.primary }]}>{'›'}</Text>
              </TouchableOpacity>
            </View>

            {/* Week days */}
            <View style={styles.weekRow}>
              {weekDays.map((d) => (
                <Text key={d} style={[styles.weekDay, { color: colors.mutedText }]}>{d}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.daysGrid}>
              {days.map((item, idx) => {
                const state = getDayState(item.day, item.current);
                const isEndpoint = state === 'start' || state === 'end' || state === 'both';
                const isBetween = state === 'between';

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayCell,
                      isBetween && { backgroundColor: colors.primary + '20' },
                      state === 'start' && { backgroundColor: colors.primary + '20', borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
                      state === 'end' && { backgroundColor: colors.primary + '20', borderTopRightRadius: 20, borderBottomRightRadius: 20 },
                      state === 'both' && { borderRadius: 20 },
                    ]}
                    onPress={() => item.current && handleDayPress(item.day)}
                    disabled={!item.current}
                  >
                    <View style={[
                      styles.dayInner,
                      isEndpoint && { backgroundColor: colors.primary, borderRadius: 20 },
                    ]}>
                      <Text style={[
                        styles.dayText,
                        {
                          color: isEndpoint
                            ? '#FFFFFF'
                            : item.current
                              ? isBetween ? colors.primary : colors.text
                              : colors.mutedText + '60',
                        },
                        isEndpoint && { fontWeight: FontWeight.bold },
                      ]}>
                        {item.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Selected range display */}
            {tempStart && (
              <View style={[styles.rangeDisplay, { borderTopColor: colors.border }]}>
                <View style={styles.rangeItem}>
                  <Text style={[styles.rangeLabel, { color: colors.mutedText }]}>{t('chantier.startDate')}</Text>
                  <Text style={[styles.rangeValue, { color: colors.text }]}>{formatDisplay(tempStart)}</Text>
                </View>
                {tempEnd ? (
                  <View style={styles.rangeItem}>
                    <Text style={[styles.rangeLabel, { color: colors.mutedText }]}>{t('chantier.endDate')}</Text>
                    <Text style={[styles.rangeValue, { color: colors.text }]}>{formatDisplay(tempEnd)}</Text>
                  </View>
                ) : (
                  <View style={styles.rangeItem}>
                    <Text style={[styles.rangeLabel, { color: colors.primary }]}>{t('date.chooseEnd')}</Text>
                  </View>
                )}
              </View>
            )}

          </View>
        </Pressable>
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
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  fieldText: { fontSize: FontSize.base, flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  modal: { width: 340, borderRadius: Radius.xl, padding: Spacing.xl },
  stepText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, textAlign: 'center', marginBottom: Spacing.md },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  navBtn: { fontSize: 28, fontWeight: FontWeight.bold, paddingHorizontal: Spacing.md },
  monthYear: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold },
  weekRow: { flexDirection: 'row', marginBottom: Spacing.xs },
  weekDay: { flex: 1, textAlign: 'center', fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayInner: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: FontSize.base },
  rangeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginTop: Spacing.md,
  },
  rangeItem: { alignItems: 'center' },
  rangeLabel: { fontSize: FontSize.xs },
  rangeValue: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, marginTop: 2 },
});

export default DateRangePicker;
