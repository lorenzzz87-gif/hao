import type { AgeSummary, PreferredAge } from '@/types/age-band';

export type NearbyPlan = {
  id: string;
  title: string;
  activityType: string;
  startsAt: string;
  venueId: string | null;
  latitude: number;
  longitude: number;
  distanceM: number;
  joinedCount: number;
  maxParticipants: number;
  status: 'open' | 'confirmed' | 'full';
  score: number;
  preferredAge: PreferredAge;
  ageSummary: AgeSummary | null;
  viewerOutsidePreferredAge: boolean;
};
