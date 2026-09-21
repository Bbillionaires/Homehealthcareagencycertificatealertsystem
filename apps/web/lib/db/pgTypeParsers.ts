import { types } from "pg";

/**
 * node-postgres's default parser for the `date` type (oid 1082) converts
 * it to a JS `Date` object. Every date field in this app -- employees,
 * credentials, requirements -- is treated as a plain `YYYY-MM-DD` string
 * end to end (packages/shared/src/dates.ts, the compliance engine, every
 * page's formatDateLong call): a `Date` object breaks that immediately
 * (`parseDate`'s `value.split("-")` throws, since `Date` has no `.split`).
 * Registering an identity parser here keeps the exact `YYYY-MM-DD` text
 * Postgres sends over the wire, for every Pool/Client built from this
 * process's `pg` module -- the type registry is global to the module, so
 * this only needs to run once, imported for its side effect wherever a
 * Pool is constructed.
 */
types.setTypeParser(1082, (value: string) => value);
