import { Check, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeSetting } from '../context/ThemeContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export const THEME_OPTIONS: { value: ThemeSetting; label: string; hint?: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System', hint: 'Dark 7 PM – 7 AM' },
];

/**
 * Theme button: shows a sun or moon for the theme in effect and opens a
 * Light / Dark / System menu. `tone="onDark"` is for navy or black bars;
 * `labels` adds the chosen setting's name beside the icon.
 */
export default function ThemeToggle({
  tone = 'default',
  labels = false,
  className,
}: {
  tone?: 'default' | 'onDark';
  labels?: boolean;
  className?: string;
}) {
  const { setting, theme, setSetting } = useTheme();
  const Icon = theme === 'dark' ? Moon : Sun;
  const current = THEME_OPTIONS.find((o) => o.value === setting)!;
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={`Theme: ${current.label}`}
        className={cn(
          'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[10px] text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
          labels ? 'px-3' : 'w-9',
          tone === 'onDark'
            ? 'bg-white/[0.08] text-white/80 ring-1 ring-inset ring-white/15 hover:bg-white/15 hover:text-white'
            : 'border border-border bg-card text-muted-foreground hover:text-foreground',
          className,
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        {labels && current.label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-44 rounded-xl p-1.5">
        {THEME_OPTIONS.map(({ value, label, hint }) => (
          <DropdownMenuItem
            key={value}
            onSelect={() => setSetting(value)}
            className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-[14px]"
          >
            <span className="flex-1">
              {label}
              {hint && <span className="block text-[11.5px] text-muted-foreground">{hint}</span>}
            </span>
            {setting === value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
