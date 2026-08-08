/**
 * Writing one frontmatter key, safely.
 *
 * Its own module because two writers need it and the alternative was an import cycle:
 * `dependsOnWrite.ts` reaching back into `frontmatter.ts` for this one function is a
 * cycle fallow refuses, and rightly — the rule below belongs to neither writer in
 * particular.
 */

/**
 * Write a note's OWN property for a user-configured key.
 *
 * `fm[key] = value` is not safe when the user names the property `__proto__`: plain
 * assignment reaches `Object.prototype`'s setter instead of creating a key, which
 * SILENTLY drops a string or a number — the state changes and its date vanishes — and
 * for the tag list, which is an array, actually replaces the object's prototype. A
 * defined own property is what YAML round-trips, for every key including that one.
 */
export function setOwn(fm: Record<string, unknown>, key: string, value: unknown): void {
	Object.defineProperty(fm, key, { value, writable: true, enumerable: true, configurable: true });
}
