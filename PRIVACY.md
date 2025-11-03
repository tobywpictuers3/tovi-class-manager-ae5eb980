# מדיניות פרטיות - חשוב למפתחים!

## עקרונות יסוד
מערכת זו מיועדת לשמור על פרטיות מלאה של נתוני המשתמשים.
**אין נתונים שנשלחים לשרתי Lovable או כל גורם שלישי.**

## כללים שחובה לשמור עליהם:

### 1. Console Logs - אסור בהחלט!
❌ **אסור להשתמש ב:**
- `console.log()`
- `console.info()`
- `console.error()`
- `console.warn()`

✅ **במקום זאת השתמש ב:**
```typescript
import { logger } from '@/lib/logger';

logger.info('הודעה');  // עובד רק ב-development
logger.error('שגיאה'); // עובד רק ב-development
```

**למה?** Console logs נשלחים אוטומטית ל-Lovable בסביבת production וחושפים מידע פרטי!

### 2. הורדות אוטומטיות - אסורות!
❌ **אסור להוסיף:**
- Event listeners של `beforeunload`
- הורדות JSON אוטומטיות
- שמירות אוטומטיות למחשב המשתמש

✅ **מותר:**
- כפתורים ידניים להורדת גיבוי
- שמירה ידנית ב-BackupImport component
- שמירה ידנית ב-SaveButton component

### 3. אחסון נתונים
✅ **מותר ומומלץ:**
- שימוש ב-`localStorage` (מקומי לחלוטין)
- שמירה ל-Cloudflare Worker חיצוני (שלך בלבד)
- גיבויים ידניים למחשב המשתמש

❌ **אסור:**
- חיבור ל-Supabase
- חיבור ל-Lovable Cloud
- שליחת נתונים לכל API חיצוני ללא אישור מפורש

### 4. תקשורת רשת
כל התקשורת רשת מתבצעת **אך ורק** דרך:
- `src/lib/workerApi.ts` - Cloudflare Worker שלך
- Server 2 (אופציונלי, מוגדר על ידי המשתמש)

## ארכיטקטורת הפרטיות

```
┌─────────────────┐
│  דפדפן המשתמש   │
│   localStorage   │ ← נתונים מקומיים בלבד
└────────┬────────┘
         │
         ├─── שמירה ידנית (כפתור) → קובץ JSON מקומי
         │
         └─── שמירה ל-Worker חיצוני (שלך) → Dropbox
              (דרך workerApi.ts בלבד)

❌ אין חיבור ל-Lovable
❌ אין console logs ב-production
❌ אין הורדות אוטומטיות
```

## בדיקה לפני Deploy

לפני כל פרסום, וודא:
- [ ] אין שימוש ב-`console.*` בקוד החדש
- [ ] אין `beforeunload` listeners
- [ ] אין fetch/axios לשרתים לא מאושרים
- [ ] כל הלוגים משתמשים ב-`logger` מ-`@/lib/logger`

## דוגמאות

### ❌ לא נכון:
```typescript
console.log('התלמידה התחברה:', studentName); // נשלח ל-Lovable!
window.addEventListener('beforeunload', saveData); // הורדה אוטומטית!
```

### ✅ נכון:
```typescript
import { logger } from '@/lib/logger';
logger.info('התלמידה התחברה:', studentName); // רק ב-dev!

// הורדה ידנית בלבד דרך כפתור:
<Button onClick={downloadBackup}>הורד גיבוי</Button>
```

## שאלות נפוצות

**ש: איך אני יכול לבדוק שגיאות ב-production?**
ת: אין. זה המחיר של פרטיות מלאה. השתמש ב-development mode לבדיקות.

**ש: מה אם אני צריך לוג חשוב?**
ת: השתמש ב-`logger` - זה יעבוד ב-development. ב-production לא יהיו לוגים.

**ש: איך אני יודע שהנתונים באמת לא נשלחים?**
ת: פתח Developer Tools → Network tab. אתה אמור לראות רק קריאות ל-Worker שלך.

---

**עדכון אחרון:** נובמבר 2025
**גרסה:** 2.0 - מערכת אטומה לחלוטין
