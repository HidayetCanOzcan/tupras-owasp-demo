import { readRefreshToken } from "../Read";
import type { ValidateRefreshTokenOptions } from "../types";

export const validateRefreshToken = async (
	options: ValidateRefreshTokenOptions,
) => {
	return readRefreshToken({
		token: options.token,
		jwtSecret: options.jwtSecret,
	});
};
