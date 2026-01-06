import type { RefreshTokenRecord } from "./types";

export const DEFAULT_REFRESH_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const buildRefreshTokenKey = (token: string) => `refresh:${token}`;

export const serializeRefreshToken = (record: RefreshTokenRecord) =>
	JSON.stringify(record);

export const deserializeRefreshToken = (
	data: string | null,
): RefreshTokenRecord | null =>
	data ? (JSON.parse(data) as RefreshTokenRecord) : null;
