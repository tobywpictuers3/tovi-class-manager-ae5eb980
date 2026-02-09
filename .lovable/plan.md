

## תוכנית: עדכון עיצוב מקיף -- דף בית + דשבורדים

### סיכום
11 שינויים מרכזיים: החלפת לוגו, רקעים צבעוניים לקומפוננטות, אפקט זוהר זהוב, רקע pianoflute בתחתית כל הדפים, סדר לשוניות חדש בדשבורד, הודעות מצומצמות, ורקעי תמונה לקומפוננטות בדשבורדים.

---

### שלב 1: החלפת לוגו ל-logonoreka (סעיף 1)

**קובץ:** `src/pages/Homepage.tsx`

- החלפת `TOBY_LOGO_3D_URL` ב-`ASSETS.logos.noBackground` (מ-`@/brand/assets`)
- עדכון גם ב-`BrandSlots.logoHeader` (כבר מוגדר כ-`logonoreka`)

### שלב 2: לוגו ממורכז 50% רוחב בראש הפרישה (סעיף 2)

**קובץ:** `src/pages/Homepage.tsx`

- שינוי ה-`<img>` של הלוגו מ-`w-28 h-28 md:w-40 md:h-40` ל-`w-[50%]` עם `object-contain`
- הסרת גובה קבוע, הלוגו יתאים את הגובה לפי הרוחב

### שלב 3: כרטיסי כניסה -- רקע red + פונט זהב (סעיף 3)

**קובץ:** `src/pages/Homepage.tsx`

- הוספת `style={{ backgroundImage: url(${ASSETS.backgrounds.red}) }}` לשני כרטיסי הכניסה (מנהל + אזור אישי)
- `background-size: cover; background-position: center`
- שכבת-על חצי שקופה כהה (`bg-black/50`) לקריאות
- כל הטקסטים בכרטיסים: `text-gold` (צבע זהב מותג)
- כפתורים: מסגרת זהובה, טקסט זהוב

### שלב 4: קומפוננטת פרטי קשר -- רקע gold + פונט בורדו (סעיף 4)

**קובץ:** `src/pages/Homepage.tsx`

- רקע: `ASSETS.backgrounds.gold` כ-background-image
- שכבת-על בהירה לקריאות
- פונט: `text-wine` (בורדו מותג) לכל הטקסטים בקומפוננטה

### שלב 5: כניסת מפתחים -- ללא רקע חצי שקוף (סעיף 5)

**קובץ:** `src/pages/Homepage.tsx`

- הסרת `bg-card/60 backdrop-blur-md` מקומפוננטת כניסת מפתחים
- החלפה ב-`bg-background border-border` (מגיב לערכת נושא אוטומטית)

### שלב 6: אפקט זוהר זהוב סביב קומפוננטות כניסה (סעיף 6)

**קובץ:** `src/index.css`

- הוספת מחלקת `.glow-gold` עם `box-shadow` זהוב מנצנץ:
  ```
  .glow-gold {
    box-shadow: 0 0 15px rgba(230, 182, 92, 0.4),
                0 0 30px rgba(230, 182, 92, 0.2),
                0 0 45px rgba(230, 182, 92, 0.1);
  }
  ```
- החלת המחלקה על כרטיסי כניסת מנהל, אזור אישי ופרטי קשר

### שלב 7: pianoflute בחצי התחתון + מעבר בורדו למעלה (סעיף 7)

**קובץ:** `src/index.css` + קומפוננטה חדשה `src/components/ui/PageBackground.tsx`

יצירת קומפוננטת רקע גלובלית שמציגה:
- חלק עליון: רקע ערכת נושא עם נטיה לבורדו-יין (gradient)
- חלק תחתון: תמונת `pianoflute` עם fade-in מלמעלה (mask-image linear-gradient)
- הקומפוננטה תהיה `fixed` מאחורי התוכן (`z-0`)
- תשולב ב-`App.tsx` כך שתופיע בכל הדפים

```text
+----------------------------------+
|  רקע רגיל + שיפוע בורדו קל       |
|                                  |
|  ~~~ fade חלק ~~~                |
|                                  |
|  pianoflute.png (cover, bottom)  |
+----------------------------------+
```

### שלב 8: הודעות -- שורה אחת + לחצן הרחב (סעיף 7 מהמשתמשת)

**קובץ:** `src/pages/StudentDashboard.tsx`

- הודעות broadcast/starred: הצגת רק ההודעה הראשונה (slice(0,1))
- הוספת כפתור "הצג עוד" שמרחיב את כל ההודעות
- אותו שינוי גם ב-`AdminDashboard.tsx` אם רלוונטי

### שלב 9: סדר לשוניות חדש בדשבורד תלמידות (סעיף 8)

**קובץ:** `src/pages/StudentDashboard.tsx`

- שינוי `defaultValue` / `activeTab` ל-`"practice"` (מעקב אימונים ראשון)
- סידור לשוניות: מעקב אימונים -> מערכת שבועית -> שאר בסדר הנוכחי

### שלב 10: רקעי תמונה לקומפוננטות בדשבורד (סעיף 9)

**קבצים:** `src/pages/StudentDashboard.tsx`, `src/pages/AdminDashboard.tsx`

- קומפוננטה ראשונה (header/top): רקע `ASSETS.backgrounds.red`
- קומפוננטה שניה: רקע `ASSETS.backgrounds.gold`
- קומפוננטה שלישית: רקע `ASSETS.backgrounds.ard`
- קומפוננטה רביעית: רקע `ASSETS.backgrounds.lightGold`
- במצב כהה: 100% רוויה (opacity מלא)
- במצב בהיר: 40% רוויה (שכבת-על לבנה 60%)

מימוש: wrapper div עם inline style + שכבת-על מותנית theme

### שלב 11: הארה סביב כותרת דף + אפקטי מעבר (סעיפים 10-11)

**קבצים:** `src/index.css`, `src/pages/StudentDashboard.tsx`, `src/pages/AdminDashboard.tsx`

**הארת כותרת:**
- מחלקת `.title-glow` עם `text-shadow` זהוב
- החלה על כותרות הדפים הראשיים

**אפקטי מעבר בין עמודים:**
- הוספת אנימציית `fade-slide-in` ב-CSS
- עטיפת תוכן כל `TabsContent` באנימציה

---

### פרטים טכניים

#### קבצים חדשים:
1. `src/components/ui/PageBackground.tsx` -- רקע pianoflute גלובלי

#### קבצים לעדכון:
1. `src/index.css` -- מחלקות חדשות: `.glow-gold`, `.title-glow`, `.fade-slide-in`, רקע pianoflute
2. `src/pages/Homepage.tsx` -- לוגו, רקעים, צבעים, זוהר
3. `src/pages/StudentDashboard.tsx` -- סדר לשוניות, רקעים, כותרת, הודעות
4. `src/pages/AdminDashboard.tsx` -- רקעים, כותרת, החלפת royal-* classes
5. `src/App.tsx` -- שילוב PageBackground
6. `src/brand/assets.ts` -- ללא שינוי (כבר מוגדר נכון)

#### תלויות:
- אין תלויות חדשות (npm)
- כל התמונות מגיעות מ-ASSETS (brand/assets.ts)

#### בניית storybook error:
- קובץ `src/stories/AdminDashboard_REAL.stories.tsx` מייבא `@storybook/react` שלא מותקן -- שגיאה קיימת, לא קשורה לשינויים הנדרשים, ניתן להתעלם

