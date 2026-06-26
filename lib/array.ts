// Toggle an item's membership in an array (immutable): drop it if present,
// append it otherwise. Shared by the filter bars so the include/filter/append
// pattern isn't re-implemented per control.
export function toggleInArray<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
