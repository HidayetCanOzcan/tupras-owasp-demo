import type { SessionRecord } from "./types";

export const DEFAULT_EXPIRY_SECONDS = 60 * 60 * 24;

export const buildSessionKey = (sessionId: string) => `session:${sessionId}`;

export const serializeSession = (record: SessionRecord) =>
	JSON.stringify(record);

export const deserializeSession = (
	data: string | null,
): SessionRecord | null => (data ? (JSON.parse(data) as SessionRecord) : null);
