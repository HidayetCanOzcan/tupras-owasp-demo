export type DeviceFingerprintInput = {
	userAgent?: string;
	ipAddress?: string;
	extra?: Record<string, string | undefined>;
};

export type DeviceFingerprint = {
	hash: string;
	components: DeviceFingerprintInput;
};

export type ValidateFingerprintParams = {
	savedFingerprint: DeviceFingerprint;
	headers: Record<string, string>;
	requestIp: string;
};

export type ValidateFingerprintResult = {
	isValid: boolean;
	reason?: string;
	currentFingerprint: DeviceFingerprint;
};
