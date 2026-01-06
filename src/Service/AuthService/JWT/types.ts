export type JWTHeader = {
	alg: "HS256" | "HS384" | "HS512";
	typ: "JWT";
};

export type JWTPayload = {
	sub: string;
	iat: number;
	exp: number;
	iss?: string;
	aud?: string;
	jti?: string;
	sessionId?: string;
	[key: string]: unknown;
};

export type SignOptions = {
	subject: string;
	expiresInSeconds: number;
	issuer?: string;
	audience?: string;
	sessionId?: string;
	jwtId?: string;
	customClaims?: Record<string, unknown>;
};

export type VerifyResult =
	| { valid: true; payload: JWTPayload }
	| { valid: false; error: string };

export type DecodeResult = {
	header: JWTHeader;
	payload: JWTPayload;
	signature: string;
} | null;
