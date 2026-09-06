import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Check,
  Sparkles,
  QrCode,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { roleByName, USER_ROLES } from '../models/roles';
import type { Profile } from '../services/auth';
import { cn } from '@/lib/utils';

export interface QrPassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional profile override for testing or prop injection */
  profile?: Partial<Profile> | null;
}

function useSafeAuth() {
  try {
    return useAuth();
  } catch {
    return {
      session: null,
      profile: null,
      loadingProfile: false,
      refreshProfile: async () => {},
    };
  }
}

export default function QrPassModal({
  open,
  onOpenChange,
  profile: propProfile,
}: QrPassModalProps) {
  const { profile: authProfile, session, refreshProfile } = useSafeAuth();
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const effectiveProfile = propProfile !== undefined ? propProfile : authProfile;
  const userId = effectiveProfile?.id ?? session?.user?.id ?? '';
  const userName = effectiveProfile?.name ?? (session?.user?.user_metadata?.full_name as string | undefined) ?? 'Participant';
  const userEmail = effectiveProfile?.email ?? session?.user?.email ?? '';
  const roleName = effectiveProfile?.role ?? 'participant';
  const role = roleByName(roleName) ?? USER_ROLES[0];
  const checkedInAt = effectiveProfile?.checked_in_at;
  const isCheckedIn = Boolean(checkedInAt);

  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'P';

  const handleCopyId = async () => {
    if (!userId) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(userId);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="qr-pass-modal"
        className="glass max-w-md border-emerald-glow/30 p-6 sm:rounded-3xl shadow-2xl bg-background/95 backdrop-blur-xl"
      >
        <DialogHeader className="text-center sm:text-center space-y-1">
          <div className="mx-auto mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-mint">
            <QrCode className="h-3.5 w-3.5 text-emerald" />
            <span>Emerald Summit Digital Pass</span>
          </div>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
            My QR Pass
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Present this code to summit volunteers at the front desk for instant check-in.
          </DialogDescription>
        </DialogHeader>

        {/* Digital Pass Card */}
        <div className="mt-2 space-y-4 rounded-2xl border border-border/80 bg-card/60 p-4 backdrop-blur-md">
          {/* User Info Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                style={{ background: role.color }}
                aria-hidden
              >
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-foreground">
                  {userName}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </div>
              </div>
            </div>

            <span
              className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ background: `${role.color}22`, color: role.color }}
            >
              {role.label}
            </span>
          </div>

          {/* Check-in Status Banner */}
          <div
            data-testid="qr-pass-status-banner"
            className={cn(
              'flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-medium transition-colors',
              isCheckedIn
                ? 'border border-emerald/30 bg-emerald/15 text-emerald-mint'
                : 'border border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400',
            )}
          >
            <div className="flex items-center gap-2">
              {isCheckedIn ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald shrink-0" />
                  <div>
                    <span className="font-bold text-foreground">Checked In</span>
                    {checkedInAt && (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        · {new Date(checkedInAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold text-foreground">Pending Check-in</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">· Ready to scan</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Refresh status"
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              aria-label="Refresh check-in status"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
            </button>
          </div>

          {/* QR Code Container: high-contrast white background for reliable optical scanning */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border/80 bg-white p-5 shadow-sm">
            {userId ? (
              <div data-testid="qr-code-container" className="p-1">
                <QRCodeSVG
                  value={userId}
                  size={192}
                  level="H"
                  includeMargin={false}
                  fgColor="#0A5F43"
                  aria-label={`QR code for user ID ${userId}`}
                />
              </div>
            ) : (
              <div className="flex h-48 w-48 items-center justify-center text-xs text-muted-foreground">
                No user ID available
              </div>
            )}
          </div>

          {/* User ID Monospace Footer with Copy */}
          <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 border border-border/50 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0 font-mono text-muted-foreground">
              <span className="text-xs font-semibold text-foreground">ID:</span>
              <span className="truncate select-all font-medium">{userId}</span>
            </div>
            <button
              onClick={handleCopyId}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-background px-2 py-1 text-[10px] font-semibold text-foreground shadow-sm hover:bg-accent transition-colors"
              aria-label="Copy User ID"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tip */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-emerald shrink-0" />
          <span>Tip: Turn up screen brightness when presenting to volunteer scanner.</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
