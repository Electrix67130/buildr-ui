/**
 * Mentions dans les messages.
 *
 * Dans le texte envoye a l'API, une mention s'ecrit « @[Prenom Nom](id) » :
 * l'identifiant dit qui prevenir, le nom garde le message lisible meme la ou
 * les mentions ne sont pas interpretees. Dans le champ de saisie, on ne montre
 * que « @Prenom Nom » ; la correspondance nom → identifiant est gardee a part
 * et reappliquee a l'envoi.
 */

const MENTION_RE = /@\[([^\]\n]{1,100})\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export interface MentionRef {
  id: string;
  name: string;
}

export type MessageSegment = { type: 'text'; text: string } | { type: 'mention'; name: string; id: string };

/** Le message en morceaux : du texte, et des mentions a mettre en couleur. */
export function parseMentions(content: string): MessageSegment[] {
  const segments: MessageSegment[] = [];
  let last = 0;
  for (const match of content.matchAll(MENTION_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: 'text', text: content.slice(last, index) });
    segments.push({ type: 'mention', name: match[1], id: match[2].toLowerCase() });
    last = index + match[0].length;
  }
  if (last < content.length) segments.push({ type: 'text', text: content.slice(last) });
  return segments;
}

/** Le texte tel qu'on le lit : « @Prenom Nom » a la place de chaque mention. */
export function mentionsToText(content: string): string {
  return content.replace(MENTION_RE, (_all, name: string) => `@${name}`);
}

/** Pour modifier un message : le texte affichable, et les mentions qu'il contient. */
export function toEditable(content: string): { text: string; mentions: MentionRef[] } {
  const mentions: MentionRef[] = [];
  for (const segment of parseMentions(content)) {
    if (segment.type === 'mention' && !mentions.some((m) => m.id === segment.id)) {
      mentions.push({ id: segment.id, name: segment.name });
    }
  }
  return { text: mentionsToText(content), mentions };
}

/**
 * Le texte a envoyer : chaque « @Prenom Nom » choisi dans la liste redevient
 * une mention. Un nom efface ou modifie a la main n'est plus une mention — on
 * ne previent personne par erreur. Les noms les plus longs passent d'abord,
 * pour que « @Paul Martin » ne soit pas pris pour « @Paul » suivi de « Martin ».
 */
export function serializeMentions(text: string, mentions: MentionRef[]): string {
  const sorted = [...mentions].sort((a, b) => b.name.length - a.name.length);
  let out = '';
  let i = 0;
  while (i < text.length) {
    const found = text[i] === '@' ? sorted.find((m) => text.startsWith(`@${m.name}`, i)) : undefined;
    if (found) {
      out += `@[${found.name}](${found.id})`;
      i += found.name.length + 1;
    } else {
      out += text[i];
      i += 1;
    }
  }
  return out;
}

export function normalizeName(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * La mention en cours de saisie, juste avant le curseur : « @Pa » donne
 * `{ start, query: 'Pa' }`. Le « @ » doit ouvrir un mot (debut du texte ou
 * apres un espace) — sinon c'est une adresse e-mail. La recherche peut contenir
 * un espace (« @Paul Ma »), pas un retour a la ligne.
 */
export function activeMentionQuery(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.length > 40 || /[\n@]/.test(query) || query.startsWith(' ')) return null;
  return { start: at, query };
}

/** Remplace la saisie « @Pa » par « @Paul Martin », et place le curseur apres. */
export function insertMention(
  text: string,
  start: number,
  cursor: number,
  name: string,
): { text: string; cursor: number } {
  const inserted = `@${name} `;
  const after = text.slice(cursor).replace(/^ /, '');
  return { text: text.slice(0, start) + inserted + after, cursor: start + inserted.length };
}
