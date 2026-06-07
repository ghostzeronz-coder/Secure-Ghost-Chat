/**
 * Shared shadow helper. React Native deprecated the individual `shadow*` style
 * props (shadowColor/shadowOffset/shadowOpacity/shadowRadius) in favour of the
 * CSS-like `boxShadow` string. This helper builds that string from the same
 * inputs we used before so elevation/glow stays visually identical across the
 * app while silencing the deprecation warning.
 */

/** Convert a #rgb / #rrggbb hex color + opacity into an `rgba(...)` string. */
function hexToRgba(hex: string, opacity: number): string {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Build a `boxShadow` value equivalent to the old shadow* props. `blurRadius`
 * maps 1:1 from the previous `shadowRadius`; `offsetX`/`offsetY` map from
 * `shadowOffset`; `color` + `opacity` are folded into an rgba color.
 */
export function boxShadow(
  color: string,
  opacity: number,
  blurRadius: number,
  offsetX = 0,
  offsetY = 0,
): string {
  return `${offsetX}px ${offsetY}px ${blurRadius}px ${hexToRgba(color, opacity)}`;
}
