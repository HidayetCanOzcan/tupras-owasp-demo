import crypto from "node:crypto";
import type { JWTHeader, JWTPayload } from "./types";

export const base64UrlEncode = (data: string | Buffer): string => {
	const base64 = Buffer.isBuffer(data)
		? data.toString("base64")
		: Buffer.from(data).toString("base64");
	return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const base64UrlDecode = (data: string): string => {
	const padding = "=".repeat((4 - (data.length % 4)) % 4);
	const base64 = data.replace(/-/g, "+").replace(/_/g, "/") + padding;
	return Buffer.from(base64, "base64").toString("utf-8");
};

export const createSignature = (
	data: string,
	secret: string,
	algorithm: JWTHeader["alg"],
): string => {
	const hmacAlgorithm = algorithm.replace("HS", "sha");
	const hmac = crypto.createHmac(hmacAlgorithm, secret);
	hmac.update(data);
	return base64UrlEncode(hmac.digest());
};

export const verifySignature = (
	data: string,
	signature: string,
	secret: string,
	algorithm: JWTHeader["alg"],
): boolean => {
	const expectedSignature = createSignature(data, secret, algorithm);
	return crypto.timingSafeEqual(
		Buffer.from(signature),
		Buffer.from(expectedSignature),
	);
};

export const encodeHeader = (header: JWTHeader): string => {
	return base64UrlEncode(JSON.stringify(header));
};

export const encodePayload = (payload: JWTPayload): string => {
	return base64UrlEncode(JSON.stringify(payload));
};

export const decodeHeader = (encoded: string): JWTHeader | null => {
	try {
		return JSON.parse(base64UrlDecode(encoded)) as JWTHeader;
	} catch {
		return null;
	}
};

export const decodePayload = (encoded: string): JWTPayload | null => {
	try {
		return JSON.parse(base64UrlDecode(encoded)) as JWTPayload;
	} catch {
		return null;
	}
};
