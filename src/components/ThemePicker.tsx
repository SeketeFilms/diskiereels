import { useTheme, THEMES, Theme } from '@/contexts/ThemeContext';
import { Check } from 'lucide-react';

const ThemePicker = () => {
  const { theme, setTheme } = useTheme();
  return (
    <div className="grid grid-cols-3 gap-2">
      {THEMES.map(t => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id as Theme)}
            className={`relative flex flex-col items-start gap-2 p-3 rounded-xl border-2 transition-all text-left ${
              active
                ? 'border-primary bg-primary/10 shadow-elevated'
                : 'border-border bg-card hover:border-primary/50'
            }`}
            aria-pressed={active}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-6 w-6 rounded-full border border-border/40"
                style={{ background: t.colors[0] }}
              />
              <span
                className="h-6 w-6 rounded-full border border-border/40"
                style={{ background: t.colors[1] }}
              />
            </div>
            <span className="text-xs font-semibold leading-tight">{t.name}</span>
            {active && (
              <Check className="absolute top-2 right-2 h-3.5 w-3.5 text-primary" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ThemePicker;
