import React from 'react';
import { TRACKS } from '../game/trackData';
import { VEHICLES } from '../game/vehicleConfigs';
import { TrackConfig, VehicleConfig } from '../types/game';
import { Play, Gauge, Zap, Fuel, Shield, MapPin } from 'lucide-react';

interface StartMenuProps {
  selectedTrack: TrackConfig;
  selectedVehicle: VehicleConfig;
  onSelectTrack: (trackId: string) => void;
  onSelectVehicle: (vehicleId: string) => void;
  onSelectColor: (hex: string) => void;
  onStartRace: () => void;
}

const CAR_COLORS = [
  { name: 'Cyan Electric', hex: '#06b6d4' },
  { name: 'Crimson Fire', hex: '#ef4444' },
  { name: 'Amber Sunset', hex: '#f59e0b' },
  { name: 'Emerald Volt', hex: '#10b981' },
  { name: 'Midnight Purple', hex: '#a855f7' },
  { name: 'Stealth Shadow', hex: '#262626' },
];

export const StartMenu: React.FC<StartMenuProps> = ({
  selectedTrack,
  selectedVehicle,
  onSelectTrack,
  onSelectVehicle,
  onSelectColor,
  onStartRace,
}) => {
  return (
    <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 z-30 overflow-y-auto">
      <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-700/70 rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-5 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-racing font-extrabold text-white tracking-wide uppercase">
              Apex Horizon <span className="text-emerald-400">· Fuel Rush 3D</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Realistic vehicle physics · Tactical fuel endurance · Checkpoint circuit rush
            </p>
          </div>

          <button
            onClick={onStartRace}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-racing font-bold text-sm tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] cursor-pointer self-start sm:self-auto"
          >
            <Play size={18} fill="currentColor" />
            <span>Launch Race</span>
          </button>
        </div>

        {/* Track Selection & Vehicle Selection in Two Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Track Selection */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-racing uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <MapPin size={14} className="text-emerald-400" />
              <span>Select Circuit</span>
            </span>

            <div className="flex flex-col gap-2.5">
              {TRACKS.map((t) => {
                const isSelected = t.id === selectedTrack.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectTrack(t.id)}
                    className={`flex items-start justify-between p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-800 border-emerald-500/80 shadow-md'
                        : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-racing font-bold text-white text-sm">
                          {t.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-racing uppercase">
                          {t.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">{t.subtitle}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-neutral-400">
                        <span>{t.checkpoints.length} Checkpoints</span>
                        <span>·</span>
                        <span>{t.roadBranches?.length || 1} Road Branches</span>
                        <span>·</span>
                        <span>{t.initialFuel}L Tank</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vehicle Selection */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-racing uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Gauge size={14} className="text-emerald-400" />
              <span>Select Machine & Livery</span>
            </span>

            <div className="flex flex-col gap-2.5">
              {VEHICLES.map((v) => {
                const isSelected = v.id === selectedVehicle.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => onSelectVehicle(v.id)}
                    className={`flex flex-col p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-800 border-emerald-500/80 shadow-md'
                        : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <span className="font-racing font-bold text-white text-sm">
                          {v.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 uppercase font-racing">
                          {v.category}
                        </span>
                      </div>
                      <span className="font-racing font-semibold text-xs text-neutral-300">
                        {v.topSpeed} KM/H
                      </span>
                    </div>

                    {/* Vehicle Performance Bars */}
                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-neutral-400">
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span>Accel</span>
                          <span>{v.acceleration}%</span>
                        </div>
                        <div className="h-1 bg-neutral-950 rounded-full overflow-hidden">
                          <div className="h-full bg-sky-400" style={{ width: `${v.acceleration}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span>Grip</span>
                          <span>{v.handling}%</span>
                        </div>
                        <div className="h-1 bg-neutral-950 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-400" style={{ width: `${v.handling}%` }} />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span>Fuel Econ</span>
                          <span>{v.fuelEfficiency}%</span>
                        </div>
                        <div className="h-1 bg-neutral-950 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400" style={{ width: `${v.fuelEfficiency}%` }} />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom Paint Swatches */}
            <div className="mt-1">
              <span className="text-[11px] font-racing uppercase tracking-wider text-neutral-400 block mb-1.5">
                Chassis Paint Finish
              </span>
              <div className="flex items-center gap-2">
                {CAR_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => onSelectColor(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-7 h-7 rounded-full transition-transform cursor-pointer border ${
                      selectedVehicle.color === c.hex
                        ? 'scale-115 border-white ring-2 ring-emerald-400'
                        : 'border-neutral-600 hover:scale-105'
                    }`}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Briefing & Controls Guide Footer */}
        <div className="border-t border-neutral-800 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-semibold text-neutral-300">Controls:</span>
            <span><kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-200">W</kbd> / <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-200">↑</kbd> Throttle</span>
            <span><kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-200">S</kbd> / <kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-200">↓</kbd> Brake</span>
            <span><kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-200">A</kbd><kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-200">D</kbd> Steer</span>
            <span><kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-200">Space</kbd> Handbrake Drift</span>
            <span><kbd className="px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-200">C</kbd> Camera</span>
          </div>

          <div className="text-amber-400/90 text-xs font-racing flex items-center gap-1.5">
            <Fuel size={14} />
            <span>Tactical Hint: Coasting saves fuel; clear checkpoints to earn bonus liters!</span>
          </div>
        </div>
      </div>
    </div>
  );
};
