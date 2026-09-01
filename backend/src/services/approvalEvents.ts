import { config } from '../config.js';

/**
 * Fires an event to n8n's Approval Hand-off workflow when an item moves to
 * approval_status='approved' (see db/queryTable.ts updateApprovalStatus,
 * the single place this is called from). Best-effort and bounded — a
 * human's approval action must always succeed even if n8n is down,
 * unreachable, or unconfigured, so failures here are logged, never thrown,
 * and a short timeout prevents a hung n8n from stalling the approval
 * response.
 */
export async function emitApprovalEvent(resourceType: string, record: unknown): Promise<void> {
  if (!config.n8nApprovalWebhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    await fetch(config.n8nApprovalWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-Webhook-Secret': config.n8nWebhookSecret,
      },
      body: JSON.stringify({ resource_type: resourceType, record }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`[approvalEvents] Failed to emit event for ${resourceType}:`, err);
  } finally {
    clearTimeout(timeout);
  }
}
