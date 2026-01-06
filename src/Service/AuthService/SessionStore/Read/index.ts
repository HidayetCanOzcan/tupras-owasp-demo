import { RedisManager } from "../../../../Managers/Redis";
import { deleteSession } from "../Delete";
import type { ReadSessionOptions } from "../types";
import { buildSessionKey, deserializeSession } from "../utils";

export const readSession = async (options: ReadSessionOptions) => {
	const manager = new RedisManager();
	const key = buildSessionKey(options.sessionId);

	const readResult = await manager.read<string>(key);

	if (!readResult.success || !readResult.data) {
		return null;
	}

	const record = deserializeSession(readResult.data);

	if (!record) {
		return null;
	}

	if (new Date(record.expiresAt).getTime() <= Date.now()) {
		await deleteSession({ sessionId: options.sessionId });
		return null;
	}

	return record;
};
