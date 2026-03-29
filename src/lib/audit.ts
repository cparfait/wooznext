/**
 * Structured audit logger for security-sensitive actions.
 * Writes JSON lines to stdout so they can be collected by any log aggregator
 * (Docker logs, syslog, Loki, etc.).
 *
 * Output format:
 *   {"ts":"2026-03-29T10:00:00.000Z","action":"LOGIN_SUCCESS","actorId":"...","email":"..."}
 */

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'AGENT_CREATED'
  | 'AGENT_UPDATED'
  | 'AGENT_DELETED'
  | 'PASSWORD_CHANGED_SELF'
  | 'PASSWORD_CHANGED_ADMIN'
  | 'QUEUE_RESET'
  | 'MIDNIGHT_CLEANUP';

export function auditLog(
  action: AuditAction,
  context: Record<string, string | number | boolean | null | undefined> = {}
) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      action,
      ...context,
    })
  );
}
