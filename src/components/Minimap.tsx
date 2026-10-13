import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Maximize2, Minimize2, Ruler } from 'lucide-react';
import { RoadBranch } from '../types/game';

interface MinimapProps {
  waypoints: [number, number, number][];
  roadBranches?: RoadBranch[];
  startFinishLine?: { position: [number, number, number] };
  carPos: THREE.Vector3;
  carHeading: number;
  checkpoints: { id: number; position: [number, number, number]; collected?: boolean }[];
  activeCheckpointIndex: number;
  fuelCanisters: { id: number; position: [number, number, number]; collected: boolean }[];
  isFinishUnlocked?: boolean;
}

export const Minimap: React.FC<MinimapProps> = ({
  waypoints,
  roadBranches,
  startFinishLine,
  carPos,
  carHeading,
  checkpoints,
  fuelCanisters,
  isFinishUnlocked = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoomMode, setZoomMode] = useState<'track' | 'local'>('track');
  const [showDistances, setShowDistances] = useState<boolean>(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const center = width / 2;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Compute track bounding box for auto-scaling
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    if (roadBranches && roadBranches.length > 0) {
      roadBranches.forEach((branch) => {
        branch.points.forEach(([x, , z]) => {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minZ = Math.min(minZ, z);
          maxZ = Math.max(maxZ, z);
        });
      });
    } else {
      waypoints.forEach(([x, , z]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      });
    }

    const trackWidth = Math.max(maxX - minX, 100);
    const trackHeight = Math.max(maxZ - minZ, 100);
    const maxDim = Math.max(trackWidth, trackHeight);

    const padding = 28;
    const scale = (width - padding * 2) / maxDim;
    const offsetX = (minX + maxX) / 2;
    const offsetZ = (minZ + maxZ) / 2;

    // Helper coordinate projection
    const toCanvasX = (worldX: number) => {
      if (zoomMode === 'local') {
        const localScale = 1.35;
        return center + (worldX - carPos.x) * localScale;
      }
      return center + (worldX - offsetX) * scale;
    };

    const toCanvasY = (worldZ: number) => {
      if (zoomMode === 'local') {
        const localScale = 1.35;
        return center + (worldZ - carPos.z) * localScale;
      }
      return center + (worldZ - offsetZ) * scale;
    };

    // Draw Radar Circular Clip Mask
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.clip();

    // Radar Dark Grid Background
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, width, height);

    // Draw Concentric Range Rings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    [center * 0.35, center * 0.65, center * 0.94].forEach((r) => {
      ctx.beginPath();
      ctx.arc(center, center, r, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw Crosshairs
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, height);
    ctx.moveTo(0, center);
    ctx.lineTo(width, center);
    ctx.stroke();

    // 1. Draw All Branching Roads
    const branches = roadBranches && roadBranches.length > 0
      ? roadBranches
      : [{ id: 'main', points: waypoints, isClosedLoop: true, width: 14 }];

    branches.forEach((b) => {
      if (b.points.length < 2) return;

      // Outer track border
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
      ctx.lineWidth = b.isClosedLoop ? 9 : 7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      b.points.forEach(([x, , z], idx) => {
        const cx = toCanvasX(x);
        const cy = toCanvasY(z);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      if (b.isClosedLoop) ctx.closePath();
      ctx.stroke();

      // Inner road line
      ctx.strokeStyle = b.isClosedLoop ? '#0284c7' : '#38bdf8';
      ctx.lineWidth = b.isClosedLoop ? 3.5 : 2.5;
      ctx.beginPath();
      b.points.forEach(([x, , z], idx) => {
        const cx = toCanvasX(x);
        const cy = toCanvasY(z);
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      if (b.isClosedLoop) ctx.closePath();
      ctx.stroke();
    });

    // 2. Draw Distance Markers Between Road Junctions / Segments (satuan meter "120m", "80m", dll)
    if (showDistances) {
      const placedLabels: { x: number; y: number }[] = [];

      branches.forEach((b) => {
        const pts = b.points;
        const count = b.isClosedLoop ? pts.length : pts.length - 1;

        for (let i = 0; i < count; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];

          const dx = p2[0] - p1[0];
          const dz = p2[2] - p1[2];
          const distanceMeters = Math.round(Math.hypot(dx, dz));

          // Only display meaningful road segments (>= 28m)
          if (distanceMeters < 28) continue;

          // Midpoint in canvas coordinates
          const midWorldX = (p1[0] + p2[0]) / 2;
          const midWorldZ = (p1[2] + p2[2]) / 2;
          const mx = toCanvasX(midWorldX);
          const my = toCanvasY(midWorldZ);

          // Avoid clutter: check if another label is too close (< 22px)
          const isTooClose = placedLabels.some((pl) => Math.hypot(pl.x - mx, pl.y - my) < 22);
          if (isTooClose) continue;

          placedLabels.push({ x: mx, y: my });

          const label = `${distanceMeters}m`;
          ctx.font = 'bold 8.5px "Chakra Petch", monospace, sans-serif';
          const textMetrics = ctx.measureText(label);
          const padX = 3;
          const boxW = textMetrics.width + padX * 2;
          const boxH = 11.5;

          // Badge dark pill background
          ctx.fillStyle = 'rgba(10, 15, 29, 0.94)';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(mx - boxW / 2, my - boxH / 2, boxW, boxH, 2.5);
          } else {
            ctx.rect(mx - boxW / 2, my - boxH / 2, boxW, boxH);
          }
          ctx.fill();

          // Border in bright yellow/amber (sesuai coretan kuning user)
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 0.9;
          ctx.stroke();

          // Text in bright yellow
          ctx.fillStyle = '#fef08a';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, mx, my);
        }
      });
    }

    // 3. Draw Fuel Canisters
    fuelCanisters.forEach((fc) => {
      if (fc.collected) return;
      const fx = toCanvasX(fc.position[0]);
      const fy = toCanvasY(fc.position[2]);

      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Halo
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fx, fy, 6, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 4. Draw Checkpoints
    // Find closest uncollected for highlight
    let closestUncollectedId = -1;
    let minDistanceSq = Infinity;
    checkpoints.forEach((cp) => {
      if (!cp.collected) {
        const dx = cp.position[0] - carPos.x;
        const dz = cp.position[2] - carPos.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDistanceSq) {
          minDistanceSq = distSq;
          closestUncollectedId = cp.id;
        }
      }
    });

    checkpoints.forEach((cp) => {
      const cpx = toCanvasX(cp.position[0]);
      const cpy = toCanvasY(cp.position[2]);

      if (cp.collected) {
        // Collected Checkpoint (muted soft green dot)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.45)';
        ctx.beginPath();
        ctx.arc(cpx, cpy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (cp.id === closestUncollectedId) {
        // Closest Active Target Checkpoint (Bright pulsing Emerald)
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(cpx, cpy, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cpx, cpy, 9, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Other Pending Checkpoints (Cyan)
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(cpx, cpy, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cpx, cpy, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // 5. Draw Start / Finish Line
    if (startFinishLine) {
      const sfx = toCanvasX(startFinishLine.position[0]);
      const sfy = toCanvasY(startFinishLine.position[2]);

      if (isFinishUnlocked) {
        // UNLOCKED VICTORY FINISH GATE! (Flashing gold/emerald)
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(sfx, sfy, 6.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sfx, sfy, 11, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // LOCKED START/FINISH GATE
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(sfx - 4, sfy - 4, 8, 8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(sfx - 4, sfy - 4, 8, 8);
      }
    }

    // 6. Draw Player Vehicle Position & Direction Arrow
    const carCanvasX = toCanvasX(carPos.x);
    const carCanvasY = toCanvasY(carPos.z);

    ctx.save();
    ctx.translate(carCanvasX, carCanvasY);
    ctx.rotate(carHeading);

    // Vehicle Arrow
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.moveTo(0, 8); // Tip
    ctx.lineTo(-5, -6);
    ctx.lineTo(0, -3);
    ctx.lineTo(5, -6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();

    ctx.restore(); // Restore clip
  }, [waypoints, roadBranches, startFinishLine, carPos, carHeading, checkpoints, fuelCanisters, isFinishUnlocked, zoomMode, showDistances]);

  return (
    <div className="relative group bg-neutral-900/85 backdrop-blur-md border border-neutral-700/60 rounded-xl p-2.5 shadow-2xl flex flex-col items-center">
      <div className="flex items-center justify-between w-full mb-1.5 px-1">
        <span className="text-[11px] font-racing font-semibold tracking-wider text-neutral-400 uppercase">
          GPS Radar
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowDistances((prev) => !prev)}
            className={`p-1 rounded transition-colors cursor-pointer ${
              showDistances ? 'text-yellow-400 bg-yellow-950/60 border border-yellow-500/40' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            title={showDistances ? 'Sembunyikan Jarak Jalan (meter)' : 'Tampilkan Jarak Jalan (meter)'}
          >
            <Ruler size={13} />
          </button>
          <button
            onClick={() => setZoomMode((prev) => (prev === 'track' ? 'local' : 'track'))}
            className="text-neutral-400 hover:text-neutral-100 transition-colors p-1 rounded cursor-pointer"
            title={zoomMode === 'track' ? 'Zoom to Vehicle' : 'View Full Track'}
          >
            {zoomMode === 'track' ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950/90 shadow-inner">
        <canvas ref={canvasRef} width={204} height={204} className="w-[185px] h-[185px] sm:w-[204px] sm:h-[204px] block" />
      </div>

      <div className="flex items-center justify-between w-full mt-2 text-[10px] text-neutral-400 font-racing px-1 gap-2">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
          <span>Gate</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
          <span>Fuel</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold text-yellow-400 bg-neutral-950 px-1 py-0.5 rounded border border-yellow-500/50">...m</span>
          <span>Jarak</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
          <span>Car</span>
        </div>
      </div>
    </div>
  );
};
