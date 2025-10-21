import { db } from '../db/database';

/**
 * Fix database by adding currentEnergy to existing userPrefs
 */
export const fixDatabaseSchema = async () => {
  try {
    const prefs = await db.userPrefs.get(1);
    if (prefs && !prefs.currentEnergy) {
      await db.userPrefs.update(1, {
        currentEnergy: 'Medium' as any
      });
      console.log('✓ Added currentEnergy field to userPrefs');
    }
  } catch (error) {
    console.error('Error fixing database:', error);
  }
};
