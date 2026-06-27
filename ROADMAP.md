# SubMixer — Roadmap

מסמך זה מתאר את כיווני ההתפתחות של SubMixer. הפרויקט כבר בוגר (CI מלא, טסטים,
אבטחת Electron, auto-update, i18n), ולכן ה-roadmap מתמקד בהעלאת המוצר לשלב הבא:
ממכשיר אישי ל-Windows למוצר open-source מופץ, אמין ורחב-יכולות.

המשימות מחולקות לשלושה גלים לפי סדר תלויות: בריאות-קוד תחילה (מאפשרת שינוי בטוח),
אחר-כך הפצה, ואז הרחבת יכולות.

סטטוס: ✅ הושלם · 🟡 חלקי · ⬜ מתוכנן · 🔑 דורש credentials תפעוליים

---

## Wave 1 — בריאות קוד ותשתית בטיחות

| # | פריט | סטטוס |
| - | ---- | ----- |
| 1.1 | פירוק `App.tsx` ל-hooks ייעודיים (god-component של ~1400 שורות) | 🟡 התחיל — `buildPlan` חולץ ל-`src/shared/export-plan.ts` |
| 1.2 | כיסוי טסטים ללוגיקת הייצוא + אכיפת coverage thresholds | ✅ `export-plan`, `video-encode`, `path` נבדקים; thresholds ב-`vitest.config.ts` |
| 1.3 | איחוד צורת תגובות IPC ל-union type + ריכוז constants קשיחים | ⬜ |

## Wave 2 — הפצה ואמון

| # | פריט | סטטוס |
| - | ---- | ----- |
| 2.1 | חתימה דיגיטלית (Windows) + ביטול אזהרת SmartScreen | 🔑 config + תיעוד מוכנים (`docs/RELEASING.md`); נדרש cert |
| 2.2 | תמיכת macOS + Linux (setup, discovery, builder, scripts) | ✅ סקריפט/builder/scripts; 🔑 notarization דורש Apple ID |
| 2.3 | Dependabot + audit ב-CI + אימות חתימה ב-auto-update | ✅ Dependabot + audit job; אימות חתימה אחרי 2.1 |

## Wave 3 — הרחבת פיצ'רים וביצועי ייצוא

| # | פריט | סטטוס |
| - | ---- | ----- |
| 3.1 | האצת חומרה (NVENC/QSV/AMF/VideoToolbox) + בקרת איכות ל-burn-in | ✅ |
| 3.2 | סנכרון כתוביות אוטומטי לפי אנרגיית אודיו | ⬜ |
| 3.3 | הורדת כתוביות (OpenSubtitles) + שימור styling של ASS | 🔑 דורש מפתח API |
| 3.4 | מקשי קיצור הניתנים להתאמה, שפות i18n נוספות, גרירת תיקייה | ⬜ |

---

## מה שכבר חזק (בסיס יציב — לא נוגעים)

- ליבת FFmpeg: probe, export, peaks, error parsing (`src/main/ffmpeg.ts`)
- פרסור SRT/VTT/ASS + זיהוי encoding (`src/main/srt.ts`)
- עריכת cues מלאה: undo/redo מאוחד, split/merge/duplicate, visual-sync
- batch queue, history + re-export, drag&drop, התראות מערכת
- אבטחה: contextIsolation, CSP נוקשה, IPC input validation

## אימות

לכל שינוי: `npm run typecheck`, `npm run lint`, `npm test` (עם coverage thresholds),
`npm run test:e2e`. שינויי הפצה מאומתים דרך `npm run build` / `build:mac` /
`build:linux` ב-CI. ראו `docs/RELEASING.md` לתהליך השחרור המלא.
