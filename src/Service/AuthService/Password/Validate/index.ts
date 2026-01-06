import { scryptSync, timingSafeEqual } from "node:crypto";
import type { ValidatePasswordOptions, ValidatePasswordResult } from "../types";

const DEFAULT_KEY_LENGHTH = 32;

export const validatePassword = (
	options: ValidatePasswordOptions,
): ValidatePasswordResult => {
	const keyLength = options.keyLength ?? DEFAULT_KEY_LENGHTH;

	const parts = options.hash.split(":");

	if (parts.length !== 2) {
		return {
			isValid: false,
		};
	}

	const [saltHex, hashHex] = parts;

	if (!saltHex || !hashHex) {
		return {
			isValid: false,
		};
	}

	const salt = Buffer.from(saltHex, "hex");
	const storedHash = Buffer.from(hashHex, "hex");
	const derived = scryptSync(options.password, salt, keyLength);

	if (storedHash.length !== derived.length) {
		return {
			isValid: false,
		};
	}

	return {
		isValid: timingSafeEqual(storedHash, derived),
	};
};
