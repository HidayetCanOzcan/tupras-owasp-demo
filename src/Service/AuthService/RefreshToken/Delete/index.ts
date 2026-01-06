import { RedisManager } from "../../../../Managers/Redis";
import type { DeleteRefreshTokenOptions } from "../types";
import { buildRefreshTokenKey } from "../utils";

export const deleteRefreshToken = async (
	options: DeleteRefreshTokenOptions,
) => {
	const manager = new RedisManager();
	const key = buildRefreshTokenKey(options.token);
	const removeResult = await manager.remove(key);

	return removeResult.success && removeResult.data > 0;
};
