'use client';

import { useSyncExternalStore } from 'react';
import { activeLayout, onLayoutChange, type LayoutKey } from './staging';

/** L2 (09B): the active arrangement's key; components re-render when it changes. */
export const useLayoutKey = (): LayoutKey => useSyncExternalStore(onLayoutChange, () => activeLayout().key, () => 'wide');
