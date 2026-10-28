import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import BrandMark from '../components/BrandMark';
import { roleByName } from '../models/roles';
import { USER_DISCIPLINES } from '../models/disciplines';
import { tracksForUniverse } from '../models/tracks';
import { surveyForRole, type SurveyField } from '../models/approvalSurveys';
import { isValidEmail, submitApplication } from '../services/approvals';
import { signInWithApprovedEmail } from '../services/auth';
import type { LoginLocationState } from './LoginPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const FIELD_CLASS = 'h-12 rounded-xl bg-secondary/40 text-[15px]';

/**
 * First-time sign-up survey for approval-gated roles. Reached from the login
 * page with the email in router state; on submit it adds an "Awaiting
 * Approval" row to the role's sheet tab and returns to the login page.
 */
export default function ApplyPage() {
  const { role: roleName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const email = (location.state as { email?: string } | null)?.email ?? '';

  const role = roleByName(roleName);
  const survey = surveyForRole(roleName);

  const [values, setValues] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The survey is only ever opened from the login page's email check.
  if (!role || !survey || !isValidEmail(email)) {
    return <Navigate to={roleName ? `/login/${roleName}` : '/home'} replace />;
  }

  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const missing = survey.fields.filter(
    (f) => f.required && !(values[f.key] ?? '').trim(),
  );
  const canSubmit = missing.length === 0 && !isSubmitting;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const fields: Record<string, string> = { email };
    for (const f of survey.fields) {
      const raw = (values[f.key] ?? '').trim();
      fields[f.key] =
        f.type === 'universe'
          ? USER_DISCIPLINES.find((d) => d.name === raw)?.label ?? raw
          : raw;
    }

    setIsSubmitting(true);
    try {
      const { status } = await submitApplication(role.name, fields);
      if (status === 'approved') {
        // Already approved (e.g. an admin added them by hand): just sign in.
        signInWithApprovedEmail(role.name, email, fields.fullName);
        navigate('/home', { replace: true });
        return;
      }
      const state: LoginLocationState = {
        email,
        notice: status === 'rejected' ? 'rejected' : 'submitted',
      };
      navigate(`/login/${role.name}`, { replace: true, state });
    } catch (error) {
      toast.error(`Could not submit: ${error instanceof Error ? error.message : error}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute -top-32 left-[-10%] h-[420px] w-[420px] rounded-full opacity-25 blur-3xl"
        style={{ background: `radial-gradient(circle, ${role.color} 0%, transparent 65%)` }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-xl px-6 pb-20">
        <header className="flex items-center justify-between py-5">
          <button
            type="button"
            onClick={() => navigate(`/login/${role.name}`, { state: { email } })}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <BrandMark
            logoClassName="h-8 w-8"
            titleClassName="text-sm font-semibold"
            subtitleClassName="text-[11px] text-muted-foreground"
          />
        </header>

        <div className="animate-fade-up mt-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {survey.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {survey.intro}
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-secondary/50 px-3 py-1.5 text-[13px] text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Applying as <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="animate-fade-up mt-8 space-y-5"
          style={{ animationDelay: '90ms' }}
        >
          {survey.fields.map((field) => (
            <SurveyInput
              key={field.key}
              field={field}
              value={values[field.key] ?? ''}
              universe={values.universe ?? ''}
              onChange={(v) => {
                set(field.key, v);
                // A track only makes sense inside its universe.
                if (field.type === 'universe') set('track', '');
              }}
            />
          ))}

          <Button
            type="submit"
            className="glow-emerald h-12 w-full rounded-xl bg-primary text-[15px] font-semibold hover:bg-emerald"
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              'Submit application'
            )}
          </Button>
          {missing.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Still needed: {missing.map((f) => f.label.toLowerCase()).join(', ')}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

function SurveyInput({
  field,
  value,
  universe,
  onChange,
}: {
  field: SurveyField;
  value: string;
  universe: string;
  onChange: (value: string) => void;
}) {
  const id = `survey-${field.key}`;
  const label = (
    <Label htmlFor={id} className="mb-2 block text-[13px]">
      {field.label}
      {!field.required && <span className="text-muted-foreground"> (optional)</span>}
    </Label>
  );

  if (field.type === 'universe' || field.type === 'track') {
    const options =
      field.type === 'universe'
        ? USER_DISCIPLINES.map((d) => ({ value: d.name, label: d.label }))
        : tracksForUniverse(universe).map((t) => ({ value: t, label: t }));
    const disabled = field.type === 'track' && !universe;
    return (
      <div>
        {label}
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger id={id} className={FIELD_CLASS}>
            <SelectValue
              placeholder={disabled ? 'Pick a universe first' : `Choose a ${field.label.toLowerCase()}`}
            />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div>
        {label}
        <Textarea
          id={id}
          rows={4}
          placeholder={field.placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl bg-secondary/40 text-[15px]"
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <Input
        id={id}
        type={field.type}
        autoComplete={field.autoComplete}
        placeholder={field.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_CLASS}
      />
    </div>
  );
}
