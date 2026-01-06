import type { PostgreSQLManager } from "@managers";
import { SELECT_USER_BY_EMAIL } from "@/constants";
import type { DbUserRow } from "../types";

export const findUserByEmail = async (email: string, pg: PostgreSQLManager) => {
	const result = await pg.execute<DbUserRow>(SELECT_USER_BY_EMAIL, [
		email.toLowerCase().trim(),
	]);
	if (!result.success)
		return {
			success: false,
			error: result.error,
		};
	return {
		success: true,
		data: result.data[0],
	};
};
