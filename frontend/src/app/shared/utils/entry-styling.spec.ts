import { describe, it, expect } from 'vitest';
import { getEntryColor, getEntryBg, getEntryTextColor, getProject } from './entry-styling';
import { TimeEntry } from '../../domain/models/time-entry.model';
import { Project } from '../../domain/models/project.model';

const project: Project = {
  id: 'p1',
  name: 'Test Project',
  rate: '',
  color: '#FF0000',
  archived: false,
  favorite: false,
  ignored: false,
  billable: true,
  order: 0,
};

const projectMap = new Map<string, Project>([['p1', project]]);

function makeEntry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'e1',
    title: 'Test',
    start: new Date(),
    end: new Date(),
    source: 'manual',
    ...overrides,
  };
}

describe('getEntryColor', () => {
  it('returns gray for pause entries', () => {
    expect(getEntryColor(makeEntry({ pause: true }), projectMap)).toBe('#9CA3AF');
  });

  it('returns project color when entry has projectId', () => {
    expect(getEntryColor(makeEntry({ projectId: 'p1' }), projectMap)).toBe('#FF0000');
  });

  it('returns default indigo when no project', () => {
    expect(getEntryColor(makeEntry(), projectMap)).toBe('#6366F1');
  });

  it('returns default indigo when projectId not in map', () => {
    expect(getEntryColor(makeEntry({ projectId: 'unknown' }), projectMap)).toBe('#6366F1');
  });
});

describe('getEntryBg', () => {
  it('returns semi-transparent gray for pause', () => {
    expect(getEntryBg(makeEntry({ pause: true }), projectMap)).toBe('#F3F4F660');
  });

  it('returns project color with 18 opacity suffix', () => {
    expect(getEntryBg(makeEntry({ projectId: 'p1' }), projectMap)).toBe('#FF000018');
  });
});

describe('getEntryTextColor', () => {
  it('returns gray text for pause', () => {
    expect(getEntryTextColor(makeEntry({ pause: true }), projectMap)).toBe('#6B7280');
  });

  it('returns project color for normal entries', () => {
    expect(getEntryTextColor(makeEntry({ projectId: 'p1' }), projectMap)).toBe('#FF0000');
  });
});

describe('getProject', () => {
  it('returns project when found', () => {
    expect(getProject(makeEntry({ projectId: 'p1' }), projectMap)).toBe(project);
  });

  it('returns null when no projectId', () => {
    expect(getProject(makeEntry(), projectMap)).toBeNull();
  });

  it('returns null when projectId not in map', () => {
    expect(getProject(makeEntry({ projectId: 'unknown' }), projectMap)).toBeNull();
  });
});
