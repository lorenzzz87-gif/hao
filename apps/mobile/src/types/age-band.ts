export type AgeBand = '18_19' | '20s' | '30s' | '40s' | '50s' | '60_plus';
export type PreferredAge = 'any' | '18_24' | '25_34' | '35_44' | '45_plus';

export type AgeSummary =
  | { type: 'mostly'; band: AgeBand }
  | { type: 'range'; from: AgeBand; to: AgeBand };
