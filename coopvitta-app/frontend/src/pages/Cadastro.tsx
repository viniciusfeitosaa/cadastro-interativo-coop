import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService, type RegisterPayload } from '../services/auth.service';
import { PROFISSOES_SAUDE, ESPECIALIDADES_MEDICAS } from '../constants/profissoesEspecialidades';
import {
  labelRegistroConselho,
  placeholderRegistroConselho,
  profissaoExigeRegistroConselho,
} from '../constants/profissaoConselho';
import { TERMOS_CADASTRO_TEXTO_COMPLETO, TERMOS_CADASTRO_TITULO, TERMOS_CADASTRO_VERSAO } from '../constants/termosCadastro';
import { BrandLogo } from '../components/brand/BrandLogo';
import {
  CADASTRO_MAX_BYTES_PER_FILE,
  DOCUMENTOS_PERFIL_CADASTRO_ORDEM,
  DOCUMENTOS_PERFIL_FIELDS,
  DOCUMENTOS_PERFIL_OBRIGATORIOS_CADASTRO,
  DOCUMENTO_LABEL_BY_FIELD,
  isDocumentoObrigatorioNoCadastro,
  type DocumentoPerfilField,
} from '../constants/documentosPerfil';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)', 'Outro'] as const;

const STEP_LABELS = [
  'Dados pessoais',
  'Profissão',
  'Estado civil e endereço',
  'Repasse (texto)',
  'Documentos',
  'Senha e aceite',
] as const;

/** Apenas dígitos do CEP (até 8). */
function cepSomenteDigitos(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

/** Exibição 00000-000 */
function formatarCepExibicao(digitos: string): string {
  const d = cepSomenteDigitos(digitos);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/** Apenas dígitos do CPF (até 11). */
function cpfSomenteDigitos(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

/** Exibição 000.000.000-00 */
function formatarCpfExibicao(digitos: string): string {
  const d = cpfSomenteDigitos(digitos);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Monta o texto único enviado ao backend (compatível com `enderecoResidencial`). */
function montarEnderecoResidencial(data: {
  cep: string;
  enderecoLogradouro: string;
  enderecoNumero: string;
  enderecoComplemento?: string;
  enderecoBairro: string;
  enderecoCidade: string;
  enderecoUf: string;
}): string {
  const cepFmt = formatarCepExibicao(data.cep);
  const linhas = [
    `CEP: ${cepFmt}`,
    `Logradouro: ${data.enderecoLogradouro.trim()}`,
    `Número: ${data.enderecoNumero.trim()}`,
    data.enderecoComplemento?.trim() ? `Complemento: ${data.enderecoComplemento.trim()}` : null,
    `Bairro: ${data.enderecoBairro.trim()}`,
    `Cidade/UF: ${data.enderecoCidade.trim()} / ${data.enderecoUf.trim().toUpperCase()}`,
  ].filter(Boolean) as string[];
  return linhas.join('\n');
}

function montarDadosBancariosTexto(data: {
  dadosBancoConta: string;
  dadosBancoAgencia: string;
  dadosBancoNome: string;
}): string {
  return [
    `Conta: ${data.dadosBancoConta.trim()}`,
    `Agência: ${data.dadosBancoAgencia.trim()}`,
    `Banco: ${data.dadosBancoNome.trim()}`,
  ].join('\n');
}

interface ViaCepJson {
  erro?: boolean | string;
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
}

const cadastroSchema = z
  .object({
    nomeCompleto: z.string().min(3, 'Informe seu nome completo'),
    email: z.string().email('E-mail inválido'),
    cpf: z
      .string()
      .min(1, 'CPF é obrigatório')
      .refine((v) => cpfSomenteDigitos(v).length === 11, 'CPF deve ter 11 dígitos'),
    telefone: z.string().min(8, 'Telefone é obrigatório'),
    profissao: z.string().min(2, 'Selecione a profissão'),
    crm: z.string().optional(),
    estadoCivil: z.string().min(1, 'Selecione o estado civil'),
    cep: z
      .string()
      .min(1, 'CEP é obrigatório')
      .refine((v) => cepSomenteDigitos(v).length === 8, 'CEP deve ter 8 dígitos'),
    enderecoLogradouro: z.string().min(2, 'Informe o logradouro'),
    enderecoNumero: z.string().min(1, 'Informe o número'),
    enderecoComplemento: z
      .string()
      .min(1, 'Informe o complemento (ex.: S/C se não houver)'),
    enderecoBairro: z.string().min(2, 'Informe o bairro'),
    enderecoCidade: z.string().min(2, 'Informe a cidade'),
    enderecoUf: z
      .string()
      .min(2, 'UF é obrigatória')
      .max(2, 'Use a sigla com 2 letras')
      .regex(/^[A-Za-z]{2}$/, 'UF inválida (use duas letras, ex.: SP)'),
    dadosBancoConta: z.string().min(1, 'Informe a conta'),
    dadosBancoAgencia: z.string().min(1, 'Informe a agência'),
    dadosBancoNome: z.string().min(2, 'Informe o nome do banco'),
    chavePix: z.string().min(3, 'Informe a chave Pix (obrigatório)'),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string().min(8, 'Confirme a senha'),
    aceitouTermos: z.boolean().refine((v) => v === true, {
      message: 'É necessário aceitar a declaração e os termos para enviar o cadastro',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  })
  .superRefine((data, ctx) => {
    if (!profissaoExigeRegistroConselho(data.profissao)) return;
    const v = (data.crm || '').trim();
    if (!v) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o número do registro no conselho',
        path: ['crm'],
      });
      return;
    }
    if (data.profissao === 'Médico') {
      if (v.replace(/\s/g, '').length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CRM inválido (use o formato número-UF, ex.: 12345-CE)',
          path: ['crm'],
        });
      }
    } else if (v.length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Registro muito curto (mínimo 4 caracteres)',
        path: ['crm'],
      });
    }
  });

