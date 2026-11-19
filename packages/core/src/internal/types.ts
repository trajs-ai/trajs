/**
 * The records an array holds, keyed by the field each one states as `Key`.
 *
 * A value that is not an array is read as it is. The array is matched first
 * because it states no key of the records it holds.
 */
export type IndexByKey<T, Key extends PropertyKey> =
  T extends ReadonlyArray<infer Item>
    ? {
        readonly [
          Value in Item extends Record<Key, infer Tag extends PropertyKey> ? Tag : never
        ]: Item extends Record<Key, Value> ? Item : never;
      }
    : { readonly [Name in keyof T]: T[Name] };
