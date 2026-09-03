'use client';
/* oxlint-disable next/no-img-element -- Preview the exact URL produced by the WebP upload pipeline. */
import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { Upload } from 'lucide-react';
import { optimizeImage, optimizationSummary } from '@/lib/optimize-image';

export function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecione</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
export function Toggle({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <Switch disabled={disabled} checked={value} onCheckedChange={onChange} />
    </label>
  );
}
export function UploadField({
  label,
  value,
  onChange,
  onBusy,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onBusy?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  async function upload(file?: File) {
    if (!file) return;
    setError('');
    setSummary('');
    setBusy(true);
    onBusy?.(true);
    try {
      const optimized = await optimizeImage(file);
      const form = new FormData();
      form.append('file', optimized.file);
      const res = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = (await res.json()) as { error?: string; url?: string };
      if (!res.ok || !data.url)
        throw new Error(data.error ?? 'Falha no envio.');
      onChange(data.url);
      setSummary(optimizationSummary(optimized));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no envio.');
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <div className="upload-field">
      <Field
        label={label + ' (URL HTTPS ou upload)'}
        value={value}
        onChange={onChange}
      />
      <div>
        {value && <img src={value} alt={label} />}
        <label className="upload-button">
          <Upload />
          {busy ? 'Convertendo e enviando…' : 'Enviar imagem'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        <small>
          Até 5 MB · PNG, JPEG, WebP ou GIF estático. Conversão automática para
          WebP, até 1.920 px, preservando transparência.
        </small>
      </div>
      {summary && <output className="source-note">{summary}</output>}
      {error && (
        <p role="alert" className="error-message">
          {error} A imagem anterior foi mantida.
        </p>
      )}
    </div>
  );
}
export function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-panel">
      <h1>{title}</h1>
      {note && <p>{note}</p>}
      {children}
    </section>
  );
}
