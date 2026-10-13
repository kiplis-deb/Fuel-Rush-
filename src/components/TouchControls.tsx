import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PlayerInput } from '../types/game';

interface TouchControlsProps {
  onInputChange: (input: Partial<PlayerInput>) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onInputChange }) => {
  return (
    <div className="absolute inset-x-0 bottom-3 px-4 flex justify-between items-end pointer-events-none md:hidden z-20">
      {/* Left / Right Steering Buttons */}
      <div className="flex gap-2 pointer-events-auto">
        <button
          onTouchStart={() => onInputChange({ steer: 1.0 })}
          onTouchEnd={() => onInputChange({ steer: 0 })}
          className="w-14 h-14 rounded-xl bg-neutral-900/80 active:bg-neutral-700/90 border border-neutral-700 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-transform"
        >
          <ChevronLeft size={28} />
        </button>
        <button
          onTouchStart={() => onInputChange({ steer: -1.0 })}
          onTouchEnd={() => onInputChange({ steer: 0 })}
          className="w-14 h-14 rounded-xl bg-neutral-900/80 active:bg-neutral-700/90 border border-neutral-700 backdrop-blur-md flex items-center justify-center text-white active:scale-95 transition-transform"
        >
          <ChevronRight size={28} />
        </button>
      </div>

      {/* Handbrake, Brake/Reverse, and Throttle Gas */}
      <div className="flex items-end gap-2.5 pointer-events-auto">
        {/* Handbrake Drift */}
        <button
          onTouchStart={() => onInputChange({ handbrake: true })}
          onTouchEnd={() => onInputChange({ handbrake: false })}
          className="w-12 h-12 rounded-xl bg-amber-950/70 active:bg-amber-800 border border-amber-600/60 backdrop-blur-md flex items-center justify-center font-racing text-xs text-amber-200 uppercase font-bold active:scale-95"
        >
          Drift
        </button>

        {/* Brake / Reverse */}
        <button
          onTouchStart={() => onInputChange({ brake: 1.0, reverse: true })}
          onTouchEnd={() => onInputChange({ brake: 0, reverse: false })}
          className="w-13 h-14 rounded-xl bg-red-950/70 active:bg-red-800 border border-red-600/60 backdrop-blur-md flex items-center justify-center font-racing text-xs text-red-200 uppercase font-bold active:scale-95"
        >
          Brake
        </button>

        {/* Throttle (Gas) */}
        <button
          onTouchStart={() => onInputChange({ throttle: 1.0 })}
          onTouchEnd={() => onInputChange({ throttle: 0 })}
          className="w-15 h-16 rounded-xl bg-emerald-950/80 active:bg-emerald-700 border border-emerald-500/80 backdrop-blur-md flex items-center justify-center font-racing text-sm text-emerald-200 uppercase font-extrabold active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
        >
          Gas
        </button>
      </div>
    </div>
  );
};
