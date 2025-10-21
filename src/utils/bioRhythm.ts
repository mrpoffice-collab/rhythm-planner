import { BioRhythmProfile, BioRhythmSegment, Energy } from '../db/database';

/**
 * Get bio-rhythm segments for a given profile preset
 */
export const getBioRhythmSegments = (profile: BioRhythmProfile): BioRhythmSegment[] => {
  switch (profile) {
    case 'Morning Peak':
      return [
        { startHour: 6, endHour: 10, energy: 'High' },
        { startHour: 10, endHour: 15, energy: 'Medium' },
        { startHour: 15, endHour: 18, energy: 'Low' },
        { startHour: 18, endHour: 24, energy: 'Low' }
      ];

    case 'Afternoon Peak':
      return [
        { startHour: 6, endHour: 11, energy: 'Medium' },
        { startHour: 11, endHour: 16, energy: 'High' },
        { startHour: 16, endHour: 19, energy: 'Medium' },
        { startHour: 19, endHour: 24, energy: 'Low' }
      ];

    case 'Evening Peak':
      return [
        { startHour: 6, endHour: 12, energy: 'Low' },
        { startHour: 12, endHour: 17, energy: 'Medium' },
        { startHour: 17, endHour: 21, energy: 'High' },
        { startHour: 21, endHour: 24, energy: 'Medium' }
      ];

    case 'Custom':
      return []; // Custom segments are stored in userPrefs.customBioRhythmSegments

    default:
      return getBioRhythmSegments('Morning Peak'); // Default fallback
  }
};

/**
 * Get current energy level based on bio-rhythm profile and time of day
 */
export const getEnergyAtTime = (
  hour: number,
  profile: BioRhythmProfile,
  customSegments?: BioRhythmSegment[]
): Energy => {
  const segments = profile === 'Custom' && customSegments && customSegments.length > 0
    ? customSegments
    : getBioRhythmSegments(profile);

  // Find the segment that contains the current hour
  for (const segment of segments) {
    if (hour >= segment.startHour && hour < segment.endHour) {
      return segment.energy;
    }
  }

  // Default to Medium if no segment matches
  return 'Medium';
};

/**
 * Calculate energy curve for the entire day
 * Returns an array of 24 energy levels (one per hour)
 */
export const calculateDailyEnergyCurve = (
  profile: BioRhythmProfile,
  customSegments?: BioRhythmSegment[]
): Energy[] => {
  const curve: Energy[] = [];

  for (let hour = 0; hour < 24; hour++) {
    curve.push(getEnergyAtTime(hour, profile, customSegments));
  }

  return curve;
};

/**
 * Log bio-rhythm application for debugging
 */
export const logBioRhythmApplied = (
  profile: BioRhythmProfile,
  energyCurve: Energy[]
): void => {
  // Count segments of each energy level
  const highCount = energyCurve.filter(e => e === 'High').length;
  const mediumCount = energyCurve.filter(e => e === 'Medium').length;
  const lowCount = energyCurve.filter(e => e === 'Low').length;

  const segments = `H:${highCount}/M:${mediumCount}/L:${lowCount}`;

  console.log(`BIO_RHYTHM_APPLIED profile:${profile} segments:${segments}`);
};
