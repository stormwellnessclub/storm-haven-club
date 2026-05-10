export interface TeamMember {
  /** Stable key: user_id when present, else `ref:email` or `ref:placeholder:<id>` */
  key: string;
  user_id: string | null;
  email: string | null;
  name: string;
  group: 'Managers' | 'Front Desk' | 'Operations' | 'Instructors' | 'Therapists' | 'Other';
  roleLabels: string[];
  isPlaceholder?: boolean;
}
