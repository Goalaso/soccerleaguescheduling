export const NOTIFICATION_TYPES = {
  SEASON_AVAILABILITY_REQUEST: 'season_availability_request',
  MATCH_NEEDS_SCORE: 'match_needs_score',
  // Purely informational (a season-long roster add/remove/move) — no
  // resolving action for the player to take, so it's deliberately not in
  // ACTIONABLE_NOTIFICATION_TYPES below and keeps normal mark-read/delete.
  TEAM_ROSTER_CHANGED: 'team_roster_changed',
  // Follow-up to responding "yes" on a season_availability_request, once
  // the FCFS capacity check resolves — also purely informational.
  SEASON_CONFIRMED: 'season_confirmed',
  SEASON_WAITLISTED: 'season_waitlisted',
};

// Types here resolve only through their own action (responding to an
// availability request, submitting a score) — never through a manual
// mark-as-read/delete, so the notification can't be dismissed without
// actually being handled. Adding a future actionable type is a one-line
// addition here; anything not listed keeps the default mark-read/delete
// controls.
export const ACTIONABLE_NOTIFICATION_TYPES = [
  NOTIFICATION_TYPES.SEASON_AVAILABILITY_REQUEST,
  NOTIFICATION_TYPES.MATCH_NEEDS_SCORE,
];
