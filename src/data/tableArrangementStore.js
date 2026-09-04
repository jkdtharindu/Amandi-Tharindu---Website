/**
 * In-memory SeatingTable store, used when DATABASE_URL is unset.
 *
 * Mirrors the shape returned by tableArrangementRepo's SQL path: table fields
 * stay snake_case (table_number, table_name) while seats are camelCase, so the
 * admin page renders identically with or without a database.
 */
export const seatingTables = [];
