import { RedisManager } from "../../../../Managers/Redis";
import { signJWT } from "../../JWT";
import type { GenerateRefreshTokenOptions, RefreshTokenRecord } from "../types";
import {
	buildRefreshTokenKey,
	DEFAULT_REFRESH_TTL_SECONDS,
	serializeRefreshToken,
} from "../utils";

export const generateRefreshToken = async (
	options: GenerateRefreshTokenOptions,
) => {
	const manager = new RedisManager();
	const ttlSeconds = options.expiresInSeconds ?? DEFAULT_REFRESH_TTL_SECONDS;
	const now = Date.now();
	const expiresIn = ttlSeconds * 1_000;

	const token = signJWT(
		{
			subject: options.userId,
			expiresInSeconds: ttlSeconds,
			issuer: "auth",
			audience: "refresh",
			sessionId: options.sessionId,
		},
		options.jwtSecret,
	);

	const record: RefreshTokenRecord = {
		token,
		userId: options.userId,
		sessionId: options.sessionId,
		createdAt: new Date(now).toISOString(),
		expiresAt: new Date(now + expiresIn).toISOString(),
		metadata: options.metadata,
	};

	const writeResult = await manager.create(
		buildRefreshTokenKey(token),
		serializeRefreshToken(record),
	);

	if (!writeResult.success) {
		return { success: false as const, error: writeResult.error };
	}

	return { success: true as const, record };
};
