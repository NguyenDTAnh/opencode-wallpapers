// The sun and moon discs a scene's layout() paints, [cx, cy, r, ...] in pixels, per scene buffer (see Canvas.orbs):
// round shapes that the engine keeps smooth wedge glyphs off, since they would turn the disc into a polygon.
const lists = new WeakMap<Float32Array, number[]>()

export function trackOrbs(hdr: Float32Array, list: number[]) {
  lists.set(hdr, list)
}

export function addOrb(hdr: Float32Array, cx: number, cy: number, r: number) {
  lists.get(hdr)?.push(cx, cy, r)
}
