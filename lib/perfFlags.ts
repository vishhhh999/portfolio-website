'use client';

/**
 * H2 profiling switches, only with ?perf: ?perf&no=ssao,pcss,contact,screenlights,bloom,reflector,msaa,fullcopy
 * turns single features off so their cost can be measured (tools/frame-budget.mjs). Never set in
 * production URLs; without ?perf the set is always empty.
 */
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
const perf = !!params && params.has('perf');
export const PERF_OFF = new Set(perf ? (params!.get('no') ?? '').split(',').filter(Boolean) : []);
export const perfOff = (feature: string) => PERF_OFF.has(feature);
