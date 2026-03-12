import { describe, it, expect } from 'vitest';
import { getProjectDisplayName, Project } from './project.model';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'My Project',
    rate: '',
    color: '#000',
    archived: false,
    order: 0,
    ...overrides,
  };
}

describe('getProjectDisplayName', () => {
  it('returns shortName when available', () => {
    expect(getProjectDisplayName(project({ shortName: 'MP' }))).toBe('MP');
  });

  it('returns name/rate when rate is set but no shortName', () => {
    expect(getProjectDisplayName(project({ rate: 'A1' }))).toBe('My Project/A1');
  });

  it('returns name when no shortName and no rate', () => {
    expect(getProjectDisplayName(project())).toBe('My Project');
  });

  it('prefers shortName over rate', () => {
    expect(getProjectDisplayName(project({ shortName: 'MP', rate: 'A1' }))).toBe('MP');
  });
});
