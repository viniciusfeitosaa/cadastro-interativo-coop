import { useEffect, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import {
  bancosOptions,
  categoriaProfissionalOptions,
  conselhoClasseOptions,
  estadoCivilOptions,
  grauInstrucaoOptions,
  orgaoExpedicaoRgOptions,
  regimeComunhaoOptions,
  sexoOptions,
  tipoSanguineoOptions,
  ufOptions,
} from '../../data/formOptions'
import type { FormData } from '../../schemas/formSchema'
import { GCOOP_AREA_COOPERADO_URL } from '../../../../constants/gcoopPortal'
import {
  maskAgencia,
  maskCep,
  maskConta,
  maskCpf,
  maskDigito,
  maskPis,
} from '../../utils/masks'
import {
  FileField,
  PhoneGroup,
  SelectField,
  TextField,
} from '../ui/FormControls'

function useMaskedField(name: keyof FormData, maskFn: (v: string) => string) {
  const { register, setValue } = useFormContext<FormData>()
  const { onBlur, ref } = register(name)

  return {
    onBlur,
    ref,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = maskFn(e.target.value)
      setValue(name, masked as FormData[typeof name], { shouldDirty: true })
    },
  }
}

/** Cidades da UF de naturalidade via IBGE — evita Nilópolis+CE e similares. */
function NaturalidadeCidadeField() {
  const { watch, setValue } = useFormContext<FormData>()
  const uf = watch('estadoNaturalidade')
  const [options, setOptions] = useState<{ value: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const sigla = (uf || '').trim().toUpperCase().slice(0, 2)
    setValue('cidadeNaturalidade', '', { shouldDirty: true })
    if (!sigla) {
      setOptions([])
      return
    }

    let cancelled = false
    setLoading(true)
    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(sigla)}/municipios?orderBy=nome`,
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: Array<{ nome?: string }>) => {
        if (cancelled) return
        const opts = (Array.isArray(data) ? data : [])
          .map((c) => String(c?.nome || '').trim())
          .filter(Boolean)
          .map((nome) => ({ value: nome, label: nome }))
        setOptions(opts)
      })
      .catch(() => {
        if (!cancelled) setOptions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [uf, setValue])

  if (!uf) {
    return (
      <TextField
        name="cidadeNaturalidade"
        label="Cidade da naturalidade"
        placeholder="Selecione primeiro o estado"
        disabled
      />
    )
  }

  if (options.length > 0) {
    return (
      <SelectField
        key={uf}
        name="cidadeNaturalidade"
        label="Cidade da naturalidade"
        options={options}
        placeholder={loading ? 'Carregando cidades…' : 'Selecione a cidade'}
      />
    )
  }

  return (
    <TextField
      name="cidadeNaturalidade"
      label="Cidade da naturalidade"
      placeholder={loading ? 'Carregando…' : 'Cidade de nascimento'}
    />
  )
}

export function StepIdentificacao() {
  const { watch } = useFormContext<FormData>()
  const estadoCivil = watch('estadoCivil')
  const cpfField = useMaskedField('cpf', maskCpf)
  const pisField = useMaskedField('pis', maskPis)

  return (
    <div className="step-grid">
      <TextField
        name="nomeCompleto"
        label="Nome completo do proponente"
        placeholder="Como consta nos documentos"
        className="span-2"
      />
      <TextField
        name="email"
        label="E-mail do proponente"
        type="email"
        placeholder="seu@email.com"
      />
      <TextField
        name="cpf"
        label="CPF do proponente"
        placeholder="000.000.000-00"
        inputMode="numeric"
        {...cpfField}
      />
      <TextField
        name="pis"
        label="Número do PIS do proponente"
        placeholder="000.00000.00-0"
        inputMode="numeric"
        {...pisField}
      />
      <TextField name="dataNascimento" label="Data de nascimento" type="date" />
      <SelectField name="sexo" label="Sexo" options={sexoOptions} />
      <SelectField
        name="estadoCivil"
        label="Estado civil"
        options={estadoCivilOptions}
      />
      {estadoCivil === 'casado' && (
        <SelectField
          name="regimeComunhao"
          label="Regime de comunhão"
          options={regimeComunhaoOptions}
        />
      )}
      <SelectField
        name="tipoSanguineo"
        label="Tipo sanguíneo"
        options={tipoSanguineoOptions}
      />
      <SelectField
        name="grauInstrucao"
        label="Grau de instrução"
        options={grauInstrucaoOptions}
      />
      <TextField
        name="nacionalidade"
        label="Nacionalidade"
        placeholder="Ex.: Brasileira"
      />
      <SelectField
        name="estadoNaturalidade"
        label="Estado da naturalidade"
        options={ufOptions}
      />
      <NaturalidadeCidadeField />
      <TextField name="nomePai" label="Nome do pai" placeholder="Nome completo" />
      <TextField name="nomeMae" label="Nome da mãe" placeholder="Nome completo" />
    </div>
  )
}

export function StepDocumentos() {
  return (
    <div className="step-grid">
      <TextField name="rg" label="RG do proponente" placeholder="Número do RG (não use o CPF)" />
      <TextField
        name="rgDataExpedicao"
        label="Data de expedição do RG"
        type="date"
      />
      <SelectField
        name="rgOrgaoExpedicao"
        label="Órgão de expedição do RG"
        options={orgaoExpedicaoRgOptions}
      />
      <SelectField
        name="rgUfOrgao"
        label="UF do órgão de expedição"
        options={ufOptions}
      />
      <TextField
        name="tituloEleitor"
        label="Número do título de eleitor"
        placeholder="0000 0000 0000"
        className="span-2"
      />
    </div>
  )
}

export function StepEndereco() {
  const { setValue } = useFormContext<FormData>()
  const cepField = useMaskedField('cep', maskCep)

  async function buscarCep(rawCep: string) {
    const cep = rawCep.replace(/\D/g, '')
    if (cep.length !== 8) return

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
      const data = await res.json()
      if (data.erro) return

      setValue('rua', data.logradouro ?? '')
      setValue('bairro', data.bairro ?? '')
      setValue('cidade', data.localidade ?? '')
      setValue('estado', data.uf ?? '')
    } catch {
      /* silencioso — usuário preenche manualmente */
    }
  }

  return (
    <div className="step-grid">
      <TextField
        name="cep"
        label="CEP"
        placeholder="00000-000"
        inputMode="numeric"
        {...cepField}
        onBlur={(e) => {
          cepField.onBlur(e)
          void buscarCep(e.target.value)
        }}
      />
      <TextField name="rua" label="Rua" placeholder="Logradouro" className="span-2" />
      <TextField name="numero" label="Número" placeholder="Nº" />
      <TextField name="bairro" label="Bairro" placeholder="Bairro" />
      <SelectField name="estado" label="Estado" options={ufOptions} />
      <TextField name="cidade" label="Cidade" placeholder="Cidade" />
      <TextField
        name="complemento"
        label="Complemento"
        placeholder="Apto, bloco, referência..."
        required={false}
        className="span-2"
      />
      <PhoneGroup
        dddName="dddResidencial"
        phoneName="telefoneResidencial"
        label="Telefone residencial"
      />
      <PhoneGroup
        dddName="dddCelular"
        phoneName="telefoneCelular"
        label="Telefone celular"
      />
      <TextField
        name="pix"
        label="Chave PIX"
        placeholder="CPF, e-mail, telefone ou chave aleatória"
        className="span-2"
        hint="Informe a chave PIX para recebimentos futuros"
      />
    </div>
  )
}

export function StepProfissional() {
  return (
    <div className="step-grid">
      <SelectField
        name="conselhoClasse"
        label="Conselho de classe"
        options={conselhoClasseOptions}
      />
      <TextField
        name="numeroConselho"
        label="Número no conselho"
        placeholder="Registro profissional"
      />
      <SelectField
        name="categoriaProfissional"
        label="Categoria profissional"
        options={categoriaProfissionalOptions}
      />
      <TextField
        name="categoriaProfissionalDetalhe"
        label="Qual a categoria profissional?"
        placeholder="Descreva sua categoria"
      />
      <TextField
        name="especialidadeProfissional"
        label="Especialidade profissional"
        placeholder="Área de atuação"
        className="span-2"
      />
    </div>
  )
}

export function StepBancario() {
  const agenciaField = useMaskedField('agencia', maskAgencia)
  const contaField = useMaskedField('conta', maskConta)
  const digitoField = useMaskedField('digitoConta', maskDigito)

  return (
    <div className="step-grid">
      <SelectField name="banco" label="Banco" options={bancosOptions} className="span-2" />
      <TextField
        name="agencia"
        label="Agência"
        placeholder="0000"
        inputMode="numeric"
        {...agenciaField}
      />
      <TextField
        name="conta"
        label="Conta"
        placeholder="00000000"
        inputMode="numeric"
        {...contaField}
      />
      <TextField
        name="digitoConta"
        label="Dígito da conta"
        placeholder="0"
        inputMode="numeric"
        maxLength={2}
        {...digitoField}
      />
    </div>
  )
}

export function StepAnexos() {
  return (
    <div className="step-grid attachments">
      <p className="attachments-intro span-2">
        Envie cópias legíveis dos documentos. Formatos aceitos: PDF, JPG ou PNG.
      </p>
      <FileField name="certidaoNegativaConselho" label="Certidão negativa do conselho" />
      <FileField name="carteiraConselho" label="Carteira do conselho" />
      <FileField name="declaracaoInss" label="Declaração do INSS" />
      <FileField name="foto3x4" label="Foto 3×4" accept=".jpg,.jpeg,.png" />
      <FileField name="comprovanteResidencia" label="Comprovante de residência" />
      <FileField name="rgCnh" label="RG (CNH) do proponente" />
      <FileField name="pisNitPasep" label="PIS, NIT ou PASEP" />
      <FileField name="cpfDocumento" label="CPF do proponente (documento)" />
      <FileField name="cartaoBancario" label="Cartão bancário" />
      <FileField name="curriculumVitae" label="Curriculum Vitae" accept=".pdf,.doc,.docx" />
      <FileField name="cartaoVacina" label="Cartão de vacina" />
      <FileField name="certificadoCurso" label="Certificado de curso profissional (diploma)" />
      <FileField name="aph" label="APH" required={false} />
    </div>
  )
}

export function StepConsentimento() {
  const {
    register,
    formState: { errors },
  } = useFormContext<FormData>()

  return (
    <div className="consent-step">
      <div className="consent-card">
        <h3>Finalização do pré-cadastro</h3>
        <p>
          Seus dados serão enviados para análise da equipe COOPVITTA e integrados ao sistema
          Gcoop após aprovação. Não é necessário criar senha nesta etapa.
        </p>
        <p>
          Após a aprovação, você acessará a{' '}
          <strong>área do cooperado no Gcoop</strong> (
          <a href={GCOOP_AREA_COOPERADO_URL} target="_blank" rel="noopener noreferrer">
            {GCOOP_AREA_COOPERADO_URL.replace(/^https?:\/\//, '')}
          </a>
          ). A senha de entrada é definida diretamente nesse portal — não neste formulário.
        </p>
      </div>

      <div className="consent-card">
        <h3>Termo de Consentimento</h3>
        <p>
          Para iniciar o processo de pré-cadastro para se tornar sócio-cooperado da{' '}
          <strong>COOPVITTA</strong> — Cooperativa de Trabalho dos Profissionais e
          Assistenciais à Vida e à Saúde, solicitamos seu consentimento nos termos da{' '}
          <strong>Lei nº 13.709/2018</strong> (Lei Geral de Proteção de Dados Pessoais
          — LGPD).
        </p>
        <p>
          Os dados serão tratados apenas para análise de perfil, banco de dados e
          possíveis convocações futuras, conforme descrito no termo completo.
        </p>
        <label className="consent-checkbox">
          <input type="checkbox" {...register('termoConsentimento')} />
          <span>
            Você autoriza o tratamento dos dados pessoais conforme descrito acima?
          </span>
        </label>
        {errors.termoConsentimento && (
          <span className="field-error">{errors.termoConsentimento.message}</span>
        )}
      </div>
    </div>
  )
}

export const STEP_COMPONENTS = [
  StepIdentificacao,
  StepDocumentos,
  StepEndereco,
  StepProfissional,
  StepBancario,
  StepAnexos,
  StepConsentimento,
]
