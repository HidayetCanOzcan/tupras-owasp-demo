import type { DecodeResult } from "../types";
import { decodeHeader, decodePayload } from "../utils";

export const decodeJWT = (token: string): DecodeResult => {
	const parts = token.split(".");

	if (parts.length !== 3) {
		return null;
	}

	const [encodedHeader, encodedPayload, signature] = parts;

	const header = decodeHeader(encodedHeader);
	const payload = decodePayload(encodedPayload);

	if (!header || !payload) {
		return null;
	}

	return {
		header,
		payload,
		signature,
	};
};
