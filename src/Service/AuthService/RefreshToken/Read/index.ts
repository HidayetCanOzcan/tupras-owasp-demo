import { RedisManager } from "../../../../Managers/Redis";
import { verifyJWT } from "../../JWT";
import { deleteRefreshToken } from "../Delete";
import type { ReadRefreshTokenOptions } from "../types";
import { buildRefreshTokenKey, deserializeRefreshToken } from "../utils";

export const readRefreshToken = async (options: ReadRefreshTokenOptions) => {
	const jwtResult = verifyJWT(options.token, options.jwtSecret);

	if (!jwtResult.valid) {
		return {
			success: false as const,
			error: `Invalid refresh token: ${jwtResult.error}`,
		};
	}

	if (jwtResult.payload.aud !== "refresh") {
		return {
			success: false as const,
			error: "Invalid token type: expected refresh token",
		};
	}

	const manager = new RedisManager();
	const key = buildRefreshTokenKey(options.token);
	const readResult = await manager.read<string>(key);

	if (!readResult.success || !readResult.data) {
		return {
			success: false as const,
			error: "Refresh token not found or revoked",
		};
	}

	const record = deserializeRefreshToken(readResult.data);

	if (!record) {
		return {
			success: false as const,
			error: "Invalid refresh token format",
		};
	}

	if (new Date(record.expiresAt).getTime() <= Date.now()) {
		await deleteRefreshToken({ token: options.token });
		return {
			success: false as const,
			error: "Refresh token expired",
		};
	}

	return {
		success: true as const,
		record: record,
	};
};
