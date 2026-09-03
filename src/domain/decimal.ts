/**
 * Exact decimal arithmetic over the numbers a note actually holds.
 *
 * **Why this is not `a + b` and `a - b`.** Both operands in the capacity comparison are
 * decimals somebody TYPED — a capacity into a release note, an effort estimate onto each
 * member — and a double cannot hold most of them. `0.1 + 0.2` is `0.30000000000000004`, so a
 * release filled to exactly its declared `0.3` subtracts to `5.55e-17` and the strip reports
 * it over. Every attempt to clean that up downstream is a heuristic that is wrong somewhere
 * else, and this module exists because two of them shipped: a tolerance scaled by the number
 * of additions performed called a genuine `1e-16` shortfall zero, and rounding the difference
 * to twelve significant digits turned a real `1000000000001` over into `1000000000000`. There
 * is no threshold that separates noise from a small real difference, because the noise is not
 * small relative to the answer — it is the whole answer.
 *
 * **What makes an exact answer available at all**: every double has a shortest round-trip
 * decimal representation, which is what `String` gives (`String(0.1)` is `"0.1"`, not
 * `0.1000000000000000055…`). At seventeen significant digits or fewer that representation IS
 * what the user typed; past that it is the shortest decimal that comes back to the double
 * they got, which is the best any reader of the note could recover. Adding and subtracting
 * THOSE decimals reproduces the arithmetic the reader did on paper.
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
 * **Where the exactness stops, stated to the check rather than ahead of it.** The arithmetic
 * is exact; the conversion back to a double is not, and cannot be — most exact sums have no
 * double to be. So the guarantee is *exact through the arithmetic, rounded once at the end*,
 * and the rounding is `Number`'s own parse of a decimal string, which the language requires to
 * be correctly rounded only up to twenty significant digits and permits to approximate past
 * them.
 *
 * That one rounding is why a `Decimal` crosses the domain/view seam rather than a number. This
 * header claimed "nothing here rounds, clamps or judges" until a review found what the
 * sentence cost: `exactSum` answered a number, so `[1e21, 1]` came back as `1e21` with the
 * `1` discarded in `domain/` before `view/` could subtract anything from it — and a release
 * exactly one over its capacity reported as exactly filled. **The number is for display and
 * the decimal is for arithmetic**, and they disagree precisely where a double runs out of
 * digits.
 *
 * Nothing here clamps or judges, though: an overflow is still an overflow. Summing two
 * estimates of `1e308` yields a `bigint` no double can hold and {@link toNumber} answers
 * `Infinity`, which is the reading `releaseReadiness.ts` already refuses as an unreadable
 * total.
 */

/**
 * A value as `digits / 10 ** scale` — exact, unbounded, and never a double.
 *
 * Carried across the seam beside the number it rounds to, so the comparison can be taken on
 * the value the notes state rather than on the value a double could keep of it.
 */
export interface Decimal {
	digits: bigint;
	scale: number;
}

const ZERO: Decimal = { digits: 0n, scale: 0 };

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

/** Both terms restated at the deeper scale, so their digits are comparable integers. */
function combine(a: Decimal, b: Decimal): Decimal {
	const scale = Math.max(a.scale, b.scale);
	return {
		digits: a.digits * 10n ** BigInt(scale - a.scale) + b.digits * 10n ** BigInt(scale - b.scale),
		scale,
	};
}

/**
 * The one lossy step in this module, and the only place a `Decimal` becomes a figure anyone
 * can read. The digits are handed to `Number` as a decimal string rather than divided by a
 * power of ten, because a division is two roundings — the divisor and the quotient — where
 * the string is one.
 *
 * `null` in is a sum that could not be stated exactly because one of its terms was not
 * finite, and `NaN` out is what a caller's own "is this total readable" guard is already
 * written to refuse. Taken here rather than branched on at each call site so that the callers
 * carry no second opinion about what an unstatable total means.
 */
export function toNumber(value: Decimal | null): number {
	return value === null ? Number.NaN : Number(`${value.digits}e${-value.scale}`);
}

/**
 * The sum of what each note says, as a decimal: `[0.1, 0.2]` is exactly `0.3`, where the
 * running `+=` it replaced produced a commitment that contradicted the `0 over` beside it.
 *
 * It answers a {@link Decimal} rather than a number because rounding here would throw away the
 * digits the comparison downstream needs — see this module's header. `null` is a value that is
 * not finite, which both callers already refuse upstream (`estimateValue`); the exact sum of a
 * list holding an infinity is not a decimal, so it is not reported as one.
 *
 * Linear in the values, and the digit counts stay bounded because the scale never exceeds the
 * deepest one any single value carries — this runs on every release-scope render.
 */
export function exactSum(values: number[]): Decimal | null {
	let total: Decimal = ZERO;
	for (const value of values) {
		const term = decimalOf(value);
		if (term === null) return null;
		total = combine(total, term);
	}
	return total;
}

/**
 * `left - right` as the reader would do it on paper, rounded to a double once at the end:
 * `52.1 - 40` is `12.1` rather than `12.100000000000001`, and `1000000000002 - 1` is
 * `1000000000001` rather than the `1000000000000` twelve significant digits produced.
 *
 * The left side is a {@link Decimal} because it is a SUM whose exact value a double may not
 * hold; the right is a single typed number, which is its own exact decimal. A non-finite right
 * falls back to the plain operator rather than being refused — the caller rejects one upstream,
 * and where one did arrive the honest answer is the `Infinity` or `NaN` that an unreadable
 * comparison is made of.
 */
export function exactDifference(left: Decimal, right: number): number {
	// `-right` is exact for every double (IEEE negation flips a sign bit and touches no
	// digit), so subtraction is addition here and `combine` needs no sign of its own.
	const negated = decimalOf(-right);
	return negated === null ? toNumber(left) - right : toNumber(combine(left, negated));
}
