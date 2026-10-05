import type { ForwardRefExoticComponent, RefAttributes } from 'react';
import type { MeshReflectorMaterialProps } from '@react-three/drei';
/** drei's MeshReflectorMaterial with a `gate`: the reflection re-renders only when gate() returns true. */
export declare const GatedReflectorMaterial: ForwardRefExoticComponent<MeshReflectorMaterialProps & { gate?: () => boolean } & RefAttributes<unknown>>;
