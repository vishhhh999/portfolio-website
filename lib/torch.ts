'use client';

/**
 * The AFTER DARK hand lamp, shared with the page (C2): where the torch is (viewport CSS px), its
 * radius and soft edge, the light outside it and its strike level. The lamp rig writes it every
 * frame (the same critically damped follow as the booth's hand lamp); the TorchOverlay reads it.
 */
export const torch = { x: -1e4, y: -1e4, r: 200, soft: 0.55, outside: 0, level: 1, fromRig: false };
