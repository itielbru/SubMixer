import type { AppSettings } from '@shared/types';

export const ACCENTS: Record<AppSettings['accent'], { name: string; hex: string }> = {
  indigo: { name: 'אינדיגו', hex: '#5b6cf2' },
  graphite: { name: 'גרפיט', hex: '#3a3a3a' },
  emerald: { name: 'אמרלד', hex: '#0f9b6e' },
  amber: { name: 'ענברי', hex: '#c97a1a' },
  crimson: { name: 'ארגמן', hex: '#d14e6b' },
};

export function applyTheme(
  s: Pick<AppSettings, 'theme' | 'accent' | 'font'>,
  resolvedTheme?: 'dark' | 'light'
): void {
  const a = ACCENTS[s.accent] || ACCENTS.indigo;
  const root = document.documentElement;
  const effective = resolvedTheme ?? (s.theme === 'system' ? 'dark' : s.theme);
  const isDark = effective === 'dark';
  const tokens: Record<string, string> = isDark
    ? {
        '--bg': '#0d0e11',
        '--bg-2': '#15161b',
        '--surface': '#1a1c22',
        '--surface-2': '#22242c',
        '--border': '#2a2c34',
        '--border-2': '#383a44',
        '--text': '#ececef',
        '--text-2': '#b0b1b8',
        '--text-3': '#71727a',
        '--accent': a.hex,
        '--accent-soft': a.hex + '26',
        '--accent-fg': '#ffffff',
        '--ok': '#48c08a',
        '--warn': '#e8a24a',
        '--danger': '#e87171',
      }
    : {
        '--bg': '#f6f5f1',
        '--bg-2': '#ecebe5',
        '--surface': '#ffffff',
        '--surface-2': '#faf9f5',
        '--border': '#e8e6df',
        '--border-2': '#d6d3ca',
        '--text': '#1a1a1c',
        '--text-2': '#5b5c63',
        '--text-3': '#9a9ba2',
        '--accent': a.hex,
        '--accent-soft': a.hex + '1a',
        '--accent-fg': '#ffffff',
        '--ok': '#1f8c5f',
        '--warn': '#b76d10',
        '--danger': '#c8484a',
      };
  for (const k in tokens) root.style.setProperty(k, tokens[k]);
  root.style.setProperty('--font', `"${s.font}", "Assistant", "Heebo", system-ui, sans-serif`);
  root.style.setProperty('--mono', `"JetBrains Mono", "Menlo", monospace`);
  document.body.style.background = tokens['--bg'];
}
