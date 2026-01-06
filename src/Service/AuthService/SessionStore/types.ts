import type { DeviceFingerprint } from "../Fingerprint/types";

export type SessionRecord = {
	id: string;
	userId: string;
	createdAt: string;
	expiresAt: string;
	clientMeta?: Record<string, unknown>;
	fingerprintHash?: string;
};

export type GenerateSessionOptions = {
	userId: string;
	expiresInSeconds?: number;
	clientMeta?: Record<string, unknown>;
	fingerprintHash?: string;
	sessionId?: string;
};

export type ValidateSessionOptions = {
	sessionId: string;
	jwtToken: string;
	jwtSecret: string;
	savedFingerprint?: DeviceFingerprint;
	headers?: Record<string, string | undefined>;
	requestIp?: string;
};

export type ValidateSessionResult = {
	isValid: boolean;
	reason?: string;
	context?: {
		userId: string;
		sessionId: string;
		fingerprintValid?: boolean;
	};
};

export type ReadSessionOptions = {
	sessionId: string;
};

export type DeleteSessionOptions = {
	sessionId: string;
};
