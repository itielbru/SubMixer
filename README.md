# SubMixer

אפליקציית **Electron + React + TypeScript** לניהול מסלולים בקובץ וידאו, כתוביות חיצוניות (SRT/VTT/ASS), תצוגה מקדימה אודיו-only, וייצוא דרך **FFmpeg**.

## הורדה

הגרסה האחרונה זמינה בעמוד ה-[**Releases**](https://github.com/itielbru/SubMixer/releases/latest):

- **`SubMixer-<version>-x64.exe`** — installer (NSIS)
- **`SubMixer-<version>-portable.exe`** — גרסה ניידת

> הבנייה אינה חתומה דיגיטלית כרגע, לכן Windows SmartScreen עשוי להציג אזהרה —
> לחצו **More info → Run anyway**.

## דרישות

- [Node.js](https://nodejs.org/) LTS
- **Windows** (יעד הבנייה)
- **FFmpeg** — מוטמע באפליקציה (מומלץ) או זמין ב-**PATH**

## התקנה

```powershell
cd SubMixer
npm install
npm run setup:ffmpeg   # מוריד ffmpeg.exe + ffprobe.exe ל-ffmpeg-bin/
npm run dev
```

`setup:ffmpeg` אופציונלי אם FFmpeg כבר מותקן ב-PATH.

## בנייה ל-Windows

```powershell
npm run setup:ffmpeg   # פעם אחת — נדרש לפני build אם אין FFmpeg ב-PATH
npm run build          # NSIS installer ב-release/
npm run build:portable # גרסה portable
```

ה-binaries מ-`ffmpeg-bin/` נארזים אוטומטית ל-installer דרך `electron-builder`.

## יכולות

- פתיחת וידאו (MKV, MP4, …) וניתוח מסלולים עם FFprobe
- כתוביות חיצוניות: **SRT**, **VTT**, **ASS/SSA** עם offset + speed
- ייצוא כתוביות מסונכרנות כ-SRT (בלי mux מלא)
- תצוגה מקדימה: וידאו + אודיו + עריכת תזמון כתוביות (טיימליין)
- ייצוא MKV/MP4 עם בחירת מסלולים
- ממשק **עברית / English** (הגדרות → שפת ממשק)
- ערכות נושא, היסטוריית ייצוא, drag & drop

## הערות

- **תצוגה מקדימה**: וידאו דרך Chromium; ל-AC3/DTS — חילוץ אוטומטי של ~90 שניות ראשונות לניגון מהיר, ואז אודיו מלא ברקע
- **כתוביות תמונה** (PGS וכד'): לא נתמכות כקובץ חיצוני
- תיקיית `ffmpeg/` בשורש (אם קיימת) היא קוד מקור FFmpeg — **לא** בשימוש; השתמש ב-`ffmpeg-bin/`

## פרטיות

SubMixer לא אוסף ולא שולח נתוני שימוש. לוגים נשמרים מקומית בלבד
(`userData/logs/`). בגרסה ארוזה, בדיקת עדכונים פונה ל-GitHub Releases.

## רישיון

תוכנה **חופשית וקוד פתוח** — רישיון **MIT** (ראה `LICENSE`).
SubMixer אורז את **FFmpeg** (GPLv3) ומריץ אותו כתהליך נפרד; ראה
`THIRD-PARTY-LICENSES.md` לייחוס ולרישיונות צד-שלישי.
