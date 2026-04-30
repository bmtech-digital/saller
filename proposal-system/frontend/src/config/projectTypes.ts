// Project Types
// Centralized definition of the project types the system supports.
// Each proposal and campaign is tagged with one of these.
// To add a new type later, add an entry here — UI and routing will pick it up.

import { Sparkles, Video, Users } from 'lucide-react';
import type { ComponentType } from 'react';

export type ProjectTypeId = 'influencers' | 'videos' | 'agents';

export interface ProjectType {
  id: ProjectTypeId;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const PROJECT_TYPES: ProjectType[] = [
  { id: 'influencers', label: 'משפיענים', icon: Sparkles },
  { id: 'videos', label: 'סרטונים', icon: Video },
  { id: 'agents', label: 'אייגנטים', icon: Users },
];

export const DEFAULT_PROJECT_TYPE: ProjectTypeId = 'influencers';

export const PROJECT_TYPE_BY_ID: Record<ProjectTypeId, ProjectType> = PROJECT_TYPES.reduce(
  (acc, t) => ({ ...acc, [t.id]: t }),
  {} as Record<ProjectTypeId, ProjectType>
);

export function getProjectTypeLabel(id: string | null | undefined): string {
  if (!id) return PROJECT_TYPE_BY_ID[DEFAULT_PROJECT_TYPE].label;
  return PROJECT_TYPE_BY_ID[id as ProjectTypeId]?.label ?? id;
}

export function isProjectType(value: string | null | undefined): value is ProjectTypeId {
  return !!value && value in PROJECT_TYPE_BY_ID;
}
