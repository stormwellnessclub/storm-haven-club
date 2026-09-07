export interface Department {
  id: string;
  label: string;
  /** CSS variable name holding an HSL triplet defined in index.css */
  token: string;
}

export const DEPARTMENTS: Department[] = [
  { id: 'front_desk', label: 'Front Desk', token: '--dept-front-desk' },
  { id: 'kids_care', label: 'Kids Care', token: '--dept-kids-care' },
  { id: 'cafe', label: 'Cafe', token: '--dept-cafe' },
  { id: 'assistant', label: "Storm's Assistant", token: '--dept-assistant' },
  { id: 'other', label: 'Other', token: '--dept-other' },
];

export const DEPARTMENT_IDS = DEPARTMENTS.map((d) => d.id);

export function getDepartment(id?: string | null): Department {
  return DEPARTMENTS.find((d) => d.id === id) ?? DEPARTMENTS[DEPARTMENTS.length - 1];
}

export function departmentLabel(id?: string | null): string {
  if (!id) return 'Unassigned';
  return getDepartment(id).label;
}

/** Inline style helpers so department colors stay themable via CSS variables. */
export function departmentBlockStyle(id?: string | null) {
  const t = getDepartment(id).token;
  return {
    backgroundColor: `hsl(var(${t}) / 0.16)`,
    borderColor: `hsl(var(${t}) / 0.55)`,
    color: `hsl(var(${t}))`,
  } as React.CSSProperties;
}

export function departmentDotStyle(id?: string | null) {
  return { backgroundColor: `hsl(var(${getDepartment(id).token}))` } as React.CSSProperties;
}
