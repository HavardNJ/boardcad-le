import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useBoardState } from '../state/BoardStateContext';
import { BoardMesh } from './BoardMesh';

export function Viewer3D() {
  const { board } = useBoardState();

  return (
    <Canvas camera={{ position: [100, 60, 150], fov: 45 }} style={{ width: '100%', height: '480px' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 200, 100]} intensity={0.8} />
      <BoardMesh board={board} />
      <OrbitControls />
    </Canvas>
  );
}
