export type IssueSessionOptions = {
	userId: string;
	accessTokenTtlSeconds?: number;
	jwtSecret: string;
};

export type IssueSessionResult = {
	accessToken: string;
	accessTokenExpiresAt: string;
	refreshToken: string;
	refreshExpiresAt: string;
	sessionId: string;
};
