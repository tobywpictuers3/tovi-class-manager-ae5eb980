import { clearPracticeAndMedalData } from './storage';
import { logger } from './logger';

/**
 * This file is for one-time use to clear all practice and medal data.
 * After clearing, delete this file.
 * 
 * To use: Import and call clearAllPracticeData() from the console or from a component.
 */

export const clearAllPracticeData = () => {
  const confirmClear = window.confirm(
    '⚠️ האם את בטוחה שברצונך למחוק את כל נתוני האימונים והמדליות?\n\n' +
    'הפעולה תמחק:\n' +
    '✗ כל שיעורי האימון הרשומים\n' +
    '✗ כל ההישגים החודשיים\n' +
    '✗ כל המדליות שנצברו\n\n' +
    'פעולה זו לא ניתנת לביטול!'
  );

  if (confirmClear) {
    try {
      clearPracticeAndMedalData();
      logger.info('✅ All practice and medal data cleared successfully');
      alert('✅ הנתונים נמחקו בהצלחה!\n\nהדף יתרענן כעת.');
      window.location.reload();
    } catch (error) {
      logger.error('❌ Error clearing data:', error);
      alert('❌ אירעה שגיאה במחיקת הנתונים. נסי שוב.');
    }
  } else {
    logger.info('ℹ️ Data clear operation cancelled by user');
  }
};

// Automatically call on import (for easy console use)
// Uncomment the line below to auto-clear on import:
// clearAllPracticeData();
