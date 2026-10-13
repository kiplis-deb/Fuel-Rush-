import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Fuel, Trophy, RotateCcw, ArrowRight, Home, Zap } from 'lucide-react';
import { TrackConfig, VehicleConfig } from '../types/game';

interface GameOverModalProps {
  type: 'out_of_fuel' | 'finished';
  track: TrackConfig;
  vehicle: VehicleConfig;
  timeTaken: number;
  remainingFuel: number;
  topSpeed: number;
  checkpointsCompleted: number;
  totalCheckpoints: number;
  onRetry: () => void;
  onNextTrack: () => void;
  onReturnToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  type,
  track,
  vehicle,
  timeTaken,
  remainingFuel,
  topSpeed,
  checkpointsCompleted,
  totalCheckpoints,
  onRetry,
  onNextTrack,
  onReturnToMenu,
}) => {
  const isVictory = type === 'finished';

  useEffect(() => {
    if (isVictory) {
      // Fire celebration confetti
      const end = Date.now() + 2 * 1000;
      const colors = ['#10b981', '#06b6d4', '#f59e0b'];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors,
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      })();
    }
  }, [isVictory]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-30">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-6">
        {/* Banner */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
              isVictory
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                : 'bg-red-500/20 text-red-400 border border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
            }`}
          >
            {isVictory ? <Trophy size={32} /> : <Fuel size={32} />}
          </div>

          <h2 className="text-2xl sm:text-3xl font-racing font-extrabold text-white uppercase tracking-wide">
            {isVictory ? 'Circuit Cleared!' : 'Tank Empty!'}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-sm">
            {isVictory
              ? `You mastered ${track.name} with ${remainingFuel.toFixed(1)}L fuel remaining in your tank.`
              : `Your fuel supply dried out before reaching the next checkpoint. Manage throttle and pick up jerry cans!`}
          </p>
        </div>

        {/* Stats Matrix */}
        <div className="grid grid-cols-2 gap-3 bg-neutral-950/70 border border-neutral-800 rounded-xl p-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-racing text-neutral-400 uppercase">Race Time</span>
            <span className="text-lg font-racing font-bold text-neutral-100 tabular-nums">
              {formatTime(timeTaken)}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-racing text-neutral-400 uppercase">Fuel Remaining</span>
            <span
              className={`text-lg font-racing font-bold tabular-nums ${
                isVictory ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {remainingFuel.toFixed(1)} Liters
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-racing text-neutral-400 uppercase">Top Velocity</span>
            <span className="text-lg font-racing font-bold text-sky-400 tabular-nums">
              {Math.round(topSpeed)} KM/H
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-racing text-neutral-400 uppercase">Checkpoints</span>
            <span className="text-lg font-racing font-bold text-amber-400 tabular-nums">
              {checkpointsCompleted} / {totalCheckpoints}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onReturnToMenu}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-racing text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Home size={15} />
            <span>Garage</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onRetry}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-racing text-xs uppercase tracking-wider transition-colors cursor-pointer border border-neutral-700"
            >
              <RotateCcw size={15} />
              <span>Retry</span>
            </button>

            {isVictory && (
              <button
                onClick={onNextTrack}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-racing font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                <span>Next Circuit</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
