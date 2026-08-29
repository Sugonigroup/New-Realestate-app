/** SLA clocks — WP-1A: first WhatsApp ack ≤15 min, human response ≤2 h. */

export function slaRespondBy(createdAt: Date): Date {
  return new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
}

export function slaAckBy(createdAt: Date): Date {
  return new Date(createdAt.getTime() + 15 * 60 * 1000);
}

export function isSlaBreached(lead: { slaRespondBy?: Date | null; firstRespondedAt?: Date | null }, now: Date): boolean {
  return !lead.firstRespondedAt && !!lead.slaRespondBy && lead.slaRespondBy.getTime() < now.getTime();
}
