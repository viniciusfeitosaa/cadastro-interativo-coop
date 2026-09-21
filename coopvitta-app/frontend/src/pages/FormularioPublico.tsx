import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  formularioPublicService,
  type FormularioCampoPublico,
  type FormularioPublico,
} from '../services/formulario-public.service';

export default function FormularioPublico() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [form, setForm] = useState<FormularioPublico | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await formularioPublicService.getBySlug(slug);
        if (cancelled) return;
        setForm(r.data);
        const init: Record<string, string> = {};
        r.data.campos.forEach((c) => {
          if (c.tipo !== 'FICHEIRO') init[c.chave] = '';
        });
        setValues(init);
      } catch (e: unknown) {
        const err = e as { response?: { data?: { error?: string } } };
        if (!cancelled) setError(err.response?.data?.error || 'Formulário indisponível.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) fd.append(k, v);
      if (file) fd.append('curriculo', file);
      await formularioPublicService.submit(slug, fd);
      setSuccess(true);
    } catch (err: unknown) {
      const e2 = err as { response?: { data?: { error?: string } } };
      setError(e2.response?.data?.error || 'Não foi possível enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderCampo = (c: FormularioCampoPublico) => {
    if (c.tipo === 'FICHEIRO') {
      return (
        <div key={c.chave} className="space-y-1">
          <label className="block text-sm font-medium text-coop-900" htmlFor={c.chave}>
            {c.label}
            {c.obrigatorio ? ' *' : ''}
          </label>
          <input
            id={c.chave}
            type="file"
            accept="application/pdf,.pdf"
            required={c.obrigatorio}
            disabled={submitting}
            onChange={(ev) => setFile(ev.target.files?.[0] || null)}
            className="block w-full text-sm text-coop-800 file:mr-3 file:rounded-md file:border-0 file:bg-coop-700 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white"
          />
        </div>
      );
    }
    if (c.tipo === 'ESCOLHA_UNICA') {
      const opcoes = Array.isArray(c.opcoes) ? c.opcoes : [];
      return (
        <div key={c.chave} className="space-y-1">
          <span className="block text-sm font-medium text-coop-900">
            {c.label}
            {c.obrigatorio ? ' *' : ''}
          </span>
          <div className="flex flex-wrap gap-4">
            {opcoes.map((opt) => (
              <label key={opt} className="inline-flex items-center gap-2 text-sm text-coop-800">
                <input
                  type="radio"
                  name={c.chave}
                  value={opt}
                  required={c.obrigatorio}
                  disabled={submitting}
                  checked={values[c.chave] === opt}
                  onChange={() => setValues((prev) => ({ ...prev, [c.chave]: opt }))}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div key={c.chave} className="space-y-1">
        <label className="block text-sm font-medium text-coop-900" htmlFor={c.chave}>
          {c.label}
          {c.obrigatorio ? ' *' : ''}
        </label>
        <input
          id={c.chave}
          type={c.tipo === 'TELEFONE' ? 'tel' : 'text'}
          required={c.obrigatorio}
          disabled={submitting}
          value={values[c.chave] || ''}
          onChange={(ev) => setValues((prev) => ({ ...prev, [c.chave]: ev.target.value }))}
          className="w-full rounded-lg border border-coop-200 px-3 py-2 text-sm text-coop-900 focus:outline-none focus:ring-2 focus:ring-coop-400"
          placeholder={c.tipo === 'TELEFONE' ? '(85) 9xxxx-xxxx' : undefined}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-coop-50 to-white px-4 py-10">
      <div className="mx-auto max-w-lg">
        <p className="text-center text-xs font-semibold tracking-wide text-coop-600 uppercase mb-2">
          COOPVITTA
        </p>
        {loading && <p className="text-center text-sm text-coop-700">Carregando formulário…</p>}
        {!loading && error && !form && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        )}
        {success && (
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm text-center">
            <h1 className="text-xl font-semibold text-coop-950 font-display mb-2">Inscrição enviada</h1>
            <p className="text-sm text-coop-700">
              Recebemos os seus dados. A equipe COOPVITTA entrará em contato se necessário.
            </p>
          </div>
        )}
        {form && !success && (
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="rounded-2xl border border-coop-100 bg-white p-6 shadow-sm space-y-4"
          >
            <div>
              <h1 className="text-xl font-semibold text-coop-950 font-display">{form.titulo}</h1>
              {form.descricao ? <p className="mt-2 text-sm text-coop-700">{form.descricao}</p> : null}
            </div>
            {form.campos.map(renderCampo)}
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-coop-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-coop-800 disabled:opacity-50"
            >
              {submitting ? 'A enviar…' : 'Enviar inscrição'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
