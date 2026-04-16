import { billingEntryModel, commercialStageModel, documentUploadModel, localBillingChargeModel, localBillingChargeProgressionModel, localBillingModel, localBillingSettlementModel, localBillingSettlementTargetingModel, memoModel, memoStatuses, recommendationCategories, recommendationModel, researchWorkflowModel, researchWorkflowStatuses } from '@savastano-advisory/core';
import { notFound } from 'next/navigation';
import { Fragment } from 'react';
import { LeadFlagsPanel } from './lead-flags-panel';
import { ResearchWorkflowsPanel } from './research-workflows-panel';
import { MemosPanel } from './memos-panel';
import {
  leadTaskStatuses,
  getIntakeStoragePaths,
  getLeadBillingReadiness,
  getLeadBillingRecord,
  listLeadBillingChargeEvents,
  listLeadBillingCharges,
  listLeadBillingEvents,
  listLeadBillingSettlementEvents,
  listLeadBillingSettlements,
  listInvitesByLeadId,
  listChecklistItems,
  listDocuments,
  listLeadInternalNotes,
  listLeadInternalTaskAudit,
  listLeadInternalTasks,
  listRecommendations,
  listWorkflows,
  listMemos,
  listLeadPendingFlags,
  getStoredLeadById,
  listLeadCommercialStageAudit,
  listAuditLog
} from '../../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function renderValue(value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  return value;
}

function renderTaskStatusLabel(status: string) {
  return status.replaceAll('_', ' ');
}

function renderCrmJsonArray(value: string | null | undefined) {
  if (!value) {
    return '-';
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join(', ') || '-' : value;
  } catch {
    return value;
  }
}

