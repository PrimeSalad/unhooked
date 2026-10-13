// Trial build settings. The APK stops working after TRIAL_DAYS from install, and in every case
// after TRIAL_HARD_EXPIRY, so reinstalling does not restart the clock past that date.

export const TRIAL_DAYS = 2;

/** Absolute cut-off for every trial install, no matter when it was installed. */
export const TRIAL_HARD_EXPIRY = '2026-10-27T00:00:00+08:00';

export const TRIAL_SITE_URL = 'https://unhooked-ochre.vercel.app';
