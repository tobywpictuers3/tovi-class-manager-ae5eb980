

## תוכנית: תיקון טעינה + יישום עיצוב מלא

### שלב 0: תיקון חסימת הבנייה (קריטי)

**הבעיה:** `src/index.css` שורה 17 מייבאת `@import "./styles/site.css"` -- קובץ שלא קיים. זה מונע את בניית הפרויקט לחלוטין.

**פתרון:** מחיקת שורת ה-import. כל הטוקנים מגיעים מ-`toby.css` החיצוני (נטען דרך BrandProvider), ואין צורך בקובץ מקומי.

---

### שלב 1: דף הבית (Homepage.tsx)

1. **לוגו:** החלפת `TOBY_LOGO_3D_URL` ב-`ASSETS.logos.noBackground` (logonoreka), ממורכז ב-50% רוחב
2. **כרטיסי כניסה (מנהל + אזור אישי):** רקע `ASSETS.backgrounds.red`, פונט זהוב (`text-gold`), אפקט `.glow-gold`
3. **פרטי קשר:** רקע `ASSETS.backgrounds.gold`, פונט בורדו (`text-wine`)
4. **כניסת מפתחים:** הסרת `bg-card/60 backdrop-blur-md`, החלפה ב-`bg-background`
5. **חתימה (להשתמע):** שימור כ-Card רגיל עם ערכת נושא

---

### שלב 2: רקע pianoflute גלובלי (PageBackground.tsx -- קומפוננטה חדשה)

- קומפוננטה `fixed` ב-`z-0` מאחורי כל התוכן
- חלק תחתון: `ASSETS.hero.pianoFlute` עם `mask-image` fade מלמעלה
- חלק עליון: gradient עם נטיה לבורדו-יין
- משולב ב-`App.tsx`

---

### שלב 3: CSS חדש (index.css)

הוספת מחלקות:

```text
.glow-gold      -- box-shadow זהוב מסביב לקומפוננטות
.title-glow     -- text-shadow זהוב לכותרות דפים
.fade-slide-in  -- אנימציית כניסה לתוכן לשוניות
```

---

### שלב 4: דשבורד תלמידות (StudentDashboard.tsx)

1. **סדר לשוניות:** `practice` ראשונה (defaultValue), אח"כ `schedule`, ואז השאר
2. **הודעות:** `BroadcastMessageBanner` + `StarredMessagesBanner` בשורה אחת עם כפתור "הרחב"
3. **רקעי סקציות:** wrapper `BrandSection` עם רקעים לפי סדר: red -> gold -> ard -> lightGold
4. **כותרת:** הוספת `.title-glow`
5. **ThemeToggle:** הוספה לכותרת

---

### שלב 5: דשבורד מנהל (AdminDashboard.tsx)

1. **החלפת מחלקות `royal-*`** (שאינן קיימות) במחלקות מותג פעילות:
   - `royal-gradient` -> `musical-gradient`
   - `royal-card` -> `card-gradient card-shadow`
   - `royal-shadow` -> `card-shadow`
   - `text-royal-gold` -> `text-gold`
   - `royal-glow` -> `crown-glow`
   - `text-royal-text` -> `text-foreground`
   - `royal-tab` -> (הסרה, שימוש ב-default)
   - `border-royal-burgundy` / `text-royal-burgundy` -> `border-gold` / `text-wine`
   - `text-royal-white` / `hover:bg-royal-burgundy` -> `text-primary-foreground` / `hover:bg-destructive`
2. **רקעי סקציות:** אותו דפוס כמו דשבורד תלמידות (red -> gold -> ard -> lightGold)
3. **כותרת:** הוספת `.title-glow` + `ThemeToggle`
4. **מעברים:** `.fade-slide-in` על כל `TabsContent`

---

### קבצים

| פעולה | קובץ |
|-------|------|
| עריכה | `src/index.css` -- מחיקת import שבור + הוספת glow-gold, title-glow, fade-slide-in |
| עריכה | `src/pages/Homepage.tsx` -- לוגו, רקעים, צבעים |
| יצירה | `src/components/ui/PageBackground.tsx` -- רקע pianoflute גלובלי |
| עריכה | `src/App.tsx` -- שילוב PageBackground |
| עריכה | `src/pages/StudentDashboard.tsx` -- סדר לשוניות, הודעות, רקעים, כותרת |
| עריכה | `src/pages/AdminDashboard.tsx` -- החלפת royal-* classes, רקעים, כותרת |

