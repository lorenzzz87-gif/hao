const messages: [RegExp, string][] = [
  [/permission denied|42501|authentication_required/i, 'Please sign in again and retry.'],
  [/profile_not_eligible/i, 'Finish setting up your profile before continuing.'],
  [/content_not_allowed|blocked content/i, 'That message contains language that is not allowed on HAO.'],
  [/report_rate_limited/i, 'You have sent several reports. Please try again later.'],
  [/network|load failed|failed to fetch/i, 'HAO could not connect. Check your internet connection and try again.'],
  [/invalid_coordinates/i, 'Choose a valid meeting area and try again.'],
  [/start_time/i, 'Choose a time between 10 minutes and 6 hours from now.'],
];

export function userFacingError(error: unknown, fallback = 'Something went wrong. Please try again.') {
  const raw = error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : String(error ?? '');
  return messages.find(([pattern]) => pattern.test(raw))?.[1] ?? fallback;
}

export function ageValidationErrorKey(error: unknown) {
  const raw = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error ?? '');
  if (/underage|must_be_18_or_older/i.test(raw)) return 'errors.underage';
  if (/invalid_birth_date|date\/time field value out of range|invalid input syntax for type date/i.test(raw)) return 'errors.invalidBirthDate';
  if (/birth_date_locked/i.test(raw)) return 'errors.birthDateLocked';
  return null;
}
