import crypto from "node:crypto";
import type { DeviceFingerprint, DeviceFingerprintInput } from "../types";
import { normalize } from "../utils";

export const generateDeviceFingerprint = (
	input: DeviceFingerprintInput,
): DeviceFingerprint => {
	const payload = JSON.stringify({
		userAgent: normalize(input.userAgent),
		ipAddress: input.ipAddress,
		extra: input.extra ?? {},
	});

	const hash = crypto.createHash("sha256").update(payload).digest("base64url");

	return {
		hash,
		components: input,
	};
};
