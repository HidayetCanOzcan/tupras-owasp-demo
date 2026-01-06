import type { JWTHeader, VerifyResult } from "../types";
import { decodeHeader, decodePayload, verifySignature } from "../utils";

export const verifyJWT = (token: string, secret: string): VerifyResult => {
	const parts = token.split(".");

	if (parts.length !== 3) {
		return { valid: false, error: "Invalid token format: expected 3 parts" };
	}

	const [encodedHeader, encodedPayload, signature] = parts;

	const header = decodeHeader(encodedHeader);
	if (!header) {
		return { valid: false, error: "Invalid header: failed to decode" };
	}

	if (header.typ !== "JWT") {
		return { valid: false, error: "Invalid header: typ must be JWT" };
	}

	const supportedAlgorithms: JWTHeader["alg"][] = ["HS256", "HS384", "HS512"];
	if (!supportedAlgorithms.includes(header.alg)) {
		return { valid: false, error: `Unsupported algorithm: ${header.alg}` };
	}

	const dataToVerify = `${encodedHeader}.${encodedPayload}`;
	const isValidSignature = verifySignature(
		dataToVerify,
		signature,
		secret,
		header.alg,
	);

	if (!isValidSignature) {
		return { valid: false, error: "Invalid signature" };
	}

	const payload = decodePayload(encodedPayload);
	if (!payload) {
		return { valid: false, error: "Invalid payload: failed to decode" };
	}

	const now = Math.floor(Date.now() / 1000);

	if (payload.exp && payload.exp < now) {
		return { valid: false, error: "Token expired" };
	}

	if (payload.iat && payload.iat > now + 60) {
		return { valid: false, error: "Token issued in the future" };
	}

	return { valid: true, payload };
};
