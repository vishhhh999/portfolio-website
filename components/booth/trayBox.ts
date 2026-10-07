/** A sample's footprint on the tray when it differs from the closed object (the open JSW book): metres from the model's origin. */
export type TrayBox = { x0: number; x1: number; z0: number; z1: number };

/**
 * A7 (09): the JSW book's footprint held open (clip `open`, frame 30, measured from the GLB): the
 * front cover swings 110 degrees about the spine, out to the left and toward the camera. The tray
 * shot frames this box, so the open book is centred and whole at every width.
 */
export const JSW_OPEN: TrayBox = { x0: -0.2978, x1: 0.1795, z0: -0.0135, z1: 0.349 };
export const scaledBox = (b: TrayBox, s: number): TrayBox => ({ x0: b.x0 * s, x1: b.x1 * s, z0: b.z0 * s, z1: b.z1 * s });
