export type FormingGroup = {
  id: string;
  activityType: string;
  memberCount: number;
  startsAt: string;
  expiresAt: string;
  status: 'forming' | 'plan_created';
  planId: string | null;
  response: 'invited' | 'accepted';
};

export type FormingGroupRow = {
  id: string;
  activity_type: string;
  member_count: number;
  starts_at: string;
  expires_at: string;
  status: FormingGroup['status'];
  plan_id: string | null;
  response: FormingGroup['response'];
};

export function mapFormingGroup(row: FormingGroupRow | null): FormingGroup | null {
  if (!row) return null;
  return {
    id: row.id,
    activityType: row.activity_type,
    memberCount: Number(row.member_count),
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    status: row.status,
    planId: row.plan_id,
    response: row.response,
  };
}
