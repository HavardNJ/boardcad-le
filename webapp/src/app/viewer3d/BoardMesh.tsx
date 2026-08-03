import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Board } from '../../core/board/types';
import { buildSurfaceMesh } from '../../core/surface/surfaceMesh';

export function BoardMesh({ board }: { board: Board }) {
  const geometry = useMemo(() => {
    const mesh = buildSurfaceMesh(board, 60, 32);
    const positions = mesh.positions;

    // core/surface uses (x=length, y=half-width, z=height); remap to Three's Y-up.
    const remapped = new Float32Array(positions.length);
    for (let i = 0; i < positions.length / 3; i++) {
      remapped[i * 3] = positions[i * 3]; // length -> X
      remapped[i * 3 + 1] = positions[i * 3 + 2]; // height -> Y
      remapped[i * 3 + 2] = positions[i * 3 + 1]; // width -> Z
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(remapped, 3));
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [board]);

  // `new THREE.BufferGeometry()` built imperatively here is not owned by R3F's
  // JSX reconciler, so it is never auto-disposed. Each board edit creates a new
  // geometry via useMemo above; without this, the old geometry's GPU buffers
  // (VBO/IBO) would leak on every dispatch. The cleanup runs right before the
  // effect re-fires for the next `geometry` (i.e. right when the old one
  // becomes unreferenced), and also on unmount.
  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#e2e8f0" side={THREE.DoubleSide} />
    </mesh>
  );
}
