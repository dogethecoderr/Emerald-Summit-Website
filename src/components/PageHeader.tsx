import { type ReactNode } from 'react';

/** Eyebrow label + display title + supporting line, used atop every tab. */
export default function PageHeader({
  label,
  title,
  sub,
  actions,
}: {
  label: string;
  title: string;
  sub?: string;
  /** Optional right-aligned actions (buttons etc.). */
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="mb-1.5 text-sm text-muted-foreground">{label}</p>
        <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
          {title}
        </h1>
        {sub && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
            {sub}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
