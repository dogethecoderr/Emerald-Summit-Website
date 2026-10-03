import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { User, Phone, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { USER_DISCIPLINES } from '../models/disciplines';
import { needsProfileSetup, saveProfile, signOut } from '../services/auth';
import { fetchTrackOptions, type TrackOption } from '../services/tracks';
import BrandMark from '../components/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { subscribeOfflineDemo } from '../services/offlineDemo';

const BIO_WORD_LIMIT = 30;

function wordCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

export default function ProfileSetupPage() {
  const { session, profile, loadingProfile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [disciplineOptions, setDisciplineOptions] = useState<TrackOption[]>(
    USER_DISCIPLINES.map((track) => ({ ...track, is_discipline: true })),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    const loadTracks = () => {
      void fetchTrackOptions()
        .then((tracks) => {
          if (active) setDisciplineOptions(tracks.filter((track) => track.is_discipline));
        })
        .catch((error) => {
          if (active) toast.error(error instanceof Error ? error.message : 'Could not load summit tracks');
        });
    };
    loadTracks();
    const unsubscribe = subscribeOfflineDemo(loadTracks);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // Prefill from an existing profile, else from the mock account's name hint.
  useEffect(() => {
    if (prefilled || loadingProfile) return;

    if (profile) {
      const existingName = (profile.name as string | undefined)?.trim();
      if (existingName) setName(existingName);
      const existingPhone = (profile.phone as string | undefined)?.trim();
      if (existingPhone) setPhone(existingPhone);
      const existingBio = (profile.bio as string | undefined)?.trim();
      if (existingBio) setBio(existingBio);
      const disciplineName = profile.discipline as string | undefined;
      if (disciplineName) setSelectedDisciplines([disciplineName]);
      setPrefilled(true);
    } else {
      const metadataName = session?.user.user_metadata?.full_name?.trim();
      if (metadataName && metadataName.length > 0) {
        setName(metadataName);
      }
      setPrefilled(true);
    }
  }, [profile, loadingProfile, prefilled, session]);

  const bioWords = useMemo(() => wordCount(bio), [bio]);
  const canSave =
    name.trim().length > 0 && bioWords <= BIO_WORD_LIMIT && !isSaving;

  if (!loadingProfile && session == null) {
    return <Navigate to="/home" replace />;
  }

  if (!loadingProfile && session != null && !needsProfileSetup(profile)) {
    return <Navigate to="/home" replace />;
  }

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      setIsSigningOut(false);
      toast.error(`Sign out failed: ${error}`);
    }
  };

  const handleSave = async () => {
    if (bioWords > BIO_WORD_LIMIT) return;
    if (name.trim().length === 0) return;

    setIsSaving(true);
    try {
      await saveProfile({
        name: name.trim(),
        phone: phone.trim(),
        discipline: selectedDisciplines[0] ?? null,
        disciplines: profile?.role === 'participant' ? selectedDisciplines : undefined,
        bio: bio.trim(),
      });
      await refreshProfile();
      navigate('/home');
    } catch (error) {
      toast.error(`Could not save profile: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 left-[-10%] h-[420px] w-[420px] rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #0C7A55 0%, transparent 65%)' }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-xl px-6 pb-20">
        <header className="flex items-center justify-between py-5">
          <BrandMark
            logoClassName="h-8 w-8"
            titleClassName="text-sm font-semibold"
            subtitleClassName="text-[11px] text-muted-foreground"
            subtitle={session?.user.email ?? ''}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </header>

        <div className="animate-fade-up mt-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Tell us a bit about yourself
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Only your full name is required — the rest helps others find and
            connect with you.
          </p>
        </div>

        <div className="animate-fade-up mt-8 space-y-6" style={{ animationDelay: '90ms' }}>
          <div>
            <Label htmlFor="name" className="mb-2 block text-[13px]">
              Full name
            </Label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="name"
                autoComplete="name"
                placeholder="Jordan Lee"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 rounded-xl bg-secondary/40 pl-10 text-[15px]"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="mb-2 block text-[13px]">
              Phone <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                placeholder="(555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12 rounded-xl bg-secondary/40 pl-10 text-[15px]"
              />
            </div>
          </div>

          {profile?.role !== 'volunteer' && <div>
            <Label className="mb-1 block text-[13px]">
              Disciplines <span className="text-muted-foreground">(optional)</span>
            </Label>
            <p className="mb-3 text-xs text-muted-foreground">
              Select every discipline you are registered for.
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {disciplineOptions.map((d) => {
                const selected = selectedDisciplines.includes(d.name);
                return (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() => setSelectedDisciplines((current) =>
                      selected
                        ? current.filter((name) => name !== d.name)
                        : [...current, d.name],
                    )}
                    className={cn(
                      'relative rounded-xl border p-3 text-left transition-all',
                      selected
                        ? 'border-transparent bg-accent'
                        : 'border-border/70 bg-secondary/30 hover:bg-accent/50',
                    )}
                    style={
                      selected
                        ? { boxShadow: `inset 0 0 0 1.5px ${d.color}` }
                        : undefined
                    }
                  >
                    {selected && (
                      <span
                        className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-white"
                        style={{ background: d.color }}
                      >
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                    )}
                    <span
                      className="mb-1.5 block h-1.5 w-6 rounded-full"
                      style={{ background: d.color }}
                      aria-hidden
                    />
                    <span className="block text-[13px] font-semibold">
                      {d.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                      {d.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>}

          <div>
            <Label htmlFor="bio" className="mb-2 block text-[13px]">
              Short bio <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="bio"
              rows={3}
              placeholder="A sentence or two about yourself."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="rounded-xl bg-secondary/40 text-[15px]"
            />
            <div
              className={cn(
                'mt-1.5 text-right text-[11px] font-medium',
                bioWords > BIO_WORD_LIMIT
                  ? 'text-red-400'
                  : 'text-muted-foreground',
              )}
            >
              {bioWords}/{BIO_WORD_LIMIT} words
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              className="glow-emerald h-12 w-full rounded-xl bg-primary text-[15px] font-semibold hover:bg-emerald"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isSaving ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                'Continue'
              )}
            </Button>
            
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl border-border/80 bg-secondary/30 text-[15px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={async () => {
                await handleSignOut();
                navigate('/home');
              }}
              disabled={isSaving || isSigningOut}
            >
              Bypass to Role Picker
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
