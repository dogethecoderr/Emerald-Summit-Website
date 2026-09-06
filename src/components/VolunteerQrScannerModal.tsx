import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import {
  QrCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Camera,
  RefreshCw,
  Keyboard,
  ArrowRight,
} from 'lucide-react';
import { checkInParticipant, type CheckInResult } from '../services/checkIn';
import { roleByName, USER_ROLES } from '../models/roles';
import { cn } from '@/lib/utils';

export interface VolunteerQrScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCheckInSuccess?: (user: { id: string; name: string; checked_in_at?: string | null }) => void;
}

export default function VolunteerQrScannerModal({
  open,
  onOpenChange,
  onCheckInSuccess,
}: VolunteerQrScannerModalProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<CheckInResult | null>(null);
  const [manualInput, setManualInput] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (isScanningRef.current) {
          isScanningRef.current = false;
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // Silently handle any teardown exception
      } finally {
        scannerRef.current = null;
      }
    }
  }, []);

  const handleProcessCheckIn = useCallback(
    async (idToProcess: string) => {
      if (isProcessing) return;
      setIsProcessing(true);
      setCameraError(null);

      try {
        // Pause or stop scanner while processing result
        await stopScanner();

        const result = await checkInParticipant(idToProcess);
        setScanResult(result);

        if (result.success && result.user) {
          toast.success(`Successfully checked in ${result.user.name}!`);
          onCheckInSuccess?.(result.user);
        } else if (result.alreadyCheckedIn && result.user) {
          toast.warning(`${result.user.name} is already checked in.`);
        } else {
          toast.error(result.error ?? 'Check-in failed');
        }
      } catch (err: any) {
        const errorMsg = err?.message ?? 'Unexpected error during check-in';
        setScanResult({
          success: false,
          error: errorMsg,
        });
        toast.error(errorMsg);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, onCheckInSuccess, stopScanner],
  );

  const startScanner = useCallback(async () => {
    if (!open || activeTab !== 'camera' || scanResult !== null) return;
    setCameraError(null);

    // Give DOM time to mount container
    await new Promise((resolve) => setTimeout(resolve, 100));

    const element = document.getElementById('qr-reader-container');
    if (!element) return;

    try {
      await stopScanner();
      const scanner = new Html5Qrcode('qr-reader-container');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleProcessCheckIn(decodedText);
        },
        () => {
          // Frame scan error - ignore frame by frame
        },
      );
      isScanningRef.current = true;
    } catch (err: any) {
      isScanningRef.current = false;
      const msg = err?.message || String(err);
      if (
        msg.includes('NotAllowedError') ||
        msg.includes('Permission') ||
        msg.includes('denied')
      ) {
        setCameraError(
          'Camera permission denied. Please allow camera access in your browser settings, or use manual ID entry below.',
        );
      } else if (msg.includes('NotFoundError') || msg.includes('no camera')) {
        setCameraError(
          'No camera device detected on this system. Please use manual ID entry.',
        );
      } else {
        setCameraError(
          'Unable to initialize camera scanner. You can use manual ID entry to check in participants.',
        );
      }
    }
  }, [open, activeTab, scanResult, handleProcessCheckIn, stopScanner]);

  // Manage scanner lifecycle
  useEffect(() => {
    if (open && activeTab === 'camera' && !scanResult) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [open, activeTab, scanResult, startScanner, stopScanner]);

  const handleScanNext = () => {
    setScanResult(null);
    setManualInput('');
    setCameraError(null);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleProcessCheckIn(manualInput.trim());
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      stopScanner();
      setScanResult(null);
      setManualInput('');
      setCameraError(null);
      setActiveTab('camera');
    }
    onOpenChange(newOpen);
  };

  const resultUserRole = scanResult?.user?.role
    ? roleByName(scanResult.user.role) ?? USER_ROLES[0]
    : USER_ROLES[0];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="volunteer-qr-scanner-modal"
        className="glass max-w-lg border-emerald-glow/30 p-6 sm:rounded-3xl shadow-2xl bg-background/95 backdrop-blur-xl"
      >
        <DialogHeader className="text-center sm:text-center space-y-1">
          <div className="mx-auto mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-mint">
            <QrCode className="h-3.5 w-3.5 text-emerald" />
            <span>Volunteer Check-in Scanner</span>
          </div>
          <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
            Scan Participant QR Pass
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Align the participant's QR code within the viewfinder for instant check-in.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher: Camera vs Manual Entry */}
        <div className="mt-2 flex rounded-xl bg-muted/60 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('camera');
              setScanResult(null);
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-all',
              activeTab === 'camera'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Camera className="h-4 w-4" />
            <span>Camera Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              stopScanner();
            }}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 transition-all',
              activeTab === 'manual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Keyboard className="h-4 w-4" />
            <span>Manual ID Entry</span>
          </button>
        </div>

        {/* FEEDBACK RESULT STATE */}
        {scanResult ? (
          <div className="mt-4 space-y-4">
            {scanResult.success && scanResult.user && (
              <div
                data-testid="scan-feedback-success"
                className="rounded-2xl border border-emerald/40 bg-emerald/10 p-5 text-center shadow-sm backdrop-blur-md"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald/20 text-emerald">
                  <CheckCircle2 className="h-8 w-8 text-emerald" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  Check-in Confirmed!
                </h3>
                <p className="mt-1 text-xs font-semibold text-emerald-mint">
                  Participant successfully checked into the summit.
                </p>

                <div className="mt-4 rounded-xl border border-border/70 bg-card/70 p-3.5 text-left text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-bold text-foreground">
                      {scanResult.user.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Role:</span>
                    <span
                      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        background: `${resultUserRole.color}22`,
                        color: resultUserRole.color,
                      }}
                    >
                      {resultUserRole.label}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {scanResult.user.email || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Checked In At:</span>
                    <span className="font-medium text-foreground">
                      {new Date(scanResult.user.checked_in_at || Date.now()).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {scanResult.alreadyCheckedIn && scanResult.user && (
              <div
                data-testid="scan-feedback-warning"
                className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 text-center shadow-sm backdrop-blur-md"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
                  <AlertTriangle className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  Already Checked In
                </h3>
                <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  {scanResult.user.name} has already checked in previously.
                </p>

                <div className="mt-4 rounded-xl border border-border/70 bg-card/70 p-3.5 text-left text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Participant:</span>
                    <span className="font-bold text-foreground">
                      {scanResult.user.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Prior Check-in:</span>
                    <span className="font-medium text-foreground">
                      {scanResult.user.checked_in_at
                        ? new Date(scanResult.user.checked_in_at).toLocaleTimeString()
                        : 'Earlier today'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {!scanResult.success && !scanResult.alreadyCheckedIn && (
              <div
                data-testid="scan-feedback-error"
                className="rounded-2xl border border-destructive/40 bg-destructive/10 p-5 text-center shadow-sm backdrop-blur-md"
              >
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/20 text-destructive">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  Check-in Unsuccessful
                </h3>
                <p className="mt-1 text-xs font-medium text-destructive">
                  {scanResult.error ?? 'Invalid QR code or participant not registered.'}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleScanNext}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-3 text-xs font-bold text-white shadow-md hover:bg-emerald-deep transition-all"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Scan Next Participant</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="rounded-xl border border-border/70 bg-background px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* SCANNING / INPUT STATE */
          <div className="mt-4 space-y-4">
            {activeTab === 'camera' ? (
              <div className="space-y-3">
                {cameraError ? (
                  <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
                    <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                      {cameraError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('manual')}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-accent transition-colors"
                    >
                      <Keyboard className="h-3.5 w-3.5" />
                      <span>Switch to Manual ID Entry</span>
                    </button>
                  </div>
                ) : (
                  <div className="relative mx-auto flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/80 bg-black/90 p-2 shadow-inner">
                    {/* Viewfinder Target Container */}
                    <div
                      id="qr-reader-container"
                      data-testid="qr-reader-container"
                      className="h-64 w-64 overflow-hidden rounded-xl"
                    />

                    {isProcessing && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                        <RefreshCw className="h-8 w-8 animate-spin text-emerald" />
                        <span className="mt-2 text-xs font-semibold text-foreground">
                          Verifying participant...
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-center text-[11px] text-muted-foreground">
                  Hold QR code steady within the frame. Camera scans automatically.
                </p>
              </div>
            ) : (
              /* Manual Input Form */
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="space-y-1.5 text-left">
                  <label
                    htmlFor="manual-id-input"
                    className="text-xs font-semibold text-foreground"
                  >
                    Participant ID / UUID
                  </label>
                  <input
                    id="manual-id-input"
                    data-testid="manual-checkin-input"
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000 or p8"
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-emerald focus:outline-none focus:ring-1 focus:ring-emerald"
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Enter the full UUID from the participant's badge or pass, or test ID (p1–p10).
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!manualInput.trim() || isProcessing}
                  data-testid="manual-checkin-button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-deep transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Check In Participant</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
