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
};

