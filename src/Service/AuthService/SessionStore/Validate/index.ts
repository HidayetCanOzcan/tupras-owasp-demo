import { verifyJWT } from "../../JWT";
import { validateDeviceFingerprint } from "../../Fingerprint/Validate";
import { readSession } from "../Read";
import type { ValidateSessionOptions, ValidateSessionResult } from "../types";

export const validateSession = async (
	options: ValidateSessionOptions,
): Promise<ValidateSessionResult> => {
	const jwtResult = verifyJWT(options.jwtToken, options.jwtSecret);

	if (!jwtResult.valid) {
		return { isValid: false, reason: jwtResult.error };
	}

	const session = await readSession({ sessionId: options.sessionId });

	if (!session) {
		return { isValid: false, reason: "Session not found" };
	}

	let fingerprintValid: boolean | undefined;

	if (options.savedFingerprint && options.headers) {
		const fingerprintResult = validateDeviceFingerprint({
			savedFingerprint: options.savedFingerprint,
			headers: options.headers,
			requestIp: options.requestIp,
		});

		fingerprintValid = fingerprintResult.isValid;

		if (!fingerprintResult.isValid) {
			return {
				isValid: false,
				reason: fingerprintResult.reason ?? "Fingerprint mismatch",
			};
		}
	}

	return {
		isValid: true,
		context: {
			userId: session.userId,
			sessionId: session.id,
			fingerprintValid,
		},
	};
};
