import React from 'react';
import { Play, RotateCcw, Home, Volume2, VolumeX } from 'lucide-react';
import { TrackConfig } from '../types/game';

interface PauseModalProps {
  track: TrackConfig;
  isMuted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onReturnToMenu: () => void;
  onToggleMute: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  track,
  isMuted,
  onResume,
  onRestart,
  onReturnToMenu,
  onToggleMute,
}) => {
  return (
    <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 z-30">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl p-6 flex flex-col gap-5 text-center">
        <div>
          <h2 className="text-xl font-racing font-bold text-white uppercase tracking-wider">
            Race Paused
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">{track.name}</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-racing font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Play size={16} fill="currentColor" />
            <span>Resume Race</span>
          </button>

          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-racing text-xs uppercase tracking-wider transition-colors cursor-pointer border border-neutral-700"
          >
            <RotateCcw size={15} />
            <span>Restart Track</span>
          </button>

          <button
            onClick={onToggleMute}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-racing text-xs uppercase tracking-wider transition-colors cursor-pointer border border-neutral-700"
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span>{isMuted ? 'Unmute Audio' : 'Mute Audio'}</span>
          </button>

          <button
            onClick={onReturnToMenu}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-neutral-800/60 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 font-racing text-xs uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Home size={15} />
            <span>Quit to Garage</span>
          </button>
        </div>
      </div>
    </div>
  );
};
