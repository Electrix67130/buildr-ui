import { useCallback, useMemo, useState } from 'react';
import type { NativeSyntheticEvent, TextInputSelectionChangeEventData } from 'react-native';
import { useMentionable } from '@/api/hooks/useMentionable';
import type { MentionableUser } from '@/api/types';
import {
  activeMentionQuery,
  insertMention,
  normalizeName,
  serializeMentions,
  toEditable,
  type MentionRef,
} from '@/utils/mentions';

type Selection = { start: number; end: number };

/**
 * Saisie d'un message avec mentions : taper « @ » propose les personnes qui
 * lisent le fil, en choisir une insere « @Prenom Nom », et l'envoi le
 * transforme en mention que l'API sait lire.
 */
export function useMentionComposer(chantierId: string | undefined, thread: 'comments' | 'emergency' = 'comments') {
  const [text, setText] = useState('');
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  // Position imposee au champ juste apres une insertion, rendue au champ ensuite.
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(undefined);
  const [mentions, setMentions] = useState<MentionRef[]>([]);
  const { data: people } = useMentionable(chantierId, thread);

  const active = selection.start === selection.end ? activeMentionQuery(text, selection.start) : null;

  const suggestions = useMemo(() => {
    if (!active || !people) return [];
    const query = normalizeName(active.query);
    return people.filter((p) => normalizeName(`${p.first_name} ${p.last_name}`).includes(query)).slice(0, 6);
  }, [active, people]);

  const pick = useCallback(
    (person: MentionableUser) => {
      if (!active) return;
      const name = `${person.first_name} ${person.last_name}`;
      const next = insertMention(text, active.start, selection.start, name);
      setText(next.text);
      const cursor = { start: next.cursor, end: next.cursor };
      setSelection(cursor);
      setForcedSelection(cursor);
      setMentions((current) => (current.some((m) => m.id === person.id) ? current : [...current, { id: person.id, name }]));
    },
    [active, text, selection.start],
  );

  const onSelectionChange = useCallback((e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSelection(e.nativeEvent.selection);
    setForcedSelection(undefined);
  }, []);

  /** Pour modifier un message existant : ses mentions restent des mentions. */
  const load = useCallback((content: string) => {
    const editable = toEditable(content);
    setText(editable.text);
    setMentions(editable.mentions);
  }, []);

  const reset = useCallback(() => {
    setText('');
    setMentions([]);
  }, []);

  /** Le texte a envoyer a l'API. */
  const serialize = useCallback(() => serializeMentions(text.trim(), mentions), [text, mentions]);

  return {
    text,
    suggestions,
    pick,
    load,
    reset,
    serialize,
    inputProps: { value: text, onChangeText: setText, onSelectionChange, selection: forcedSelection },
  };
}
