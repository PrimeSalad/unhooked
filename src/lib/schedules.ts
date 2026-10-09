// Schedule presets for guards. "Set a time to stop scrolling" = Bedtime / Work hours.

import type { Schedule } from '@/domain/blocking';

export type PresetKey = 'always' | 'bedtime' | 'work' | 'evening';

export const SCHEDULE_PRESETS: { key: PresetKey; label: string; schedule: Schedule | null }[] = [
  { key: 'always', label: 'All day', schedule: null },
  { key: 'bedtime', label: 'Bedtime 10 PM–6 AM', schedule: { start: 22 * 60, end: 6 * 60 } },
  { key: 'evening', label: 'Evenings 7–11 PM', schedule: { start: 19 * 60, end: 23 * 60 } },
  { key: 'work', label: 'Work 9 AM–5 PM', schedule: { start: 9 * 60, end: 17 * 60 } },
];

export function presetFor(s: Schedule | null): PresetKey {
  return (
    SCHEDULE_PRESETS.find((p) =>
      p.schedule === null ? s === null : p.schedule.start === s?.start && p.schedule.end === s?.end,
    )?.key ?? 'always'
  );
}
