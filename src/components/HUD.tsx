import React from 'react';
import * as THREE from 'three';
import { CameraView, TrackConfig, VehicleConfig, VehicleTelemetry } from '../types/game';
import { Minimap } from './Minimap';
import { Camera, Volume2, VolumeX, RotateCcw, Pause, Navigation, Fuel, AlertTriangle, Flag, CheckCircle2 } from 'lucide-react';

interface HUDProps {
  telemetry: VehicleTelemetry;
  track: TrackConfig;
  vehicle: VehicleConfig;
  activeCheckpointIndex: number;
  totalCheckpoints: number;
  raceTimer: number;
  cameraMode: CameraView;
  isMuted: boolean;
  carPos: THREE.Vector3;
  carHeading: number;
  checkpoints: { id: number; position: [number, number, number]; collected?: boolean }[];
  startFinishLine: { position: [number, number, number]; width: number };
  fuelCanisters: { id: number; position: [number, number, number]; collected: boolean }[];
  finishLockedWarning: number | null;
  onToggleCamera: () => void;
  onToggleMute: () => void;
  onRestart: () => void;
  onPause: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  telemetry,
  track,
  vehicle,
  totalCheckpoints,
  raceTimer,
  cameraMode,
  isMuted,
  carPos,
  carHeading,
  checkpoints,
  startFinishLine,
  fuelCanisters,
  finishLockedWarning,
  onToggleCamera,
  onToggleMute,
  onRestart,
  onPause,
}) => {
  // Format race timer mm:ss.xx
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  };

  const collectedCount = checkpoints.filter((c) => c.collected).length;
  const uncollected = checkpoints.filter((c) => !c.collected);
  const allCollected = uncollected.length === 0 && checkpoints.length > 0;

  // Determine current navigation target: nearest uncollected checkpoint, or Start/Finish line if all done!
  let targetPos: [number, number, number] = startFinishLine?.position || [0, 0, 0];
  let targetLabel = 'Finish Line';
  let isTargetFinish = allCollected;

  if (!allCollected && uncollected.length > 0) {
    let closest = uncollected[0];
    let minDist = Infinity;
    uncollected.forEach((cp) => {
      const dx = cp.position[0] - carPos.x;
      const dz = cp.position[2] - carPos.z;
      const d = dx * dx + dz * dz;
      if (d < minDist) {
        minDist = d;
        closest = cp;
      }
    });
    targetPos = closest.position;
    targetLabel = `Checkpoint #${closest.id}`;
  }

  // Calculate distance and relative angle to target
  const dx = targetPos[0] - carPos.x;
  const dz = targetPos[2] - carPos.z;
  const distanceToTarget = Math.round(Math.sqrt(dx * dx + dz * dz));
  const targetWorldAngle = Math.atan2(dx, dz);
  const targetAngleOffset = targetWorldAngle - carHeading;

  // Fuel percentage & warning state
  const fuelPct = Math.max(0, Math.min(100, Math.round((telemetry.fuel / telemetry.maxFuel) * 100)));
  const isLowFuel = fuelPct <= 20;
  const isCriticalFuel = fuelPct <= 8;

  // RPM percentage (800 to 7800)
  const rpmRatio = Math.max(0, Math.min(1, (telemetry.rpm - 800) / 7000));
  const isRedline = telemetry.rpm > 6800;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 overflow-hidden">
      {/* Top Header & Navigation Bar */}
      <header className="flex items-center justify-between w-full pointer-events-auto">
        {/* Left: Circuit Info & Live Checkpoint Target */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <span className="font-racing font-bold tracking-wider text-white text-base">
              {track.name}
            </span>
            <span className="text-neutral-500">·</span>
            <span className="text-xs text-neutral-400 uppercase tracking-wider">{vehicle.name}</span>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-neutral-400">
            {/* Checkpoint Counter */}
            <div
              className={`flex items-center gap-1.5 backdrop-blur-md border px-3 py-1.5 rounded-lg transition-colors ${
                allCollected
                  ? 'bg-emerald-950/80 border-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'bg-neutral-900/80 border-neutral-700/60'
              }`}
            >
              {allCollected ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <span className="text-neutral-400 uppercase font-racing text-[11px]">Checkpoints</span>
              )}
              <span className={`font-racing font-bold text-sm ${allCollected ? 'text-emerald-400' : 'text-sky-400'}`}>
                {collectedCount}
              </span>
              <span className="text-neutral-500 font-racing">/</span>
              <span className="text-neutral-400 font-racing">{totalCheckpoints}</span>
            </div>

            {/* Target Distance & Relative Compass Arrow */}
            <div
              className={`flex items-center gap-2 backdrop-blur-md border px-3 py-1.5 rounded-lg ${
                isTargetFinish
                  ? 'bg-amber-950/80 border-amber-500/80 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-neutral-900/80 border-neutral-700/60 text-neutral-200'
              }`}
            >
              {isTargetFinish ? (
                <Flag size={14} className="text-amber-400 animate-bounce" />
              ) : (
                <Navigation
                  size={14}
                  className="text-emerald-400 transition-transform duration-75"
                  style={{ transform: `rotate(${THREE.MathUtils.radToDeg(targetAngleOffset)}deg)` }}
                />
              )}
              <div className="flex items-center gap-1 font-racing text-xs">
                <span className="text-[10px] text-neutral-400 uppercase">{targetLabel}:</span>
                <span className="font-bold tabular-nums">{distanceToTarget}m</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Race Time & Lap Progress */}
        <div className="hidden sm:flex flex-col items-center bg-neutral-900/85 backdrop-blur-md border border-neutral-700/60 px-5 py-2 rounded-xl shadow-lg">
          <span className="text-[10px] font-racing uppercase tracking-widest text-neutral-400">
            Elapsed Time
          </span>
          <span className="text-2xl font-racing font-bold tracking-wider text-neutral-100 tabular-nums">
            {formatTime(raceTimer)}
          </span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleCamera}
            className="flex items-center gap-1.5 bg-neutral-900/85 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 px-3 py-2 rounded-lg text-xs font-racing transition-colors cursor-pointer"
            title="Switch Camera View (Key: C)"
          >
            <Camera size={14} />
            <span className="hidden md:inline uppercase text-[11px]">
              {cameraMode === 'chase_close' ? 'Chase' : cameraMode === 'hood' ? 'Cockpit' : cameraMode === 'chase_far' ? 'Far' : 'Top'}
            </span>
          </button>

          <button
            onClick={onToggleMute}
            className="bg-neutral-900/85 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 p-2 rounded-lg text-xs transition-colors cursor-pointer"
            title="Toggle Engine Audio (Key: M)"
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <button
            onClick={onRestart}
            className="bg-neutral-900/85 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 p-2 rounded-lg text-xs transition-colors cursor-pointer"
            title="Restart Track (Key: R)"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={onPause}
            className="bg-neutral-900/85 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/60 p-2 rounded-lg text-xs transition-colors cursor-pointer"
            title="Pause Game (Key: Esc)"
          >
            <Pause size={15} />
          </button>
        </div>
      </header>

      {/* Middle Alerts (Drift State, Finish Locked Warning, All Collected Notification) */}
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        {/* Finish Line Locked Alert */}
        {finishLockedWarning !== null && finishLockedWarning > 0 && (
          <div className="animate-bounce bg-red-600/90 border border-red-400 text-white font-racing font-bold text-sm tracking-wide px-5 py-2 rounded-xl shadow-2xl flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-300" />
            <span>FINISH LINE LOCKED! Collect all {finishLockedWarning} remaining checkpoints first!</span>
          </div>
        )}

        {/* All Checkpoints Collected Notification */}
        {allCollected && (
          <div className="animate-pulse bg-emerald-600/90 border border-emerald-400 text-white font-racing font-bold text-sm tracking-wide px-6 py-2.5 rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.6)] flex items-center gap-2.5">
            <Flag size={20} className="text-amber-300" />
            <span>ALL CHECKPOINTS CLEARED! RUSH TO START/FINISH LINE TO WIN!</span>
          </div>
        )}

        {telemetry.isDrifting && (
          <div className="animate-pulse bg-amber-500/20 border border-amber-500/50 backdrop-blur-md px-4 py-1 rounded-md text-amber-300 font-racing font-bold text-xs tracking-widest uppercase">
            DRIFT +{Math.round(Math.abs(telemetry.driftAngle) * 100)} PTS
          </div>
        )}

        {telemetry.isOffroad && (
          <div className="bg-red-500/20 border border-red-500/50 backdrop-blur-md px-4 py-1 rounded-md text-red-300 font-racing text-xs tracking-wider uppercase">
            Rough Terrain · Grip Reduced
          </div>
        )}

        {isLowFuel && !isCriticalFuel && (
          <div className="flex items-center gap-1.5 animate-bounce bg-amber-600/30 border border-amber-500/60 backdrop-blur-md px-3.5 py-1.5 rounded-lg text-amber-300 font-racing text-xs font-semibold">
            <AlertTriangle size={14} />
            <span>LOW FUEL WARNING · FIND CANISTER OR CLEAR CHECKPOINTS</span>
          </div>
        )}

        {isCriticalFuel && (
          <div className="flex items-center gap-1.5 animate-pulse bg-red-600/40 border border-red-500 backdrop-blur-md px-4 py-1.5 rounded-lg text-red-100 font-racing text-sm font-bold shadow-[0_0_16px_rgba(239,68,68,0.6)]">
            <Fuel size={16} className="text-red-400" />
            <span>FUEL CRITICAL ({fuelPct}%) · ENGINE SPUTTERING</span>
          </div>
        )}
      </div>

      {/* Bottom Main Cockpit Cluster & Minimap */}
      <footer className="flex flex-col md:flex-row items-end justify-between gap-4 pointer-events-auto">
        {/* Left: Tactical GPS Radar Minimap */}
        <div className="hidden sm:block">
          <Minimap
            waypoints={track.waypoints}
            roadBranches={track.roadBranches}
            startFinishLine={startFinishLine}
            carPos={carPos}
            carHeading={carHeading}
            checkpoints={checkpoints}
            activeCheckpointIndex={collectedCount}
            fuelCanisters={fuelCanisters}
            isFinishUnlocked={allCollected}
          />
        </div>

        {/* Center/Right: Speedometer, Gear, RPM, Fuel Gauges */}
        <div className="flex items-end gap-3 w-full md:w-auto justify-end">
          {/* Fuel Management Gauge */}
          <div className="bg-neutral-900/85 backdrop-blur-md border border-neutral-700/60 rounded-xl p-3.5 shadow-2xl flex flex-col justify-between w-36 sm:w-44">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-neutral-300">
                <Fuel size={14} className={isLowFuel ? 'text-amber-400 animate-pulse' : 'text-neutral-400'} />
                <span className="text-[11px] font-racing font-semibold uppercase tracking-wider">
                  Fuel Tank
                </span>
              </div>
              <span
                className={`font-racing font-bold text-xs tabular-nums ${
                  isCriticalFuel ? 'text-red-400' : isLowFuel ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {fuelPct}%
              </span>
            </div>

            {/* Fuel Bar with segments */}
            <div className="w-full bg-neutral-950 h-3 rounded-full overflow-hidden p-0.5 border border-neutral-800">
              <div
                className={`h-full rounded-full transition-all duration-150 ${
                  isCriticalFuel
                    ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                    : isLowFuel
                    ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                    : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                }`}
                style={{ width: `${fuelPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-2 text-[10px] text-neutral-400 font-racing">
              <span>{telemetry.fuel.toFixed(1)} / {telemetry.maxFuel} L</span>
              <span className="text-neutral-500">{telemetry.fuelRate > 0 ? `-${(telemetry.fuelRate * 60).toFixed(1)} L/m` : 'Idle'}</span>
            </div>
          </div>

          {/* Speedometer & RPM Gauges */}
          <div className="bg-neutral-900/90 backdrop-blur-md border border-neutral-700/60 rounded-xl p-4 shadow-2xl flex flex-col items-center min-w-[160px] sm:min-w-[190px]">
            {/* RPM Arc Bar */}
            <div className="w-full mb-2">
              <div className="flex justify-between items-center text-[10px] font-racing text-neutral-400 mb-1">
                <span>RPM</span>
                <span className={`tabular-nums ${isRedline ? 'text-rose-400 font-bold' : 'text-neutral-300'}`}>
                  {Math.round(telemetry.rpm)}
                </span>
              </div>
              <div className="w-full bg-neutral-950 h-2 rounded-full overflow-hidden border border-neutral-800">
                <div
                  className={`h-full transition-all duration-75 ${
                    isRedline ? 'bg-rose-500' : 'bg-gradient-to-r from-sky-500 via-emerald-400 to-amber-400'
                  }`}
                  style={{ width: `${rpmRatio * 100}%` }}
                />
              </div>
            </div>

            {/* Large Speed Digits & Current Gear */}
            <div className="flex items-baseline justify-between w-full">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-racing font-extrabold text-white tracking-tight tabular-nums">
                  {Math.round(telemetry.speedKmh)}
                </span>
                <span className="text-xs font-racing text-neutral-400 uppercase tracking-widest">
                  KM/H
                </span>
              </div>

              {/* Gear Badge */}
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-racing uppercase text-neutral-500">Gear</span>
                <div className="w-9 h-9 rounded-lg bg-neutral-950 border border-neutral-700 flex items-center justify-center font-racing font-extrabold text-lg text-emerald-400">
                  {telemetry.gear}
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

