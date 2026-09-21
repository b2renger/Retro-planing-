/**
 * Resolving a task's `assigneeId` to a person.
 *
 * The rule that matters: an id that matches nobody is **Unassigned**, never "the first person in the
 * list". Falling back to a real member made a removed collaborator's tasks look like they belonged
 * to whoever happened to sort first — the reader had no way to tell.
 */
import type { User } from '../types';

export interface AssigneeLabel {
  /** The member's name, or `Unassigned`. */
  name: string;
  /** Avatar URL, or `null` when there is nobody to show. */
  avatar: string | null;
  /** False when the id matched no current member (including the empty id). */
  known: boolean;
}

export const UNASSIGNED: AssigneeLabel = { name: 'Unassigned', avatar: null, known: false };

/** The member behind `userId`, or `UNASSIGNED`. */
export function resolveAssignee(userId: string | undefined | null, members: readonly User[]): AssigneeLabel {
  if (!userId) return UNASSIGNED;
  const member = members.find((u) => u.id === userId);
  if (!member) return UNASSIGNED;
  return { name: member.name, avatar: member.avatar, known: true };
}

/** First name for a compact chip; `Unassigned` stays whole. */
export function shortAssigneeName(label: AssigneeLabel): string {
  return label.known ? (label.name.split(' ')[0] ?? label.name) : label.name;
}
