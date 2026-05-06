# SubMixer

אפליקציית **Electron + React + TypeScript** לניהול מסלולים בקובץ וידאו, כתוביות חיצוניות (SRT), תצוגה מקדימה אודיו-only, וייצוא דרך **FFmpeg** מהמערכת.

## דרישות

- [Node.js](https://nodejs.org/) (LTS מומלץ)
- **FFmpeg** ו־**FFprobe** זמינים ב־**PATH** של Windows (לא מוטמעים באפליקציה)

### התקנת FFmpeg ב-Windows

1. הורד build מומלץ (למשל [gyan.dev FFmpeg builds](https://www.gyan.dev/ffmpeg/builds/) — *full* או *essential* לפי הצורך).
2. חלץ לתיקייה קבועה, למשל `C:\ffmpeg`.
3. הוסף ל־**PATH** את תיקיית ה־`bin` (למשל `C:\ffmpeg\bin`).
4. פתח **PowerShell חדש** ובדוק:

   ```powershell
   ffmpeg -version
   ffprobe -version
   ```

אם הפקודות לא מזוהות, בדוק שהנתיב נוסף להגדרות המערכת **ואין** רווחים/גרשיים שגויים.

## פיתוח

```powershell
cd SubMixer
npm install
npm run dev
```

## בנייה ל-Windows

```powershell
npm run build
```

הפלטים (לפי `electron-builder.yml`) יופיעו בתיקייה `release/` — ייתכנו קובץ התקנה NSIS וגירסה portable.

הפרויקט מוגדר ל־**בנייה ללא חתימת קוד** (`forceCodeSigning` / `signAndEditExecutable`) כדי שלא יידרשו כלים של `winCodeSign` במחשב ביתי.

אם בנייה עדיין נכשלת עם `Cannot create symbolic link` בזמן חילוץ `winCodeSign`:

- הפעל **מצב מפתח** ב-Windows: **הגדרות → פרטיות ואבטחה → למפתחים → מצב מפתח** (מאפשר יצירת symlinks בלי הרשאות מנהל),  
  **או** הרץ את PowerShell **כמנהל** פעם אחת,  
  **או** מחק את התיקייה `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` ונסה שוב.

### אייקון מותאם (אופציונלי)

ניתן ליצור `build/icon.ico` ולהוסיף ב־`electron-builder.yml` תחת `win:` ו־`nsis:` את השורות `icon` / `installerIcon` / `uninstallerIcon` לפי התיעוד של electron-builder.

## הערות התנהגות

- **תצוגה מקדימה**: אודיו בלבד (ללא פריימי וידאו); חילוץ קטע באמצעות FFmpeg לתיקיית `userData`.
- **כתוביות**: קבצי טקסט/SRT נתמכים היטב; כתוביות תמונה (PGS) וכדומה דורשות טיפול נפרד ולא מובטח בכל הקונטיינרים.

## רישיון

פרטי זכויות — כפי שמופיעים ב־`package.json` / `electron-builder.yml`.
