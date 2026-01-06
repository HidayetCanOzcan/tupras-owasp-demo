export type RefreshTokenRecord = {
	token: string;
	userId: string;
	sessionId?: string;
	createdAt: string;
	expiresAt: string;
	metadata?: Record<string, unknown>;
};

export type GenerateRefreshTokenOptions = {
	userId: string;
	sessionId?: string;
	expiresInSeconds?: number;
	metadata?: Record<string, unknown>;
	jwtSecret: string;
};

export type ReadRefreshTokenOptions = {
	token: string;
	jwtSecret: string;
};

export type ValidateRefreshTokenOptions = {
	token: string;
	jwtSecret: string;
};

export type DeleteRefreshTokenOptions = {
	token: string;
};
