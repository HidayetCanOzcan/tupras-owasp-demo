import type { PostgreSQLManager } from "@managers";
import { SELECT_USER_BY_ID } from "@/constants";
import type { DbUserRow } from "../types";

export const findByUserId = async (id: string, pg: PostgreSQLManager) => {
	const result = await pg.execute<DbUserRow>(SELECT_USER_BY_ID, [id]);
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