export default async function LeadDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ leadId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { leadId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const lead = getStoredLeadById(leadId);
  if (!lead) {
    notFound();
  }

  const auditRows = listLeadCommercialStageAudit(lead.leadId);
  const unifiedAuditLog = listAuditLog({ leadId: lead.leadId, limit: 20 });
  const portalInvites = listInvitesByLeadId(lead.leadId);
  const checklistItems = listChecklistItems(lead.leadId);
  const documents = listDocuments(lead.leadId);
  const researchWorkflows = listWorkflows(lead.leadId);
  const memos = listMemos(lead.leadId);
  const recommendations = listRecommendations(lead.leadId);
  const pendingFlags = listLeadPendingFlags(lead.leadId, 'active');
  const notes = listLeadInternalNotes(lead.leadId);
  const tasks = listLeadInternalTasks(lead.leadId);
  const taskAuditByTaskId = new Map(tasks.map((task) => [task.taskId, listLeadInternalTaskAudit(lead.leadId, task.taskId)]));
  const billingReadiness = getLeadBillingReadiness(lead.leadId);
  const billingRecord = getLeadBillingRecord(lead.leadId);
  const billingEvents = listLeadBillingEvents(lead.leadId, 20);
  const billingCharges = listLeadBillingCharges(lead.leadId, 20);
  const billingChargeEvents = listLeadBillingChargeEvents(lead.leadId, 20);
  const billingSettlements = listLeadBillingSettlements(lead.leadId, 20);
  const billingSettlementEvents = listLeadBillingSettlementEvents(lead.leadId, 20);
  const latestBillingCharge = billingCharges[0] ?? null;
  const eligibleChargeForSettlement = billingCharges.find((charge) => charge.status === 'pending_local') ?? null;
  const eligibleChargeForProgression = latestBillingCharge?.status === 'settled_local' ? latestBillingCharge : null;
  const storagePaths = getIntakeStoragePaths();

  if (!billingReadiness) {
    notFound();
  }

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit interno</div>
          <h1>Lead: {lead.fullName}</h1>
          <p>{lead.email}</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/review-queue">
            Review queue
          </a>
          <a className="btn btn-secondary" href="/cockpit/flags">
            Flags overview
          </a>
          <a className="btn btn-secondary" href="/cockpit/billing">
            Billing overview
          </a>
          <a className="btn btn-secondary" href={`/cockpit/audit-log?leadId=${lead.leadId}`}>
            Audit log do lead
          </a>
          <a className="btn btn-secondary" href="/cockpit/leads">
            Voltar para lista
          </a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Comercial T3</div>
        <p>
          Estágio atual: <strong>{commercialStageModel.labels[lead.commercialStage]}</strong>
        </p>
        <p className="hint">
          Modelo canônico: <code>{commercialStageModel.canonicalArtifact}</code>
        </p>

        <form
          className="form"
          method="post"
          action={`/api/cockpit/leads/${lead.leadId}/commercial-stage`}
          style={{ marginTop: 12 }}
        >
          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
          <input type="hidden" name="changedBy" value="operator_local" />

          <label>
            Novo estágio comercial
            <select name="toStage" defaultValue={lead.commercialStage} required>
              {commercialStageModel.stages.map((stage) => (
                <option key={stage} value={stage}>
                  {commercialStageModel.labels[stage]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Nota curta (opcional)
            <textarea
              name="note"
              rows={3}
              placeholder="Motivo da transição comercial"
              defaultValue=""
            />
          </label>

          <button className="btn" type="submit">
            Atualizar estágio
          </button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Unified audit log T5 cycle 4</div>
        <p>Últimos <strong>{unifiedAuditLog.length}</strong> eventos críticos deste lead.</p>
        {unifiedAuditLog.length === 0 ? (
          <p>Nenhum evento auditado ainda.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>action</th>
                  <th>entityType</th>
                  <th>entityId</th>
                  <th>actorType</th>
                  <th>detail</th>
                </tr>
              </thead>
              <tbody>
                {unifiedAuditLog.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.createdAt}</td>
                    <td>{entry.action}</td>
                    <td>{entry.entityType}</td>
                    <td>{entry.entityId}</td>
                    <td>{entry.actorType}</td>
                    <td>{entry.detail ? JSON.stringify(entry.detail) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Billing readiness T3</div>
        <p>
          Billing ready: <strong>{billingReadiness.isBillingReady ? 'YES' : 'NO'}</strong>
        </p>
        <p>
          Stage atual: <strong>{commercialStageModel.labels[billingReadiness.currentCommercialStage]}</strong>
        </p>
        <p>
          Tarefas: <strong>{billingReadiness.doneTasks}</strong> done de{' '}
          <strong>{billingReadiness.totalTasks}</strong> (pendentes: <strong>{billingReadiness.pendingTasks}</strong>)
        </p>
        <p className="hint">
          Modelo canônico: <code>{billingEntryModel.canonicalArtifact}</code>
        </p>
        {billingReadiness.isBillingReady ? (
          <p>Todas as condicoes minimas de entrada em billing foram atendidas.</p>
        ) : (
          <>
            <p>Condicoes pendentes:</p>
            <ul>
              {billingReadiness.unmetConditionLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Billing activation T3 cycle 5</div>
        {typeof resolvedSearchParams?.billingError === 'string' ? (
          <p style={{ color: '#b42318' }}>{resolvedSearchParams.billingError}</p>
        ) : null}
        {typeof resolvedSearchParams?.billingSuccess === 'string' ? (
          <p style={{ color: '#027a48' }}>Billing local criado com sucesso.</p>
        ) : null}
        {billingRecord ? (
          <>
            <p>
              Billing state: <strong>{billingRecord.status}</strong>
            </p>
            <p>
              Pricing canon T1: entrada <strong>R$ {(billingRecord.entryFeeCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>, mensalidade{' '}
              <strong>R$ {(billingRecord.monthlyFeeCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>, compromisso minimo{' '}
              <strong>{billingRecord.minimumCommitmentMonths} meses</strong>
            </p>
            <p>
              Currency: <strong>{billingRecord.currency}</strong> | activatedAt: <strong>{renderValue(billingRecord.activatedAt)}</strong>
            </p>
            <p className="hint">
              Modelo canônico: <code>{localBillingModel.canonicalArtifact}</code>
            </p>
          </>
        ) : (
          <>
            <p>Nenhum billing local criado ainda.</p>
            <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/billing-record`}>
              <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
              <input type="hidden" name="actor" value="operator_local" />
              <label>
                Nota curta (opcional)
                <textarea name="note" rows={3} placeholder="Motivo da ativacao local de billing" defaultValue="" />
              </label>
              <button className="btn" type="submit">Criar billing local</button>
            </form>
          </>
        )}

        <div style={{ marginTop: 12 }}>
          <p>
            Billing events persistidos: <strong>{billingEvents.length}</strong>
          </p>
          {billingEvents.length === 0 ? (
            <p>Nenhum evento de billing registrado ainda.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>occurredAt</th>
                    <th>eventType</th>
                    <th>actor</th>
                    <th>note</th>
                  </tr>
                </thead>
                <tbody>
                  {billingEvents.map((event) => (
                    <tr key={event.billingEventId}>
                      <td>{event.occurredAt}</td>
                      <td>{event.eventType}</td>
                      <td>{event.actor}</td>
                      <td>{renderValue(event.note)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Billing charge T3 cycles 6 and 8</div>
        {typeof resolvedSearchParams?.chargeError === 'string' ? (
          <p style={{ color: '#b42318' }}>{resolvedSearchParams.chargeError}</p>
        ) : null}
        {typeof resolvedSearchParams?.chargeSuccess === 'string' ? (
          <p style={{ color: '#027a48' }}>Primeira cobranca local criada com sucesso.</p>
        ) : null}
        {typeof resolvedSearchParams?.progressionError === 'string' ? (
          <p style={{ color: '#b42318' }}>{resolvedSearchParams.progressionError}</p>
        ) : null}
        {typeof resolvedSearchParams?.progressionSuccess === 'string' ? (
          <p style={{ color: '#027a48' }}>Proxima cobranca recorrente criada com sucesso.</p>
        ) : null}
        {typeof resolvedSearchParams?.targetedSettlementError === 'string' ? (
          <p style={{ color: '#b42318' }}>{resolvedSearchParams.targetedSettlementError}</p>
        ) : null}
        {typeof resolvedSearchParams?.targetedSettlementSuccess === 'string' ? (
          <p style={{ color: '#027a48' }}>Liquidacao direcionada por chargeId registrada com sucesso.</p>
        ) : null}
        {billingRecord ? (
          billingCharges.length === 0 ? (
            <>
              <p>Nenhuma cobranca recorrente local criada ainda.</p>
              <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/billing-charges`}>
                <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                <input type="hidden" name="actor" value="operator_local" />
                <label>
                  Nota curta (opcional)
                  <textarea name="note" rows={3} placeholder="Motivo da primeira cobranca local" defaultValue="" />
                </label>
                <button className="btn" type="submit">Criar primeira cobranca local</button>
              </form>
            </>
          ) : (
            <>
              <p>
                Ultima cobranca recorrente: <strong>sequencia {latestBillingCharge?.chargeSequence}</strong> em <strong>{latestBillingCharge?.status}</strong>
              </p>
              {eligibleChargeForProgression ? (
                <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/billing-charges/next`}>
                  <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                  <input type="hidden" name="actor" value="operator_local" />
                  <label>
                    Nota curta (opcional)
                    <textarea
                      name="note"
                      rows={3}
                      placeholder="Motivo da progressao para a proxima cobranca recorrente"
                      defaultValue=""
                    />
                  </label>
                  <button className="btn" type="submit">Criar proxima cobranca recorrente</button>
                </form>
              ) : latestBillingCharge?.status === 'pending_local' ? (
                <p>A progressao recorrente fica bloqueada enquanto a ultima cobranca permanecer em pending_local.</p>
              ) : (
                <p>A progressao recorrente exige uma cobranca anterior em settled_local.</p>
              )}
            </>
          )
        ) : (
          <p>Crie e ative o billing local antes de registrar cobrancas recorrentes.</p>
        )}

        <div style={{ marginTop: 12 }}>
          <p>
            Charge state visivel: <strong>{billingCharges.length}</strong>
          </p>
          {billingCharges.length === 0 ? (
            <p>Nenhuma cobranca persistida ainda.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>chargeSequence</th>
                    <th>chargeKind</th>
                    <th>status</th>
                    <th>amount</th>
                    <th>dueDate</th>
                    <th>createdAt</th>
                    <th>action</th>
                  </tr>
                </thead>
                <tbody>
                  {billingCharges.map((charge) => (
                    <tr key={charge.chargeId}>
                      <td>{charge.chargeSequence}</td>
                      <td>{charge.chargeKind}</td>
                      <td>{charge.status}</td>
                      <td>R$ {(charge.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td>{charge.dueDate}</td>
                      <td>{charge.createdAt}</td>
                      <td>
                        {charge.status === 'pending_local' ? (
                          <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/billing-settlements/${charge.chargeId}`}>
                            <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                            <input type="hidden" name="actor" value="operator_local" />
                            <label>
                              Nota curta (opcional)
                              <textarea
                                name="note"
                                rows={2}
                                placeholder={`Motivo da liquidacao da charge ${charge.chargeId}`}
                                defaultValue=""
                              />
                            </label>
                            <button className="btn" type="submit">Liquidar chargeId {charge.chargeId}</button>
                          </form>
                        ) : (
                          <span>Sem acao, charge nao pendente.</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <p>
            Charge events persistidos: <strong>{billingChargeEvents.length}</strong>
          </p>
          {billingChargeEvents.length === 0 ? (
            <p>Nenhum evento de cobranca registrado ainda.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>occurredAt</th>
                    <th>eventType</th>
                    <th>actor</th>
                    <th>chargeId</th>
                    <th>note</th>
                  </tr>
                </thead>
                <tbody>
                  {billingChargeEvents.map((event) => (
                    <tr key={event.chargeEventId}>
                      <td>{event.occurredAt}</td>
                      <td>{event.eventType}</td>
                      <td>{event.actor}</td>
                      <td>{event.chargeId}</td>
                      <td>{renderValue(event.note)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hint">
            Modelo canônico base: <code>{localBillingChargeModel.canonicalArtifact}</code>
          </p>
          <p className="hint">
            Regra de progressao: <code>{localBillingChargeProgressionModel.canonicalArtifact}</code>
          </p>
          <p className="hint">
            Regra de liquidacao direcionada: <code>{localBillingSettlementTargetingModel.canonicalArtifact}</code>
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Billing settlement direcionado por chargeId</div>
        {typeof resolvedSearchParams?.targetedSettlementError === 'string' ? (
          <p style={{ color: '#b42318' }}>{resolvedSearchParams.targetedSettlementError}</p>
        ) : null}
        {typeof resolvedSearchParams?.targetedSettlementSuccess === 'string' ? (
          <p style={{ color: '#027a48' }}>Liquidacao local direcionada registrada com sucesso.</p>
        ) : null}
        {eligibleChargeForSettlement ? (
          <>
            <p>
              Cobranca elegivel: <strong>{eligibleChargeForSettlement.chargeId}</strong> em <strong>{eligibleChargeForSettlement.status}</strong>
            </p>
            <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/billing-settlements/${eligibleChargeForSettlement.chargeId}`}>
              <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
              <input type="hidden" name="actor" value="operator_local" />
              <label>
                Nota curta (opcional)
                <textarea name="note" rows={3} placeholder={`Motivo da liquidacao da charge ${eligibleChargeForSettlement.chargeId}`} defaultValue="" />
              </label>
              <button className="btn" type="submit">Registrar liquidacao da charge {eligibleChargeForSettlement.chargeId}</button>
            </form>
          </>
        ) : (
          <p>Nenhuma cobranca local elegivel para liquidacao no momento.</p>
        )}

        <div style={{ marginTop: 12 }}>
          <p>
            Settlement state visivel: <strong>{billingSettlements.length}</strong>
          </p>
          {billingSettlements.length === 0 ? (
            <p>Nenhuma liquidacao persistida ainda.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>settledAt</th>
                    <th>status</th>
                    <th>amount</th>
                    <th>chargeId</th>
                    <th>settlementKind</th>
                  </tr>
                </thead>
                <tbody>
                  {billingSettlements.map((settlement) => (
                    <tr key={settlement.settlementId}>
                      <td>{settlement.settledAt}</td>
                      <td>{settlement.status}</td>
                      <td>R$ {(settlement.amountCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td>{settlement.chargeId}</td>
                      <td>{settlement.settlementKind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <p>
            Settlement events persistidos: <strong>{billingSettlementEvents.length}</strong>
          </p>
          {billingSettlementEvents.length === 0 ? (
            <p>Nenhum evento de liquidacao registrado ainda.</p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table>
                <thead>
                  <tr>
                    <th>occurredAt</th>
                    <th>eventType</th>
                    <th>actor</th>
                    <th>chargeId</th>
                    <th>note</th>
                  </tr>
                </thead>
                <tbody>
                  {billingSettlementEvents.map((event) => (
                    <tr key={event.settlementEventId}>
                      <td>{event.occurredAt}</td>
                      <td>{event.eventType}</td>
                      <td>{event.actor}</td>
                      <td>{event.chargeId}</td>
                      <td>{renderValue(event.note)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="hint">
            Modelo canônico: <code>{localBillingSettlementModel.canonicalArtifact}</code>
          </p>
        </div>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Portal invite codes T4 cycle 1</div>
        {typeof resolvedSearchParams?.portalInviteCreated === 'string' ? (
          <p style={{ color: '#027a48' }}>Invite code criado: <code>{resolvedSearchParams.portalInviteCreated}</code></p>
        ) : null}
        {typeof resolvedSearchParams?.portalInviteRevoked === 'string' ? (
          <p style={{ color: '#027a48' }}>Invite code revogado: <code>{resolvedSearchParams.portalInviteRevoked}</code></p>
        ) : null}

        <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/portal-invite-codes`}>
          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
          <button className="btn" type="submit">Criar invite code do portal</button>
        </form>

        {portalInvites.length === 0 ? (
          <p style={{ marginTop: 12 }}>Nenhum invite code criado ainda.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>inviteId</th>
                  <th>code</th>
                  <th>status</th>
                  <th>usedAt</th>
                  <th>revokedAt</th>
                  <th>action</th>
                </tr>
              </thead>
              <tbody>
                {portalInvites.map((invite) => (
                  <tr key={invite.inviteId}>
                    <td>{invite.createdAt}</td>
                    <td>{invite.inviteId}</td>
                    <td><code>{invite.code}</code></td>
                    <td>{invite.status}</td>
                    <td>{renderValue(invite.usedAt)}</td>
                    <td>{renderValue(invite.revokedAt)}</td>
                    <td>
                      {invite.status !== 'revoked' ? (
                        <form method="post" action={`/api/cockpit/leads/${lead.leadId}/portal-invite-codes/${invite.inviteId}/revoke`}>
                          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                          <button className="btn btn-secondary" type="submit">Revogar</button>
                        </form>
                      ) : (
                        <span>Revogado</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Checklist de onboarding T4 cycle 2</div>
        {typeof resolvedSearchParams?.checklistCreated === 'string' ? (
          <p style={{ color: '#027a48' }}>Checklist item criado com sucesso.</p>
        ) : null}
        {typeof resolvedSearchParams?.checklistDeleted === 'string' ? (
          <p style={{ color: '#027a48' }}>Checklist item removido com sucesso.</p>
        ) : null}
        {typeof resolvedSearchParams?.checklistUncompleted === 'string' ? (
          <p style={{ color: '#027a48' }}>Checklist item reaberto com sucesso.</p>
        ) : null}

        <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/checklist`}>
          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
          <label>
            Título
            <input name="title" type="text" placeholder="Ex.: Enviar documento de identidade" required />
          </label>
          <label>
            Descrição (opcional)
            <textarea name="description" rows={2} placeholder="Detalhes curtos para orientar o cliente." />
          </label>
          <button className="btn" type="submit">Criar item</button>
        </form>

        {checklistItems.length === 0 ? (
          <p style={{ marginTop: 12 }}>Nenhum item criado ainda.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>title</th>
                  <th>description</th>
                  <th>status</th>
                  <th>completedAt</th>
                  <th>completedBy</th>
                  <th>actions</th>
                </tr>
              </thead>
              <tbody>
                {checklistItems.map((item) => (
                  <tr key={item.itemId}>
                    <td>{item.createdAt}</td>
                    <td>{item.title}</td>
                    <td>{renderValue(item.description)}</td>
                    <td>{item.status}</td>
                    <td>{renderValue(item.completedAt)}</td>
                    <td>{renderValue(item.completedBy)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {item.status === 'completed' ? (
                          <form method="post" action={`/api/cockpit/leads/${lead.leadId}/checklist/${item.itemId}`}>
                            <input type="hidden" name="intent" value="uncomplete" />
                            <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                            <button className="btn btn-secondary" type="submit">Desmarcar</button>
                          </form>
                        ) : null}
                        <form method="post" action={`/api/cockpit/leads/${lead.leadId}/checklist/${item.itemId}`}>
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                          <button className="btn btn-secondary" type="submit">Excluir</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ResearchWorkflowsPanel
        leadId={lead.leadId}
        initialWorkflows={researchWorkflows}
        statuses={researchWorkflowStatuses}
        canonicalArtifact={researchWorkflowModel.canonicalArtifact}
      />

      <MemosPanel
        leadId={lead.leadId}
        initialMemos={memos}
        workflows={researchWorkflows}
        statuses={memoStatuses}
        canonicalArtifact={memoModel.canonicalArtifact}
      />

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Recommendation ledger T4 cycle 4</div>
        {typeof resolvedSearchParams?.recommendationCreated === 'string' ? (
          <p style={{ color: '#027a48' }}>Recomendacao criada com sucesso.</p>
        ) : null}
        {typeof resolvedSearchParams?.recommendationPublished === 'string' ? (
          <p style={{ color: '#027a48' }}>Recomendacao publicada com sucesso.</p>
        ) : null}
        {typeof resolvedSearchParams?.recommendationDeleted === 'string' ? (
          <p style={{ color: '#027a48' }}>Recomendacao removida com sucesso.</p>
        ) : null}
        <p className="hint">
          Modelo canônico: <code>{recommendationModel.canonicalArtifact}</code>
        </p>
        <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/recommendations`}>
          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
          <input type="hidden" name="createdBy" value="operator_local" />
          <label>
            Título
            <input name="title" type="text" placeholder="Ex.: Rebalanceamento tático da carteira" required />
          </label>
          <label>
            Categoria (opcional)
            <select name="category" defaultValue="">
              <option value="">Sem categoria</option>
              {recommendationCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label>
            Corpo
            <textarea name="body" rows={5} placeholder="Escreva a recomendação para o cliente." required />
          </label>
          <button className="btn" type="submit">Criar recomendação</button>
        </form>

        {recommendations.length === 0 ? (
          <p style={{ marginTop: 12 }}>Nenhuma recomendação registrada ainda.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>title</th>
                  <th>category</th>
                  <th>visibility</th>
                  <th>publishedAt</th>
                  <th>createdBy</th>
                  <th>body</th>
                  <th>actions</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((recommendation) => (
                  <tr key={recommendation.recommendationId}>
                    <td>{recommendation.createdAt}</td>
                    <td>{recommendation.title}</td>
                    <td>{renderValue(recommendation.category)}</td>
                    <td>{recommendation.visibility}</td>
                    <td>{renderValue(recommendation.publishedAt)}</td>
                    <td>{recommendation.createdBy}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{recommendation.body}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {recommendation.visibility === 'draft' ? (
                          <form method="post" action={`/api/cockpit/leads/${lead.leadId}/recommendations/${recommendation.recommendationId}`}>
                            <input type="hidden" name="intent" value="publish" />
                            <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                            <button className="btn btn-secondary" type="submit">Publicar</button>
                          </form>
                        ) : (
                          <span>Publicado</span>
                        )}
                        <form method="post" action={`/api/cockpit/leads/${lead.leadId}/recommendations/${recommendation.recommendationId}`}>
                          <input type="hidden" name="intent" value="delete" />
                          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                          <button className="btn btn-secondary" type="submit">Excluir</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Documentos T4 cycle 3</div>
        {typeof resolvedSearchParams?.documentReviewSuccess === 'string' ? (
          <p style={{ color: '#027a48' }}>Documento revisado com sucesso.</p>
        ) : null}
        <p className="hint">
          Modelo canônico: <code>{documentUploadModel.canonicalArtifact}</code>
        </p>
        {documents.length === 0 ? (
          <p>Nenhum documento enviado ainda.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>uploadedAt</th>
                  <th>originalFilename</th>
                  <th>sizeBytes</th>
                  <th>mimeType</th>
                  <th>status</th>
                  <th>storedFilename</th>
                  <th>review</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.documentId}>
                    <td>{document.uploadedAt}</td>
                    <td>{document.originalFilename}</td>
                    <td>{document.sizeBytes}</td>
                    <td>{document.mimeType}</td>
                    <td>{document.status}</td>
                    <td><code>{`data/dev/uploads/${document.leadId}/${document.storedFilename}`}</code></td>
                    <td>
                      <form method="post" action={`/api/cockpit/leads/${lead.leadId}/documents/${document.documentId}`}>
                        <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                        <input type="hidden" name="reviewedBy" value="operator_local" />
                        <select name="status" defaultValue={document.status}>
                          {documentUploadModel.statuses.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <input name="reviewNote" type="text" defaultValue={document.reviewNote ?? ''} placeholder="Nota curta" />
                        <button className="btn btn-secondary" type="submit">Salvar</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">CRM T3.5 cycle 5</div>
        <p>Cidade/estado: {renderValue(lead.cidadeEstado)}</p>
        <p>Ocupação/perfil: {renderValue(lead.ocupacaoPerfil)}</p>
        <p>Nível de fit: {renderValue(lead.nivelDeFit)}</p>
        <p>Motivo sem fit: {renderValue(lead.motivoSemFit)}</p>
        <p>Owner: {renderValue(lead.owner)}</p>
        <p>Data call qualificação: {renderValue(lead.dataCallQualificacao)}</p>
        <p>Resumo call: {renderValue(lead.resumoCall)}</p>
        <p>Interesse na oferta: {renderValue(lead.interesseNaOferta)}</p>
        <p>Checklist onboarding: {renderCrmJsonArray(lead.checklistOnboarding)}</p>
        <p>Cadência acordada: {renderValue(lead.cadenciaAcordada)}</p>
        <p>Próximo passo: {renderValue(lead.proximoPasso)}</p>
        <p>Risco de churn: {renderValue(lead.riscoDeChurn)}</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">CRM fields T3.5 cycle 5</div>
        {typeof resolvedSearchParams?.crmFieldsSuccess === 'string' ? (
          <p style={{ color: '#027a48' }}>Campos de CRM atualizados com sucesso.</p>
        ) : null}
        <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/crm-fields`}>
          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />

          <label>
            cidade_estado
            <input name="cidade_estado" type="text" defaultValue={lead.cidadeEstado ?? ''} />
          </label>
          <label>
            ocupacao_perfil
            <input name="ocupacao_perfil" type="text" defaultValue={lead.ocupacaoPerfil ?? ''} />
          </label>
          <label>
            nivel_de_fit
            <select name="nivel_de_fit" defaultValue={lead.nivelDeFit ?? ''}>
              <option value="">-</option>
              <option value="alto">alto</option>
              <option value="medio">medio</option>
              <option value="baixo">baixo</option>
            </select>
          </label>
          <label>
            motivo_sem_fit
            <textarea name="motivo_sem_fit" rows={2} defaultValue={lead.motivoSemFit ?? ''} />
          </label>
          <label>
            owner
            <input name="owner" type="text" defaultValue={lead.owner ?? ''} />
          </label>
          <label>
            data_call_qualificacao
            <input name="data_call_qualificacao" type="date" defaultValue={lead.dataCallQualificacao ?? ''} />
          </label>
          <label>
            resumo_call
            <textarea name="resumo_call" rows={3} defaultValue={lead.resumoCall ?? ''} />
          </label>
          <label>
            interesse_na_oferta
            <select name="interesse_na_oferta" defaultValue={lead.interesseNaOferta ?? ''}>
              <option value="">-</option>
              <option value="alto">alto</option>
              <option value="medio">medio</option>
              <option value="baixo">baixo</option>
            </select>
          </label>
          <label>
            checklist_onboarding
            <textarea name="checklist_onboarding" rows={2} defaultValue={lead.checklistOnboarding ?? ''} />
          </label>
          <label>
            cadencia_acordada
            <input name="cadencia_acordada" type="text" defaultValue={lead.cadenciaAcordada ?? ''} />
          </label>
          <label>
            proximo_passo
            <textarea name="proximo_passo" rows={2} defaultValue={lead.proximoPasso ?? ''} />
          </label>
          <label>
            risco_de_churn
            <select name="risco_de_churn" defaultValue={lead.riscoDeChurn ?? ''}>
              <option value="">-</option>
              <option value="alto">alto</option>
              <option value="medio">medio</option>
              <option value="baixo">baixo</option>
            </select>
          </label>

          <button className="btn" type="submit">Atualizar CRM</button>
        </form>
      </section>


      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Resumo do lead</div>
        <p>Telefone: {lead.phone}</p>
        <p>Status intake (T2): {lead.status}</p>
        <p>Patrimônio: {lead.investableAssetsBand}</p>
        <p>Canal: {lead.sourceChannel}</p>
        <p>Label: {lead.sourceLabel}</p>
        <p>Desafio principal: {lead.primaryChallenge}</p>
        <p className="hint">DB: {storagePaths.database}</p>
        <p className="hint">Tabela de notas: {storagePaths.notesTable}</p>
        <p className="hint">Tabela de tarefas: {storagePaths.tasksTable}</p>
        <p className="hint">Tabela de auditoria de tarefas: {storagePaths.taskAuditTable}</p>
        <p className="hint">Tabela de billing records: {storagePaths.billingRecordsTable}</p>
        <p className="hint">Tabela de billing events: {storagePaths.billingEventsTable}</p>
        <p className="hint">Tabela de billing charges: {storagePaths.billingChargesTable}</p>
        <p className="hint">Tabela de billing charge events: {storagePaths.billingChargeEventsTable}</p>
        <p className="hint">Tabela de billing settlements: {storagePaths.billingSettlementsTable}</p>
        <p className="hint">Tabela de billing settlement events: {storagePaths.billingSettlementEventsTable}</p>
        <p className="hint">Tabela de recomendações: {storagePaths.leadRecommendationsTable}</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Notas internas</div>
        <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/notes`}>
          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
          <input type="hidden" name="authorMarker" value="operator_local" />

          <label>
            Conteúdo da nota
            <textarea name="content" rows={3} placeholder="Registrar contexto operacional." required />
          </label>

          <button className="btn" type="submit">
            Criar nota interna
          </button>
        </form>

        {notes.length === 0 ? (
          <p style={{ marginTop: 12 }}>Nenhuma nota registrada ainda.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>authorMarker</th>
                  <th>content</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr key={note.noteId}>
                    <td>{note.createdAt}</td>
                    <td>{note.authorMarker}</td>
                    <td>{note.content}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Tarefas internas</div>
        <form className="form" method="post" action={`/api/cockpit/leads/${lead.leadId}/tasks`}>
          <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />

          <label>
            Título
            <input name="title" type="text" placeholder="Próxima ação operacional." required />
          </label>

          <label>
            Status
            <select name="status" defaultValue="todo" required>
              {leadTaskStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label>
            Vencimento (opcional)
            <input name="dueDate" type="date" />
          </label>

          <button className="btn" type="submit">
            Criar tarefa interna
          </button>
        </form>

        {tasks.length === 0 ? (
          <p style={{ marginTop: 12 }}>Nenhuma tarefa registrada ainda.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>title</th>
                  <th>status</th>
                  <th>dueDate</th>
                  <th>mudarStatus</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => {
                  const taskAudit = taskAuditByTaskId.get(task.taskId) ?? [];
                  return (
                    <Fragment key={task.taskId}>
                      <tr>
                        <td>{task.createdAt}</td>
                        <td>{task.title}</td>
                        <td>{renderTaskStatusLabel(task.status)}</td>
                        <td>{renderValue(task.dueDate)}</td>
                        <td>
                          <form
                            className="form"
                            method="post"
                            action={`/api/cockpit/leads/${lead.leadId}/tasks/${task.taskId}/status`}
                          >
                            <input type="hidden" name="returnTo" value={`/cockpit/leads/${lead.leadId}`} />
                            <input type="hidden" name="changedBy" value="operator_local" />
                            <label>
                              Novo status
                              <select name="toStatus" defaultValue={task.status} required>
                                {leadTaskStatuses.map((status) => (
                                  <option key={`${task.taskId}-${status}`} value={status}>
                                    {renderTaskStatusLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <button className="btn" type="submit">
                              Atualizar
                            </button>
                          </form>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={5}>
                          <p style={{ marginBottom: 8 }}>
                            <strong>Auditoria da tarefa</strong>
                          </p>
                          {taskAudit.length === 0 ? (
                            <p>Nenhuma transição de status registrada ainda.</p>
                          ) : (
                            <table>
                              <thead>
                                <tr>
                                  <th>changedAt</th>
                                  <th>fromStatus</th>
                                  <th>toStatus</th>
                                  <th>changedBy</th>
                                </tr>
                              </thead>
                              <tbody>
                                {taskAudit.map((entry) => (
                                  <tr key={entry.auditId}>
                                    <td>{entry.changedAt}</td>
                                    <td>{entry.fromStatus ? renderTaskStatusLabel(entry.fromStatus) : '-'}</td>
                                    <td>{renderTaskStatusLabel(entry.toStatus)}</td>
                                    <td>{entry.changedBy}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Auditoria de estágio comercial</div>
        {auditRows.length === 0 ? (
          <p>Nenhuma transição registrada ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>changedAt</th>
                  <th>fromStage</th>
                  <th>toStage</th>
                  <th>changedBy</th>
                  <th>note</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((entry) => (
                  <tr key={entry.auditId}>
                    <td>{entry.changedAt}</td>
                    <td>{entry.fromStage ? commercialStageModel.labels[entry.fromStage] : '-'}</td>
                    <td>{commercialStageModel.labels[entry.toStage]}</td>
                    <td>{entry.changedBy}</td>
                    <td>{renderValue(entry.note)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
