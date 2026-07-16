import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'luminous-moss' | 'tiffany' | 'diskie-green';

export const THEMES: { id: Theme; name: string; colors: [string, string]; description: string }[] = [
  { id: 'tiffany', name: 'Tiffany', colors: ['#0a0a0a', '#2dd4bf'], description: 'Dark + teal' },
  { id: 'luminous-moss', name: 'Luminous Moss', colors: ['#0a0a0a', '#22c55e'], description: 'Dark + vivid green' },
  { id: 'diskie-green', name: 'Diskie Green', colors: ['#ffffff', '#16a34a'], description: 'Light + green' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isValidTheme = (t: string | null): t is Theme =>
  t === 'luminous-moss' || t === 'tiffany' || t === 'diskie-green';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    // migrate old values
    if (stored === 'dark') return 'luminous-moss';
    if (stored === 'bright') return 'diskie-green';
    return isValidTheme(stored) ? stored : 'luminous-moss';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'bright', 'luminous-moss', 'tiffany', 'diskie-green');
    root.classList.add(theme);
    // Dark themes also get `.dark` so shadcn dark utilities work
    if (theme === 'luminous-moss' || theme === 'tiffany') {
      root.classList.add('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => {
    setThemeState(prev => {
      const order: Theme[] = ['luminous-moss', 'tiffany', 'diskie-green'];
      return order[(order.indexOf(prev) + 1) % order.length];
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
