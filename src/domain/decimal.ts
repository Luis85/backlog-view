/**
 * Exact decimal arithmetic over the numbers a note actually holds.
 *
 * **Why this is not `a + b` and `a - b`.** Both operands here are decimals somebody TYPED —
 * a capacity into a release note, an effort estimate onto each member — and a double cannot
 * hold most of them. `0.1 + 0.2` is `0.30000000000000004`, so a release filled to exactly its
 * declared `0.3` subtracts to `5.55e-17` and the strip reports it over. Every attempt to
 * clean that up downstream is a heuristic that is wrong somewhere else, and this module
 * exists because two of them shipped: a tolerance scaled by the number of additions performed
 * called a genuine `1e-16` shortfall zero, and rounding the difference to twelve significant
 * digits turned a real `1000000000001` over into `1000000000000`. There is no threshold that
 * separates noise from a small real difference, because the noise is not small relative to
 * the answer — it is the whole answer.
 *
 * **What makes an exact answer available at all**: every double has a shortest round-trip
 * decimal representation, which is what `String` gives (`String(0.1)` is `"0.1"`, not
 * `0.1000000000000000055…`), and that representation is the number the user typed. Adding and
 * subtracting THOSE decimals reproduces the arithmetic the reader did in their head, and the
 * result is converted back to a double once, at the end, where a single correctly-rounded
 * conversion is the only rounding in the whole path.
 *
 * **Scaling is in `BigInt`, and that is the trap rather than a preference.** The obvious
 * shape — multiply each value by a power of ten so the fractions become integers, add, divide
 * back — is a decimal method built on doubles, and it reintroduces the error it was written to
 * remove at the exact values this feature has to be right about. Aligning `0.5` and
 * `0.4999999999999999` at a scale of sixteen scales each of them exactly, and then their sum
 * needs seventeen digits: `1e16` comes back where the true answer is `0.9999999999999999`, so
 * a release one part in ten thousand trillion SHORT reads as exactly full. Digits are
 * therefore carried as a `bigint` with a decimal `scale` beside them and never pass through a
 * double until {@link toNumber}.
 *
 * **Nothing here rounds, clamps or judges.** An overflow is still an overflow: summing two
 * estimates of `1e308` yields a `bigint` no double can hold and `toNumber` answers `Infinity`,
 * which is the reading `releaseReadiness.ts` already refuses as an unreadable total.
 */

/** A value as `digits / 10 ** scale` — exact, unbounded, and never a double. */
interface Decimal {
	digits: bigint;
	scale: number;
}

/**
 * Every finite double's `String` matches this, INCLUDING the exponent forms at both ends of
 * the range (`String(1e21)` is `"1e+21"` and `String(5e-324)` is `"5e-324"`). Those are read
 * rather than refused, because refusing them would put a silent second arithmetic behind a
 * magnitude threshold nobody chose — and the exponent is free here anyway, being one term
 * added to a scale this shape already carries. Only a non-finite value fails to match, which
 * is what the `null` is for.
 */
const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/;

function decimalOf(value: number): Decimal | null {
	const match = DECIMAL.exec(String(value));
	if (match === null) return null;
	const [, sign, whole, fraction = '', exponent = '0'] = match;
	// The fraction's digits join the integer's and the point is remembered as the scale, so
	// `12.34` is `1234 / 10^2`. A negative exponent deepens that scale and a positive one
	// cancels it, which is the same statement about where the point sits.
	return { digits: BigInt(`${sign}${whole}${fraction}`), scale: fraction.length - Number(exponent) };
}

/**
 * One correctly-rounded conversion, and the only rounding in this module. The digits are
 * handed to `Number` as a decimal string rather than divided by a power of ten, because a
 * division is two roundings — the divisor and the quotient — where the string is one.
 */
function toNumber(value: Decimal): number {
	return Number(`${value.digits}e${-value.scale}`);
}

/** Both terms restated at the deeper scale, so their digits are comparable integers. */
function combine(a: Decimal, b: Decimal, sign: bigint): Decimal {
	const scale = Math.max(a.scale, b.scale);
	return {
		digits: a.digits * 10n ** BigInt(scale - a.scale) + sign * (b.digits * 10n ** BigInt(scale - b.scale)),
		scale,
	};
}

/**
 * The sum of what each note says, not of what a double could hold of it: `[0.1, 0.2]` is
 * `0.3` and prints as `0.3`, where the running `+=` it replaced produced a commitment that
 * contradicted the `0 over` beside it.
 *
 * Linear in the values, and the digit counts stay bounded because the scale never exceeds the
 * deepest one any single value carries — this runs on every release-scope render.
 *
 * A non-finite value falls back to plain addition rather than being refused: the callers
 * already reject one upstream, and where one did reach here the honest answer is the
 * `Infinity` or `NaN` that a total nobody can read is made of.
 */
export function exactSum(values: number[]): number {
	let total: Decimal = { digits: 0n, scale: 0 };
	for (const value of values) {
		const term = decimalOf(value);
		if (term === null) return values.reduce((running, next) => running + next, 0);
		total = combine(total, term, 1n);
	}
	return toNumber(total);
}

/**
 * `left - right` as the reader would do it on paper. `52.1 - 40` is `12.1` rather than
 * `12.100000000000001`, and `1000000000002 - 1` is `1000000000001` rather than the
 * `1000000000000` twelve significant digits produced — the two defects that shared one line.
 */
export function exactDifference(left: number, right: number): number {
	const a = decimalOf(left);
	const b = decimalOf(right);
	if (a === null || b === null) return left - right;
	return toNumber(combine(a, b, -1n));
}
