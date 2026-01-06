import crypto from "node:crypto";
import { RedisManager } from "../../../../Managers/Redis";
import type { GenerateSessionOptions, SessionRecord } from "../types";
import {
	buildSessionKey,
	DEFAULT_EXPIRY_SECONDS,
	serializeSession,
} from "../utils";

export const generateSession = async (options: GenerateSessionOptions) => {
	const manager = new RedisManager();
	const sessionId = options.sessionId ?? crypto.randomUUID();
	const now = Date.now();
	const expiresIn =
		(options.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS) * 1_000;

	const record: SessionRecord = {
		id: sessionId,
		userId: options.userId,
		createdAt: new Date(now).toISOString(),
		expiresAt: new Date(now + expiresIn).toISOString(),
		clientMeta: options.clientMeta,
		fingerprintHash: options.fingerprintHash,
	};

	const writeResult = await manager.create(
		buildSessionKey(sessionId),
		serializeSession(record),
	);

	if (!writeResult.success) {
		return { success: false as const, error: writeResult.error };
	}

	return { success: true as const, session: record };
};
