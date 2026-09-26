import type { AgeSummary, PreferredAge } from '@/types/age-band';

export type PlanMember = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'creator' | 'member';
  common_interests?: number;
  phone_verified?: boolean;
  identity_verified?: boolean;
  successful_meets?: number;
};

export type PlanDetail = {
  id: string;
  creator_id: string | null;
  title: string;
  note: string | null;
  activity_type: string;
  starts_at: string;
  expected_end_at: string | null;
  status: 'draft' | 'open' | 'confirmed' | 'full' | 'started' | 'completed' | 'cancelled';
  min_participants: number;
  max_participants: number;
  joined_count: number;
  seats_remaining: number;
  is_joined: boolean;
  is_creator: boolean;
  preferred_age: PreferredAge;
  age_summary: AgeSummary | null;
  viewer_outside_preferred_age: boolean;
  venue: { id: string | null; name: string | null; address: string | null; latitude: number; longitude: number; is_public_place: boolean | null; is_approximate?: boolean };
  members: PlanMember[];
};
