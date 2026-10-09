import type { WellnessCheckIn } from '../types';
import { dailyFeeling, recentMoodDays } from '../wellness';

const ratings = (
  mood: WellnessCheckIn['mood'],
  stress: WellnessCheckIn['stress'],
  fatigue: WellnessCheckIn['fatigue'],
) => ({ mood, stress, fatigue });

test('overall feeling respects a low self-rated mood even when stress and fatigue are low', () => {
  expect(dailyFeeling(ratings(1, 1, 1))).toEqual({ label: 'Low mood', fish: 'sleepy' });
});

test('overall feeling treats a good mood with high stress as mixed', () => {
  expect(dailyFeeling(ratings(5, 5, 2))).toEqual({ label: 'Mixed day', fish: 'thinking' });
});

test('overall feeling responds to fatigue and all-around positive answers', () => {
  expect(dailyFeeling(ratings(3, 2, 5))).toEqual({ label: 'Tired day', fish: 'sleepy' });
  expect(dailyFeeling(ratings(5, 1, 1))).toEqual({ label: 'Feeling great', fish: 'proud' });
});

test('the mood chart leaves skipped calendar days empty', () => {
  const day = (date: number, mood: WellnessCheckIn['mood']): WellnessCheckIn => ({
    id: String(date),
    mood,
    stress: 3,
    fatigue: 3,
    createdAt: new Date(2026, 9, date, 12).toISOString(),
  });
  const days = recentMoodDays([day(10, 4), day(8, 2)]);
  expect(days.map(({ date, mood }) => [date.getDate(), mood])).toEqual([
    [4, null],
    [5, null],
    [6, null],
    [7, null],
    [8, 2],
    [9, null],
    [10, 4],
  ]);
});
