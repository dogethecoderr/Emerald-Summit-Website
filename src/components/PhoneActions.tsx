// A mobile number with the app's contact actions (volunteer_contact.dart):
// copy it ("Number copied"), Call and Text. Call and Text open the device's
// phone or messages app through tel: and sms: links.
import { toast } from 'sonner';
import { Copy, MessageSquare, Phone } from '@/components/icons';
import { cn } from '@/lib/utils';

/** Digits and a leading +, as the app dials. */
export const dialable = (phone: string) => phone.replace(/[^0-9+]/g, '');

export default function PhoneActions({ phone, compact = false, className }: { phone: string; compact?: boolean; className?: string }) {
  const dial = dialable(phone);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      toast('Number copied');
    } catch {
      toast.error("Couldn't copy the number.");
    }
  };
  const link = compact
    ? 'inline-flex items-center gap-1 text-xs font-medium text-emerald hover:underline'
    : 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-semibold text-emerald hover:bg-muted/60';

  return (
    <div className={cn(compact ? 'flex flex-wrap items-center gap-x-3 gap-y-1' : 'space-y-2', className)}>
      <div className="flex items-center gap-1.5">
        <span className={compact ? 'text-xs' : 'text-sm font-medium'}>{phone}</span>
        <button type="button" onClick={() => void copy()} aria-label="Copy number" title="Copy number" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
          <Copy className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </button>
      </div>
      {dial && (
        <div className={cn('flex gap-2', compact && 'gap-3')}>
          <a href={`tel:${dial}`} className={link}><Phone className={compact ? 'h-3 w-3' : 'h-4 w-4'} /> Call</a>
          <a href={`sms:${dial}`} className={link}><MessageSquare className={compact ? 'h-3 w-3' : 'h-4 w-4'} /> Text</a>
        </div>
      )}
    </div>
  );
}
