// One sign-up question (models/profileFields.ts), the way the app draws it:
// a text box, or for school the Tri-Valley dropdown with an "Other" box.
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { matchTriValleySchool, TRI_VALLEY_SCHOOLS } from '../models/schools';
import type { ProfileField } from '../models/profileFields';

const OTHER = '__other__';
const FIELD_CLASS = 'h-12 rounded-xl bg-secondary/40 text-[15px]';

export default function ProfileFieldInput({
  field,
  value,
  onChange,
}: {
  field: ProfileField;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `field-${field.key}`;
  const helperId = field.helper ? `${id}-help` : undefined;
  const helper = field.helper && <p id={helperId} className="mt-1.5 text-[12px] text-muted-foreground">{field.helper}</p>;

  if (field.schoolPicker) return <SchoolPicker field={field} value={value} onChange={onChange} />;

  return (
    <div>
      <Label htmlFor={id} className="mb-2 block text-[13px] font-semibold">{field.label}</Label>
      {field.multiline ? (
        <Textarea
          id={id}
          rows={2}
          required={field.required}
          placeholder={field.hint}
          aria-describedby={helperId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-xl bg-secondary/40 text-[15px]"
        />
      ) : (
        <Input
          id={id}
          type={field.type === 'tel' ? 'tel' : 'text'}
          inputMode={field.type === 'digits' ? 'numeric' : field.type === 'tel' ? 'tel' : undefined}
          autoComplete={field.type === 'tel' ? 'tel' : undefined}
          required={field.required}
          placeholder={field.hint}
          aria-describedby={helperId}
          value={value}
          onChange={(e) => onChange(field.type === 'digits' ? e.target.value.replace(/\D/g, '') : e.target.value)}
          className={FIELD_CLASS}
        />
      )}
      {helper}
    </div>
  );
}

function SchoolPicker({ field, value, onChange }: { field: ProfileField; value: string; onChange: (v: string) => void }) {
  const listed = matchTriValleySchool(value);
  const [other, setOther] = useState(value.trim() !== '' && listed == null);
  const id = `field-${field.key}`;
  const selected = listed ? listed.name : other ? OTHER : '';
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="block text-[13px] font-semibold">{field.label}</Label>
      <select
        id={id}
        required={field.required}
        aria-describedby={field.helper ? `${id}-help` : undefined}
        value={selected}
        onChange={(e) => {
          const v = e.target.value;
          if (v === OTHER) {
            setOther(true);
            onChange('');
          } else {
            setOther(false);
            onChange(v);
          }
        }}
        className="h-12 w-full rounded-xl border border-input bg-secondary/40 px-3 text-[15px]"
      >
        <option value="">{field.required ? 'Choose your school' : 'None'}</option>
        {TRI_VALLEY_SCHOOLS.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.city})</option>)}
        <option value={OTHER}>Other (not listed)</option>
      </select>
      {other && (
        <Input
          aria-label="School name"
          placeholder="School name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={FIELD_CLASS}
        />
      )}
      {field.helper && <p id={`${id}-help`} className="text-[12px] text-muted-foreground">{field.helper}</p>}
    </div>
  );
}
