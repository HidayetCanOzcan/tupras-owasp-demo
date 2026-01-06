const DEFAULT_KEY_LENGTH = 64;

import { randomBytes, scryptSync } from "node:crypto";
import type {
	GeneratePasswordHashOptions,
	GeneratePasswordHashResult,
} from "../types";

export const generatePasswordHash = (
	options: GeneratePasswordHashOptions,
): GeneratePasswordHashResult => {
	const keyLength = options.keyLength || DEFAULT_KEY_LENGTH;
	const salt = randomBytes(16);
	const derivedKey = scryptSync(options.password, salt, keyLength);

	return {
		hash: `${salt.toString("hex")}:${derivedKey.toString("hex")}`,
	};
};
