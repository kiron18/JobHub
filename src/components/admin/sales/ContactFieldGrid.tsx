/* The contact details as a grid of inputs. Used twice: in the card that follows
   a resume upload, where everything is saved with one button, and in a row's
   drawer, where each field saves as you leave it. */
import { C, CONTACT_FIELDS, inputStyle, type ContactField, type ContactValues } from './shared';

export default function ContactFieldGrid({
  values,
  professions,
  onChange,
  onLeave,
}: {
  values: ContactValues;
  professions: readonly string[];
  onChange: (field: ContactField, value: string) => void;
  /** Called when a field loses focus, for the save-as-you-go drawer. */
  onLeave?: (field: ContactField) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '9px 12px' }}>
      {CONTACT_FIELDS.map(([field, label]) => (
        <label key={field} style={{ display: 'block', fontSize: 12, color: C.ink3 }}>
          {label}
          {field === 'profession' ? (
            /* A fixed list, not free text: this is the field the board groups
               by, and "Data analyst" next to "Data Analytics" would be two
               groups of one. */
            <select
              value={values.profession}
              onChange={(e) => { onChange(field, e.target.value); }}
              onBlur={() => onLeave?.(field)}
              style={{ ...inputStyle, marginTop: 3, cursor: 'pointer' }}
            >
              <option value="">Not set</option>
              {professions.map((p) => <option key={p} value={p}>{p}</option>)}
              {/* Whatever is on the row stays selectable even if the list
                  changes underneath it. */}
              {values.profession && !professions.includes(values.profession) && (
                <option value={values.profession}>{values.profession}</option>
              )}
            </select>
          ) : (
            <input
              value={values[field]}
              type={field === 'email' ? 'email' : 'text'}
              onChange={(e) => onChange(field, e.target.value)}
              onBlur={() => onLeave?.(field)}
              style={{ ...inputStyle, marginTop: 3 }}
            />
          )}
        </label>
      ))}
    </div>
  );
}
