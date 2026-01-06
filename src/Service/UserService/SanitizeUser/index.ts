import type { DbUserRow, SanitizedUser } from "../types";

export const sanitizeUser = (user: DbUserRow): SanitizedUser => {
	return {
		id: user.id,
		email: user.email,
		full_name: user.full_name,
		role: user.role,
	};
};
