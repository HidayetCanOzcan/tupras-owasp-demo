import { signJWT } from "../../JWT";
import { generateRefreshToken } from "../../RefreshToken/Generate";
import { deleteSession } from "../../SessionStore/Delete";
import { generateSession } from "../../SessionStore/Generate";
import type { IssueSessionOptions, IssueSessionResult } from "../types";

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export const issueSession = async (
	options: IssueSessionOptions,
): Promise<
	| { success: true; data: IssueSessionResult }
	| { success: false; error: string }
> => {
	const ttl = options.accessTokenTtlSeconds ?? DEFAULT_ACCESS_TOKEN_TTL_SECONDS;

	const sessionResult = await generateSession({ userId: options.userId });
	if (!sessionResult.success) {
		return {
			success: false,
			error: sessionResult.error ?? "Session creation failed",
		};
	}

	const refreshResult = await generateRefreshToken({
		userId: options.userId,
		sessionId: sessionResult.session.id,
		jwtSecret: options.jwtSecret,
	});
	if (!refreshResult.success) {
		await deleteSession({ sessionId: sessionResult.session.id });
		return {
			success: false,
			error: refreshResult.error ?? "Refresh token creation failed",
		};
	}

	const expiresAt = new Date(Date.now() + ttl * 1000);

	const accessToken = signJWT(
		{
			subject: options.userId,
			expiresInSeconds: ttl,
			issuer: "auth",
			audience: "api",
			sessionId: sessionResult.session.id,
			customClaims: {
				refreshTokenId: refreshResult.record.token,
			},
		},
		options.jwtSecret,
	);

	return {
		success: true,
		data: {
			accessToken,
			accessTokenExpiresAt: expiresAt.toISOString(),
			refreshToken: refreshResult.record.token,
			refreshExpiresAt: refreshResult.record.expiresAt,
			sessionId: sessionResult.session.id,
		},
	};
};
