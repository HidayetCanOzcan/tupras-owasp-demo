export type ApiResponse<T> = {
	data?: T | null;
	error?: string | null;
	success: boolean;
	code: number;
	message?: string | null;
};
