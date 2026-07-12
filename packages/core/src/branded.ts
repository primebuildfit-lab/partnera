/**
 * Nominal ("branded") typing helper.
 *
 * TypeScript is structurally typed, so a raw `string` id for a User is
 * interchangeable with one for a Business — a common source of bugs in a
 * multi-tenant, money-moving platform. A `Brand` attaches a phantom tag so the
 * compiler treats otherwise-identical primitives as distinct types.
 */
declare const brand: unique symbol;

export type Brand<T, TBrand extends string> = T & { readonly [brand]: TBrand };

/**
 * The underlying primitive of a branded type. Inferring through an intersection
 * (`T & {…}`) is unreliable, so we narrow by primitive instead — sufficient
 * because every Partnera brand wraps a primitive.
 */
export type BaseOf<B> = [B] extends [string]
  ? string
  : [B] extends [number]
    ? number
    : [B] extends [bigint]
      ? bigint
      : [B] extends [boolean]
        ? boolean
        : unknown;

/** Cast a raw primitive into a branded type. Use only at trusted boundaries. */
export function brandValue<B>(value: BaseOf<B>): B {
  return value as B;
}
