import { describe, expect, it } from 'vitest';
import { resolveAssignee, shortAssigneeName, UNASSIGNED } from './assignee';
import type { User } from '../types';

const member = (id: string, name: string): User => ({
  id,
  name,
  email: `${id}@example.test`,
  avatar: `avatar-${id}`,
  role: 'Designer',
  color: '#3B82F6',
  status: 'active',
});

const MEMBERS = [member('u-1', 'Ada Lovelace'), member('u-2', 'Grace Hopper')];

describe('resolveAssignee', () => {
  it('finds the member behind the id', () => {
    expect(resolveAssignee('u-2', MEMBERS)).toEqual({ name: 'Grace Hopper', avatar: 'avatar-u-2', known: true });
  });

  it('is Unassigned for an id nobody has — not the first member', () => {
    expect(resolveAssignee('u-removed', MEMBERS)).toEqual(UNASSIGNED);
    expect(resolveAssignee('u-removed', MEMBERS).name).not.toBe('Ada Lovelace');
  });

  it('is Unassigned for an empty or missing id', () => {
    expect(resolveAssignee('', MEMBERS)).toEqual(UNASSIGNED);
    expect(resolveAssignee(undefined, MEMBERS)).toEqual(UNASSIGNED);
    expect(resolveAssignee(null, MEMBERS)).toEqual(UNASSIGNED);
  });

  it('is Unassigned when there are no members at all', () => {
    expect(resolveAssignee('u-1', [])).toEqual(UNASSIGNED);
  });

  it('shows no avatar when there is nobody', () => {
    expect(resolveAssignee('u-removed', MEMBERS).avatar).toBeNull();
  });
});

describe('shortAssigneeName', () => {
  it('uses the first name of a known member', () => {
    expect(shortAssigneeName(resolveAssignee('u-1', MEMBERS))).toBe('Ada');
  });

  it('keeps "Unassigned" whole', () => {
    expect(shortAssigneeName(UNASSIGNED)).toBe('Unassigned');
  });
});