type CadastroFormData = z.infer<typeof cadastroSchema>;

const Cadastro = () => {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [especialidadesSelecionadas, setEspecialidadesSelecionadas] = useState<string[]>([]);
  const [buscaEspecialidade, setBuscaEspecialidade] = useState('');
  const [docFiles, setDocFiles] = useState<Partial<Record<DocumentoPerfilField, File | null>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cepAutoLoading, setCepAutoLoading] = useState(false);
  const [cepAutoMensagem, setCepAutoMensagem] = useState<string | null>(null);
  const ultimoCepConsultado = useRef<string>('');

  const {
    register: formRegister,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
    defaultValues: {
      profissao: '',
      estadoCivil: '',
      cep: '',
      enderecoLogradouro: '',
      enderecoNumero: '',
      enderecoComplemento: '',
      enderecoBairro: '',
      enderecoCidade: '',
      enderecoUf: '',
      crm: '',
      dadosBancoConta: '',
      dadosBancoAgencia: '',
      dadosBancoNome: '',
      chavePix: '',
      cpf: '',
      aceitouTermos: false,
    },
  });

  const cepWatch = watch('cep');

  useEffect(() => {
    const digitos = cepSomenteDigitos(cepWatch || '');
    if (digitos.length !== 8) {
      setCepAutoMensagem(null);
      ultimoCepConsultado.current = '';
      return;
    }
    if (digitos === ultimoCepConsultado.current) return;

    const t = window.setTimeout(() => {
      void (async () => {
        setCepAutoLoading(true);
        setCepAutoMensagem(null);
        try {
          const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
          if (!res.ok) {
            setCepAutoMensagem('Não foi possível consultar o CEP. Preencha o endereço manualmente.');
            return;
          }
          const data = (await res.json()) as ViaCepJson;
          if (data.erro === true || data.erro === 'true') {
            setCepAutoMensagem('CEP não encontrado. Confira os dígitos ou preencha o endereço manualmente.');
            return;
          }
          ultimoCepConsultado.current = digitos;
          if (data.logradouro) setValue('enderecoLogradouro', data.logradouro, { shouldValidate: true });
          if (data.bairro) setValue('enderecoBairro', data.bairro, { shouldValidate: true });
          if (data.localidade) setValue('enderecoCidade', data.localidade, { shouldValidate: true });
          if (data.uf) setValue('enderecoUf', data.uf.toUpperCase().slice(0, 2), { shouldValidate: true });
          if (data.complemento?.trim()) {
            const atual = (getValues('enderecoComplemento') || '').trim();
            if (!atual) setValue('enderecoComplemento', data.complemento.trim(), { shouldValidate: true });
          }
          setCepAutoMensagem('Endereço preenchido a partir do CEP. Confira número e complemento.');
        } catch {
          setCepAutoMensagem('Erro ao consultar o CEP. Preencha o endereço manualmente.');
        } finally {
          setCepAutoLoading(false);
        }
      })();
    }, 450);

    return () => window.clearTimeout(t);
  }, [cepWatch, setValue, getValues]);

  const profissao = watch('profissao');
  const isMedico = profissao === 'Médico';
  const exigeRegistroConselho = profissaoExigeRegistroConselho(profissao);

  useEffect(() => {
    if (profissao !== 'Médico') {
      setEspecialidadesSelecionadas([]);
      setBuscaEspecialidade('');
    }
  }, [profissao]);

  const especialidadesFiltradas = useMemo(
    () => ESPECIALIDADES_MEDICAS.filter((e) => e.toLowerCase().includes(buscaEspecialidade.toLowerCase())),
    [buscaEspecialidade]
  );

  const toggleEspecialidade = (nome: string) => {
    setEspecialidadesSelecionadas((prev) =>
      prev.includes(nome) ? prev.filter((x) => x !== nome) : [...prev, nome]
    );
  };

  const fieldsByStep: Record<number, (keyof CadastroFormData)[]> = {
    0: ['nomeCompleto', 'email', 'cpf', 'telefone'],
    1: ['profissao'],
    2: [
      'estadoCivil',
      'cep',
      'enderecoLogradouro',
      'enderecoNumero',
      'enderecoBairro',
      'enderecoCidade',
      'enderecoUf',
      'enderecoComplemento',
    ],
    3: ['dadosBancoConta', 'dadosBancoAgencia', 'dadosBancoNome', 'chavePix'],
    4: [],
    5: ['password', 'confirmPassword', 'aceitouTermos'],
  };

  const documentosObrigatoriosPreenchidos = () =>
    DOCUMENTOS_PERFIL_OBRIGATORIOS_CADASTRO.every((k) => docFiles[k] instanceof File);

  const goNext = async () => {
    setError(null);
    const keys =
      step === 1
        ? profissaoExigeRegistroConselho(getValues('profissao'))
          ? (['profissao', 'crm'] as (keyof CadastroFormData)[])
          : (['profissao'] as (keyof CadastroFormData)[])
        : fieldsByStep[step] || [];
    const ok = keys.length === 0 ? true : await trigger(keys, { shouldFocus: true });
    if (!ok) return;
    if (step === 1 && isMedico && especialidadesSelecionadas.length === 0) {
      setError('Selecione ao menos uma especialidade.');
      return;
    }
    if (step === 4 && !documentosObrigatoriosPreenchidos()) {
      setError(
        'Anexe os documentos obrigatórios: conselho profissional, certidão de regularidade fiscal, comprovante de endereço e RG/CPF ou CNH.'
      );
      return;
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  };

  const onSubmit = async (data: CadastroFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    if (data.profissao.trim() === 'Médico' && especialidadesSelecionadas.length === 0) {
      setError('Selecione ao menos uma especialidade (etapa Profissão).');
      setIsLoading(false);
      return;
    }
    if (!documentosObrigatoriosPreenchidos()) {
      setError(
        'Anexe os documentos obrigatórios na etapa Documentos (conselho, regularidade fiscal, endereço e RG/CPF ou CNH).'
      );
      setIsLoading(false);
      return;
    }

    try {
      const payload: RegisterPayload = {
        nomeCompleto: data.nomeCompleto.trim(),
        email: data.email.trim().toLowerCase(),
        cpf: data.cpf,
        profissao: data.profissao.trim(),
        telefone: data.telefone.trim(),
        password: data.password,
        confirmPassword: data.confirmPassword,
        estadoCivil: data.estadoCivil.trim(),
        enderecoResidencial: montarEnderecoResidencial({
          cep: data.cep,
          enderecoLogradouro: data.enderecoLogradouro,
          enderecoNumero: data.enderecoNumero,
          enderecoComplemento: data.enderecoComplemento,
          enderecoBairro: data.enderecoBairro,
          enderecoCidade: data.enderecoCidade,
          enderecoUf: data.enderecoUf,
        }),
        dadosBancarios: montarDadosBancariosTexto({
          dadosBancoConta: data.dadosBancoConta,
          dadosBancoAgencia: data.dadosBancoAgencia,
          dadosBancoNome: data.dadosBancoNome,
        }),
        chavePix: data.chavePix.trim(),
        aceitouTermos: data.aceitouTermos,
      };
      if (profissaoExigeRegistroConselho(data.profissao)) {
        payload.crm = (data.crm || '').trim();
      }
      if (data.profissao.trim() === 'Médico') {
        payload.especialidades = [...especialidadesSelecionadas];
      }

      const files = {} as Record<DocumentoPerfilField, File>;
      for (const k of DOCUMENTOS_PERFIL_FIELDS) {
        const f = docFiles[k];
        if (f instanceof File) files[k] = f;
      }
      for (const k of DOCUMENTOS_PERFIL_FIELDS) {
        const f = files[k];
        if (f instanceof File && f.size > CADASTRO_MAX_BYTES_PER_FILE) {
          setError(
            `${DOCUMENTO_LABEL_BY_FIELD[k]}: ficheiro demasiado grande (máximo ${formatBytes(CADASTRO_MAX_BYTES_PER_FILE)}; este tem ${formatBytes(f.size)}). Comprima o PDF ou reduza a resolução da foto.`
          );
          setIsLoading(false);
          return;
        }
      }

      const response = await authService.register(payload, files) as {
        success?: boolean;
        data?: { message?: string; medico?: unknown };
      };
      setSuccessMsg(response?.data?.message || 'Cadastro recebido com sucesso.');
      setDone(true);
    } catch (err: unknown) {
      const e = err as {
        response?: { status?: number; data?: { error?: string; errors?: Array<{ msg?: string }> } | string };
      };
      const status = e.response?.status;
      const raw = e.response?.data;
      let msg = 'Não foi possível concluir o cadastro.';
      if (typeof raw === 'object' && raw) {
        if (typeof raw.error === 'string' && raw.error.trim()) msg = raw.error.trim();
        else if (Array.isArray(raw.errors) && raw.errors.length) {
          const parts = raw.errors.map((x) => x?.msg).filter((m): m is string => typeof m === 'string' && !!m.trim());
          if (parts.length) msg = parts.join(' · ');
        }
      }
      if (status === 413) {
        msg =
          'O envio total excede o limite do proxy (Nginx). No Nginx Proxy Manager, no host da API, aumente "Advanced" → Custom Nginx Configuration: client_max_body_size 50m; (ou peça ao administrador).';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const progress = Math.round(((step + 1) / STEP_LABELS.length) * 100);

  if (done) {
    return (
      <div className="cadastro-page">
        <div className="cadastro-panel max-w-lg">
          <div className="cadastro-panel-inner space-y-7">
            <div className="text-center space-y-5 stagger-1">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-emerald-50 to-white ring-1 ring-emerald-900/10 shadow-inner">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  className="text-emerald-800"
                  aria-hidden
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div className="space-y-2">
                <p className="cadastro-kicker">Concluído</p>
                <h1 className="cadastro-title">Cadastro concluído</h1>
                <p className="cadastro-subtitle">
                  {successMsg ||
                    'Recebemos seus dados. Sua conta está em fase de análise pela equipe. Quando for aprovada, você poderá acessar com o e-mail e a senha que cadastrou. Se o envio de e-mail estiver ativo no servidor, verifique a sua caixa de entrada (e o spam) por mensagens de confirmação e de boas-vindas.'}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/50 px-4 py-3.5 text-[14px] leading-relaxed text-zinc-600">
              Enquanto isso, o acesso à plataforma permanece bloqueado até a aprovação. Em caso de dúvidas, fale com a sua
              instituição.
            </div>
            <div className="cadastro-btn-row pt-2">
              <Link to="/login" className="btn btn-primary w-full text-center no-underline block">
                Ir para o login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cadastro-page">
      <div className="cadastro-panel max-w-2xl">
        <div className="cadastro-panel-inner">
          <header className="flex flex-col items-center text-center space-y-4 stagger-1">
            <BrandLogo className="h-[4.25rem] w-auto select-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.06)]" linkToSite />
            <div className="space-y-2 max-w-lg">
              <p className="cadastro-kicker">Novo cadastro</p>
              <h1 className="cadastro-title">Associe-se à plataforma</h1>
              <p className="cadastro-subtitle">
                Etapas rápidas para enviar seus dados e documentos. Ao final, sua solicitação entra em análise.
              </p>
            </div>
          </header>

          <div className="space-y-3 stagger-2">
            <div className="flex justify-between items-baseline gap-4 text-[13px] text-zinc-500 font-medium">
              <span className="tabular-nums">
                Passo {step + 1} de {STEP_LABELS.length}
              </span>
              <span className="text-zinc-600 truncate text-right">{STEP_LABELS[step]}</span>
            </div>
            <div className="cadastro-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="cadastro-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

        <form
          className="space-y-6 stagger-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (step < STEP_LABELS.length - 1) {
              void goNext();
              return;
            }
            void handleSubmit(onSubmit)(e);
          }}
        >
          {error && <div className="cadastro-error">{error}</div>}

          {step === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
              <div className="sm:col-span-2">
                <label className="cadastro-field-label">Nome completo</label>
                <input {...formRegister('nomeCompleto')} className="cadastro-field" autoComplete="name" />
                {errors.nomeCompleto && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.nomeCompleto.message}</p>}
              </div>
              <div>
                <label className="cadastro-field-label">E-mail</label>
                <input type="email" {...formRegister('email')} className="cadastro-field" autoComplete="email" />
                {errors.email && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.email.message}</p>}
              </div>
              <div>
                <label className="cadastro-field-label">Telefone</label>
                <input {...formRegister('telefone')} className="cadastro-field" autoComplete="tel" />
                {errors.telefone && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.telefone.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="cadastro-field-label">CPF</label>
                <Controller
                  control={control}
                  name="cpf"
                  render={({ field }) => (
                    <input
                      {...field}
                      name="cpf"
                      className="cadastro-field"
                      placeholder="000.000.000-00"
                      autoComplete="off"
                      inputMode="numeric"
                      value={formatarCpfExibicao(field.value || '')}
                      onChange={(e) => field.onChange(cpfSomenteDigitos(e.target.value))}
                    />
                  )}
                />
                {errors.cpf && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.cpf.message}</p>}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="cadastro-field-label">Profissão</label>
                <select {...formRegister('profissao')} className="cadastro-field">
                  <option value="">Selecione</option>
                  {PROFISSOES_SAUDE.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {errors.profissao && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.profissao.message}</p>}
              </div>
              {exigeRegistroConselho && (
                <div>
                  <label className="cadastro-field-label">{labelRegistroConselho(profissao)}</label>
                  <input
                    {...formRegister('crm')}
                    className="cadastro-field"
                    placeholder={placeholderRegistroConselho(profissao)}
                    autoComplete="off"
                    maxLength={60}
                  />
                  {errors.crm && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.crm.message}</p>}
                </div>
              )}
              {isMedico && (
                <>
                  <div>
                    <label className="cadastro-field-label">Especialidades</label>
                    <input
                      type="text"
                      placeholder="Buscar…"
                      className="cadastro-field mb-2"
                      value={buscaEspecialidade}
                      onChange={(e) => setBuscaEspecialidade(e.target.value)}
                    />
                    <div className="max-h-44 overflow-y-auto rounded-2xl border border-zinc-200/70 bg-zinc-50/40 p-2.5 space-y-0.5 shadow-inner">
                      {especialidadesFiltradas.map((esp) => (
                        <label
                          key={esp}
                          className="flex items-center gap-3 cursor-pointer rounded-xl px-2 py-2 text-[14px] text-zinc-800 hover:bg-white/90 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={especialidadesSelecionadas.includes(esp)}
                            onChange={() => toggleEspecialidade(esp)}
                            className="rounded-md border-zinc-300 text-emerald-800 focus:ring-emerald-800/20"
                          />
                          <span>{esp}</span>
                        </label>
                      ))}
                    </div>
                    <p className="mt-2 text-[12px] text-zinc-500">Obrigatório marcar ao menos uma especialidade.</p>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="cadastro-field-label">Estado civil</label>
                <select {...formRegister('estadoCivil')} className="cadastro-field" required>
                  <option value="" disabled>
                    Selecione…
                  </option>
                  {ESTADOS_CIVIS.map((ec) => (
                    <option key={ec} value={ec}>
                      {ec}
                    </option>
                  ))}
                </select>
                {errors.estadoCivil && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.estadoCivil.message}</p>}
              </div>

              <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50/25 p-5 sm:p-6 space-y-5 shadow-inner">
                <p className="cadastro-section-title">Endereço residencial</p>

                <div>
                  <label className="cadastro-field-label">CEP</label>
                  <div className="flex items-center gap-3">
                    <Controller
                      control={control}
                      name="cep"
                      render={({ field }) => (
                        <input
                          {...field}
                          value={formatarCepExibicao(field.value || '')}
                          onChange={(e) => field.onChange(cepSomenteDigitos(e.target.value))}
                          className="cadastro-field max-w-[11rem]"
                          placeholder="00000-000"
                          inputMode="numeric"
                          autoComplete="postal-code"
                          aria-busy={cepAutoLoading}
                        />
                      )}
                    />
                    {cepAutoLoading && (
                      <span className="text-[12px] text-zinc-500 animate-pulse tabular-nums" aria-live="polite">
                        A consultar…
                      </span>
                    )}
                  </div>
                  {errors.cep && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.cep.message}</p>}
                  {cepAutoMensagem && (
                    <p
                      className={`mt-1.5 text-[12px] ${cepAutoMensagem.includes('Erro') || cepAutoMensagem.includes('não') ? 'text-amber-800/95' : 'text-emerald-800/95'}`}
                      role="status"
                    >
                      {cepAutoMensagem}
                    </p>
                  )}
                </div>

                <div>
                  <label className="cadastro-field-label">Logradouro</label>
                  <input {...formRegister('enderecoLogradouro')} className="cadastro-field" placeholder="Rua, avenida, travessa…" />
                  {errors.enderecoLogradouro && (
                    <p className="mt-1.5 text-[13px] text-red-600/95">{errors.enderecoLogradouro.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  <div>
                    <label className="cadastro-field-label">Número</label>
                    <input {...formRegister('enderecoNumero')} className="cadastro-field" placeholder="Nº" />
                    {errors.enderecoNumero && (
                      <p className="mt-1.5 text-[13px] text-red-600/95">{errors.enderecoNumero.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="cadastro-field-label">Complemento</label>
                    <input
                      {...formRegister('enderecoComplemento')}
                      className="cadastro-field"
                      placeholder="Apto, bloco, sala… ou S/C"
                      required
                    />
                    {errors.enderecoComplemento && (
                      <p className="mt-1.5 text-[13px] text-red-600/95">{errors.enderecoComplemento.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="cadastro-field-label">Bairro</label>
                  <input {...formRegister('enderecoBairro')} className="cadastro-field" />
                  {errors.enderecoBairro && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.enderecoBairro.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-5 gap-y-4">
                  <div className="sm:col-span-2">
                    <label className="cadastro-field-label">Cidade</label>
                    <input {...formRegister('enderecoCidade')} className="cadastro-field" />
                    {errors.enderecoCidade && (
                      <p className="mt-1.5 text-[13px] text-red-600/95">{errors.enderecoCidade.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="cadastro-field-label">UF</label>
                    <input
                      {...formRegister('enderecoUf')}
                      className="cadastro-field uppercase"
                      placeholder="SP"
                      maxLength={2}
                      autoComplete="address-level1"
                      onBlur={(e) => {
                        const v = e.target.value.trim().toUpperCase();
                        if (v) setValue('enderecoUf', v.slice(0, 2), { shouldValidate: true });
                      }}
                    />
                    {errors.enderecoUf && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.enderecoUf.message}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <p className="text-[15px] text-zinc-500 leading-relaxed">
                Informações para repasse — preenchimento obrigatório nesta etapa.
              </p>
              <div className="rounded-2xl border border-zinc-200/60 bg-zinc-50/25 p-5 sm:p-6 space-y-5 shadow-inner">
                <p className="cadastro-section-title">Dados bancários</p>
                <div>
                  <label className="cadastro-field-label">Conta</label>
                  <input
                    {...formRegister('dadosBancoConta')}
                    className="cadastro-field"
                    placeholder="Número da conta com dígito"
                    autoComplete="off"
                    required
                  />
                  {errors.dadosBancoConta && (
                    <p className="mt-1.5 text-[13px] text-red-600/95">{errors.dadosBancoConta.message}</p>
                  )}
                </div>
                <div>
                  <label className="cadastro-field-label">Agência</label>
                  <input
                    {...formRegister('dadosBancoAgencia')}
                    className="cadastro-field"
                    placeholder="Agência com dígito, se houver"
                    autoComplete="off"
                    required
                  />
                  {errors.dadosBancoAgencia && (
                    <p className="mt-1.5 text-[13px] text-red-600/95">{errors.dadosBancoAgencia.message}</p>
                  )}
                </div>
                <div>
                  <label className="cadastro-field-label">Banco</label>
                  <input
                    {...formRegister('dadosBancoNome')}
                    className="cadastro-field"
                    placeholder="Nome do banco"
                    autoComplete="organization"
                    required
                  />
                  {errors.dadosBancoNome && (
                    <p className="mt-1.5 text-[13px] text-red-600/95">{errors.dadosBancoNome.message}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="cadastro-field-label">Chave Pix</label>
                <input
                  {...formRegister('chavePix')}
                  className="cadastro-field"
                  placeholder="E-mail, telefone, EVP ou CPF"
                  required
                />
                {errors.chavePix && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.chavePix.message}</p>}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 max-h-[min(28rem,70vh)] overflow-y-auto pr-1">
              <p className="text-[15px] text-zinc-500 leading-relaxed">
                <span className="font-medium text-zinc-700">Obrigatórios: </span>
                documento do conselho profissional, certidão de regularidade fiscal no conselho, comprovante de endereço
                e RG/CPF ou CNH (identidade civil). Um ficheiro por tipo; PDF ou imagem, até 10 MB cada. Os restantes
                documentos são opcionais.
              </p>
              {DOCUMENTOS_PERFIL_CADASTRO_ORDEM.map((field) => {
                const obrigatorio = isDocumentoObrigatorioNoCadastro(field);
                return (
                <div
                  key={field}
                  className="rounded-2xl border border-zinc-200/70 bg-white/70 p-4 shadow-sm ring-1 ring-black/[0.02]"
                >
                  <p className="text-[13px] font-medium text-zinc-800 mb-2.5">
                    {DOCUMENTO_LABEL_BY_FIELD[field]}
                    {obrigatorio ? <span className="text-red-600/90"> *</span> : null}
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="block w-full text-[13px] text-zinc-600 file:mr-3 file:rounded-xl file:border-0 file:bg-zinc-100 file:px-3.5 file:py-2 file:text-[13px] file:font-medium file:text-zinc-800 hover:file:bg-zinc-200/80"
                    required={obrigatorio}
                    onChange={(ev) => {
                      const f = ev.target.files?.[0] || null;
                      setDocFiles((prev) => ({ ...prev, [field]: f }));
                    }}
                  />
                  {docFiles[field] && (
                    <p className="mt-2 text-[12px] text-emerald-800/90">Selecionado: {docFiles[field]!.name}</p>
                  )}
                </div>
              );
              })}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              <div>
                <label className="cadastro-field-label">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...formRegister('password')}
                    className="cadastro-field pr-12"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-800 rounded-lg transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {errors.password && <p className="mt-1.5 text-[13px] text-red-600/95">{errors.password.message}</p>}
              </div>
              <div>
                <label className="cadastro-field-label">Confirmar senha</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...formRegister('confirmPassword')}
                    className="cadastro-field pr-12"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-[13px] font-medium text-zinc-500 hover:text-zinc-800 rounded-lg transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="mt-1.5 text-[13px] text-red-600/95">{errors.confirmPassword.message}</p>
                )}
              </div>

              <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/40 p-4 space-y-3">
                <p className="text-[12px] font-medium text-zinc-600 uppercase tracking-wide">
                  Declaração e termos (versão {TERMOS_CADASTRO_VERSAO})
                </p>
                <p className="text-[14px] font-semibold text-zinc-900 leading-snug">{TERMOS_CADASTRO_TITULO}</p>
                <details className="group">
                  <summary className="cursor-pointer text-[14px] font-medium text-emerald-900 hover:text-emerald-800 list-none flex items-center gap-2">
                    <span className="select-none">▸</span>
                    Ler texto completo
                  </summary>
                  <div className="mt-3 max-h-52 overflow-y-auto rounded-xl border border-zinc-200/80 bg-white/90 p-3 text-[13px] text-zinc-700 leading-relaxed whitespace-pre-wrap font-normal">
                    {TERMOS_CADASTRO_TEXTO_COMPLETO}
                  </div>
                </details>
                <label className="flex items-start gap-3 cursor-pointer text-[14px] text-zinc-800 leading-snug">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-zinc-300 text-emerald-800 focus:ring-emerald-800/25"
                    {...formRegister('aceitouTermos')}
                  />
                  <span>
                    Declaro que li e aceito integralmente o texto acima; confirmo que os dados enviados são verdadeiros
                    e autorizo o tratamento dos mesmos pela plataforma e pela instituição, nos termos indicados.
                  </span>
                </label>
                {errors.aceitouTermos && (
                  <p className="text-[13px] text-red-600/95">{errors.aceitouTermos.message}</p>
                )}
              </div>
            </div>
          )}

          <div className="cadastro-btn-row flex flex-col-reverse sm:flex-row gap-3 pt-6 border-t border-zinc-100/90">
            {step > 0 ? (
              <button type="button" onClick={goBack} className="btn btn-secondary flex-1">
                Voltar
              </button>
            ) : (
              <Link to="/login" className="btn btn-secondary flex-1 text-center no-underline">
                Cancelar
              </Link>
            )}
            <button type="submit" disabled={isLoading} className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
              {step < STEP_LABELS.length - 1 ? 'Continuar' : isLoading ? 'Enviando…' : 'Enviar cadastro'}
            </button>
          </div>
        </form>

        <p className="text-center text-[14px] text-zinc-500 stagger-4 pt-1">
          Já possui conta aprovada?{' '}
          <Link to="/login" className="font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500 transition-colors">
            Acessar login
          </Link>
        </p>
        </div>
      </div>
    </div>
  );
};

export default Cadastro;
