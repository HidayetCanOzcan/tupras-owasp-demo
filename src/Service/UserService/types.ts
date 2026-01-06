export type UserRole = "user" | "admin";

export type SanitizedUser = {
	id: string;
	email: string;
	full_name: string | null;
	role: UserRole;
};

export type DbUserRow = SanitizedUser & {
	password_hash: string;
	created_at: Date;
	updated_at: Date;
};
