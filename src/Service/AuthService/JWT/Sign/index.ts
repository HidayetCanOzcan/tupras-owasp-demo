import type { JWTHeader, JWTPayload, SignOptions } from "../types";
import { createSignature, encodeHeader, encodePayload } from "../utils";

export const signJWT = (
	options: SignOptions,
	secret: string,
	algorithm: JWTHeader["alg"] = "HS256",
): string => {
	const header: JWTHeader = {
		alg: algorithm,
		typ: "JWT",
	};

	const now = Math.floor(Date.now() / 1000);

	const payload: JWTPayload = {
		sub: options.subject,
		iat: now,
		exp: now + options.expiresInSeconds,
		iss: options.issuer,
		aud: options.audience,
		jti: options.jwtId,
		sessionId: options.sessionId,
		...options.customClaims,
	};

	const encodedHeader = encodeHeader(header);
	const encodedPayload = encodePayload(payload);
	const dataToSign = `${encodedHeader}.${encodedPayload}`;
	const signature = createSignature(dataToSign, secret, algorithm);

	return `${dataToSign}.${signature}`;
};
