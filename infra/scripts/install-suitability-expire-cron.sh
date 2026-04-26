#!/usr/bin/env bash
# AI-3 Cycle 1.5 — instala systemd unit + timer da varredura de suitability
# expirados no servidor Contabo. Idempotente.
#
# Uso (rodar como root no Contabo, depois de git pull da branch correta):
#
#   bash infra/scripts/install-suitability-expire-cron.sh
#
# Pré-requisito: o arquivo /etc/savastano-advisory/cron.env precisa existir e
# conter a linha:
#
#   INTERNAL_CRON_TOKEN=<token-secreto>
#
# O mesmo token deve estar disponível como env var no container do app
# (docker-compose.yml, env section). Sem coincidência, a rota bloqueia (401).

set -euo pipefail

REPO_DIR="${REPO_DIR:-/root/savastano-advisory}"
SYSTEMD_DIR="/etc/systemd/system"
ENV_FILE="/etc/savastano-advisory/cron.env"

if [[ ! -f "${REPO_DIR}/infra/contabo/systemd/suitability-expire.service" ]]; then
  echo "ERRO: arquivo suitability-expire.service não encontrado em ${REPO_DIR}/infra/contabo/systemd/" >&2
  echo "Confirme que o repo está em ${REPO_DIR} e a branch correta foi puxada." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "ERRO: ${ENV_FILE} não existe. Crie-o com a linha INTERNAL_CRON_TOKEN=<token> antes de prosseguir." >&2
  exit 1
fi

# Garante permissão restrita do env file (token sensível).
chmod 600 "${ENV_FILE}"
chown root:root "${ENV_FILE}"

echo "Copiando unit + timer para ${SYSTEMD_DIR}..."
install -m 0644 "${REPO_DIR}/infra/contabo/systemd/suitability-expire.service" "${SYSTEMD_DIR}/suitability-expire.service"
install -m 0644 "${REPO_DIR}/infra/contabo/systemd/suitability-expire.timer" "${SYSTEMD_DIR}/suitability-expire.timer"

echo "Recarregando systemd..."
systemctl daemon-reload

echo "Habilitando + iniciando timer..."
systemctl enable --now suitability-expire.timer

echo
echo "Status do timer:"
systemctl list-timers suitability-expire.timer --no-pager

echo
echo "Pronto. Próxima execução agendada acima. Para testar agora:"
echo "  systemctl start suitability-expire.service"
echo "  journalctl -u suitability-expire.service -n 50 --no-pager"
