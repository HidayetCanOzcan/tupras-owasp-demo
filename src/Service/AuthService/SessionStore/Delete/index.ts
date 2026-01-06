import { RedisManager } from "../../../../Managers/Redis";
import type { DeleteSessionOptions } from "../types";
import { buildSessionKey } from "../utils";

export const deleteSession = async (options: DeleteSessionOptions) => {
	const manager = new RedisManager();
	const key = buildSessionKey(options.sessionId);
	const removeResult = await manager.remove(key);

	return removeResult.success && removeResult.data > 0;
};
