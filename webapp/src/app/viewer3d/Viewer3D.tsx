import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { getLength } from '../../core/board/board';
import { useBoardState } from '../state/BoardStateContext';
import { BoardMesh } from './BoardMesh';

export function Viewer3D() {
  const { board } = useBoardState();
  // buildSurfaceMesh's coordinates run x=[0, length], not centered at the
  // origin; point OrbitControls' orbit target at the board's midpoint so the
  // initial view frames it, without translating core/surface's geometry itself.
  const target: [number, number, number] = [getLength(board) / 2, 0, 0];

  return (
    <Canvas camera={{ position: [100, 60, 150], fov: 45 }} style={{ width: '100%', height: '480px' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={0.8} />
      <BoardMesh board={board} />
      <OrbitControls target={target} />
    </Canvas>
  );
}
