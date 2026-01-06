export const normalize = (value?: string) => {
	return value?.trim().toLowerCase() || "unknown";
};

export const extractHeaderValue = (
	headers: Record<string, string>,
	key: string,
) => {
	return headers[key.toLowerCase()] ?? headers[key];
};
