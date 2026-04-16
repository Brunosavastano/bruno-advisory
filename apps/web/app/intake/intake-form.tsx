'use client';

import { investableAssetsBandValues, type PublicIntakeValidationError } from '@savastano-advisory/core/intake-contract';
import { useMemo, useState } from 'react';

type IntakeFormProps = {
  sourceLabel: string;
};

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'failed'; errors: PublicIntakeValidationError[] }
  | { status: 'succeeded'; leadId: string };

function eventFireAndForget(eventName: string, metadata?: Record<string, string | number | boolean | null>) {
  void fetch('/api/intake-events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ eventName, metadata })
  });
}

export function IntakeForm({ sourceLabel }: IntakeFormProps) {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });
  const [started, setStarted] = useState(false);

  const errorByField = useMemo(() => {
    if (submitState.status !== 'failed') {
      return new Map<string, string>();
    }

    return new Map(submitState.errors.map((error) => [error.field, error.message]));
  }, [submitState]);

  function markStarted() {
    if (started) {
      return;
    }

    setStarted(true);
    eventFireAndForget('t2_intake_started', { sourceLabel });
  }

  async function handleSubmit(formData: FormData) {
    setSubmitState({ status: 'submitting' });

    const payload = {
      fullName: String(formData.get('fullName') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      city: String(formData.get('city') ?? ''),
      state: String(formData.get('state') ?? ''),
      investableAssetsBand: String(formData.get('investableAssetsBand') ?? ''),
      primaryChallenge: String(formData.get('primaryChallenge') ?? ''),
      sourceLabel: String(formData.get('sourceLabel') ?? sourceLabel),
      privacyConsentAccepted: formData.get('privacyConsentAccepted') === 'on',
      termsConsentAccepted: formData.get('termsConsentAccepted') === 'on',
      sourceChannel: 'site_home'
    };

    const response = await fetch('/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as
      | { ok: true; leadId: string }
      | { ok: false; errors?: PublicIntakeValidationError[] };

    if (!result.ok) {
      setSubmitState({
        status: 'failed',
        errors: Array.isArray(result.errors)
          ? result.errors
          : [{ field: 'payload', message: 'Falha ao enviar intake. Tente novamente.' }]
      });
      return;
    }

    if (!response.ok) {
      setSubmitState({
        status: 'failed',
        errors: [{ field: 'payload', message: 'Falha ao enviar intake. Tente novamente.' }]
      });
      return;
    }

    setSubmitState({ status: 'succeeded', leadId: result.leadId });
  }

  if (submitState.status === 'succeeded') {
    return (
      <section className="card">
        <h2>Intake recebido</h2>
        <p>Seu registro foi salvo com sucesso. ID: {submitState.leadId}</p>
        <p>
          O lead já está disponível no <a href="/cockpit/leads">cockpit interno</a>.
        </p>
      </section>
    );
  }

  return (
    <form
      className="card form"
      action={async (formData) => {
        await handleSubmit(formData);
      }}
      onChange={markStarted}
    >
      <input type="hidden" name="sourceLabel" defaultValue={sourceLabel} />

      <h2>Formulário de intake</h2>
      <p className="hint">Campos essenciais para triagem inicial.</p>
      <p className="hint">
        Esta etapa não constitui recomendação individualizada de investimento. Consulte a{' '}
        <a href="/privacidade">Política de Privacidade</a> e os <a href="/termos">Termos de Uso</a> antes do envio.
      </p>

      <label>
        Nome completo
        <input name="fullName" required minLength={3} />
        {errorByField.get('fullName') ? <span className="error">{errorByField.get('fullName')}</span> : null}
      </label>

      <label>
        E-mail
        <input type="email" name="email" required />
        {errorByField.get('email') ? <span className="error">{errorByField.get('email')}</span> : null}
      </label>

      <label>
        Telefone
        <input name="phone" required />
        {errorByField.get('phone') ? <span className="error">{errorByField.get('phone')}</span> : null}
      </label>

      <div className="grid two">
        <label>
          Cidade (opcional)
          <input name="city" />
        </label>

        <label>
          Estado (opcional)
          <input name="state" />
        </label>
      </div>

      <label>
        Faixa de patrimônio investível
        <select name="investableAssetsBand" required defaultValue="">
          <option value="" disabled>
            Selecione
          </option>
          {investableAssetsBandValues.map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
        {errorByField.get('investableAssetsBand') ? (
          <span className="error">{errorByField.get('investableAssetsBand')}</span>
        ) : null}
      </label>

      <label>
        Qual seu principal desafio hoje?
        <textarea name="primaryChallenge" required minLength={15} rows={4} />
        {errorByField.get('primaryChallenge') ? (
          <span className="error">{errorByField.get('primaryChallenge')}</span>
        ) : null}
      </label>

      <label className="check">
        <input type="checkbox" name="privacyConsentAccepted" required />
        Concordo com a <a href="/privacidade">política de privacidade</a>.
      </label>
      {errorByField.get('privacyConsentAccepted') ? (
        <span className="error">{errorByField.get('privacyConsentAccepted')}</span>
      ) : null}

      <label className="check">
        <input type="checkbox" name="termsConsentAccepted" required />
        Concordo com os <a href="/termos">termos de uso</a>.
      </label>
      {errorByField.get('termsConsentAccepted') ? (
        <span className="error">{errorByField.get('termsConsentAccepted')}</span>
      ) : null}

      {errorByField.get('payload') ? <p className="error">{errorByField.get('payload')}</p> : null}

      <button className="btn" type="submit" disabled={submitState.status === 'submitting'}>
        {submitState.status === 'submitting' ? 'Enviando...' : 'Enviar intake'}
      </button>
    </form>
  );
}
