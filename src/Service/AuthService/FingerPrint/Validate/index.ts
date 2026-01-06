import type {
	DeviceFingerprintInput,
	ValidateFingerprintParams,
	ValidateFingerprintResult,
} from "../types";
import { extractHeaderValue } from "../utils";

export const validateDeviceFingerprint = ({
	savedFingerprint,
	requestIp,
	headers,
}: ValidateFingerprintParams): ValidateFingerprintResult => {
	const userAgent = extractHeaderValue(headers, "user-agent");
	const forwardedFor =
		extractHeaderValue(headers, "x-forwarded-for") ?? requestIp ?? undefined;

	const currentFingerprint: DeviceFingerprintInput = {
		userAgent,
		ipAddress: forwardedFor,
	};

	const componentMismatch = [
		{
			field: "userAgent",
			saved: savedFingerprint.components.userAgent,
			received: userAgent,
		},
		{
			field: "ipAddress",
			saved: savedFingerprint.components.ipAddress,
			received: forwardedFor,
		},
	].find(({ saved, received }) => saved ?? "" !== (received ?? ""));

	if (componentMismatch) {
		return {
			isValid: false,
			reason: `${componentMismatch.field} mismatch`,
			currentFingerprint: {
				hash: "",
				components: currentFingerprint,
			},
		};
	}

	return {
		isValid: true,
		currentFingerprint: {
			hash: "",
			components: currentFingerprint,
		},
	};
};
