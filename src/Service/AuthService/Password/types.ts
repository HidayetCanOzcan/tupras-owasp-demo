export type GeneratePasswordHashOptions = {
	password: string;
	keyLength?: number;
};

export type GeneratePasswordHashResult = {
	hash: string;
};

export type ValidatePasswordOptions = {
	password: string;
	hash: string;
	keyLength?: number;
};

export type ValidatePasswordResult = {
	isValid: boolean;
};
