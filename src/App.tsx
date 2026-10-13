/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { CameraView, GameState, PlayerInput, TrackConfig, VehicleConfig, VehicleTelemetry } from './types/game';
import { soundEngine } from './utils/audio';
import { GameEngine } from './game/GameEngine';
import { TRACKS } from './game/trackData';
import { VEHICLES } from './game/vehicleConfigs';
import { HUD } from './components/HUD';
import { StartMenu } from './components/StartMenu';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { TouchControls } from './components/TouchControls';

const CAMERA_MODES: CameraView[] = ['chase_close', 'chase_far', 'hood', 'top_down'];

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  // Active configurations
  const [currentTrack, setCurrentTrack] = useState<TrackConfig>(TRACKS[0]);
  const [currentVehicle, setCurrentVehicle] = useState<VehicleConfig>(VEHICLES[0]);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [cameraMode, setCameraMode] = useState<CameraView>('chase_close');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Race progress telemetry
  const [telemetry, setTelemetry] = useState<VehicleTelemetry>({
    speedKmh: 0,
    rpm: 800,
    gear: 1,
    fuel: 40,
    maxFuel: 40,
    fuelRate: 0,
    isDrifting: false,
    driftAngle: 0,
    isOffroad: false,
    gForce: 0,
  });

  const [activeCheckpointIndex, setActiveCheckpointIndex] = useState<number>(0);
  const [raceTimer, setRaceTimer] = useState<number>(0);
  const [topSpeedAchieved, setTopSpeedAchieved] = useState<number>(0);
  const [finishLockedWarning, setFinishLockedWarning] = useState<number | null>(null);

  // Position and vectors for minimap/HUD
  const [carPos, setCarPos] = useState<THREE.Vector3>(new THREE.Vector3());
  const [carHeading, setCarHeading] = useState<number>(0);
  const [checkpoints, setCheckpoints] = useState<{ id: number; position: [number, number, number]; collected?: boolean }[]>([]);
  const [fuelCanisters, setFuelCanisters] = useState<{ id: number; position: [number, number, number]; collected: boolean }[]>([]);

  // Setup Three.js Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new GameEngine(
      containerRef.current,
      {
        onTelemetryUpdate: (telem) => {
          setTelemetry(telem);
          if (engineRef.current) {
            setCarPos(engineRef.current.getCarWorldPosition().clone());
            setCarHeading(engineRef.current.getCarHeading());
            setFuelCanisters(engineRef.current.getFuelCanisters());
          }
        },
        onCheckpointPass: (collectedCount) => {
          setActiveCheckpointIndex(collectedCount);
          if (engineRef.current) {
            setCheckpoints(engineRef.current.getCheckpoints());
          }
        },
        onFuelCollected: () => {
          if (engineRef.current) {
            setFuelCanisters(engineRef.current.getFuelCanisters());
          }
        },
        onFinishLocked: (remainingCount) => {
          setFinishLockedWarning(remainingCount);
          setTimeout(() => setFinishLockedWarning(null), 3000);
        },
        onLapComplete: () => {},
        onRaceFinish: (timeTaken, remainingFuel, topSpeed) => {
          setRaceTimer(timeTaken);
          setTopSpeedAchieved(topSpeed);
        },
        onOutOfFuel: () => {},
        onStateChange: (state) => {
          setGameState(state);
        },
      },
      currentTrack.id,
      currentVehicle.id
    );

    engineRef.current = engine;
    setCheckpoints(engine.getCheckpoints());
    setFuelCanisters(engine.getFuelCanisters());

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []); // Run once on mount

  // Keybindings tracking
  useEffect(() => {
    const keysPressed: Record<string, boolean> = {};

    const updateInputs = () => {
      if (!engineRef.current) return;

      const throttle = keysPressed['KeyW'] || keysPressed['ArrowUp'] ? 1.0 : 0.0;
      const brake = keysPressed['KeyS'] || keysPressed['ArrowDown'] ? 1.0 : 0.0;
      const steerLeft = keysPressed['KeyA'] || keysPressed['ArrowLeft'];
      const steerRight = keysPressed['KeyD'] || keysPressed['ArrowRight'];
      const handbrake = !!keysPressed['Space'];

      let steer = 0;
      if (steerLeft && !steerRight) steer = 1.0;
      if (steerRight && !steerLeft) steer = -1.0;

      engineRef.current.setInput({
        throttle,
        brake,
        steer,
        handbrake,
        reverse: brake > 0,
      });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent browser scroll on arrows / space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }

      keysPressed[e.code] = true;
      updateInputs();

      // Camera view toggle
      if (e.code === 'KeyC') {
        cycleCamera();
      }

      // Audio mute toggle
      if (e.code === 'KeyM') {
        toggleMute();
      }

      // Quick restart
      if (e.code === 'KeyR' && gameState === 'racing') {
        handleRestart();
      }

      // Pause toggle
      if (e.code === 'Escape') {
        if (gameState === 'racing') {
          engineRef.current?.pauseRace();
        } else if (gameState === 'paused') {
          engineRef.current?.resumeRace();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed[e.code] = false;
      updateInputs();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState, cameraMode]);

  // Race timer increment during racing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (gameState === 'racing') {
      interval = setInterval(() => {
        setRaceTimer((prev) => prev + 0.1);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState]);

  const handleStartRace = useCallback(() => {
    setRaceTimer(0);
    setFinishLockedWarning(null);
    if (engineRef.current) {
      engineRef.current.startRace();
      setCheckpoints(engineRef.current.getCheckpoints());
      setActiveCheckpointIndex(0);
    }
  }, []);

  const handleRestart = useCallback(() => {
    setRaceTimer(0);
    setFinishLockedWarning(null);
    if (engineRef.current) {
      engineRef.current.startRace();
      setCheckpoints(engineRef.current.getCheckpoints());
      setActiveCheckpointIndex(0);
    }
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resumeRace();
  }, []);

  const handlePause = useCallback(() => {
    engineRef.current?.pauseRace();
  }, []);

  const handleReturnToMenu = useCallback(() => {
    setGameState('menu');
    setFinishLockedWarning(null);
    engineRef.current?.resetRace();
    if (engineRef.current) {
      setCheckpoints(engineRef.current.getCheckpoints());
      setActiveCheckpointIndex(0);
    }
  }, []);

  const handleSelectTrack = useCallback((trackId: string) => {
    const t = TRACKS.find((item) => item.id === trackId);
    if (t && engineRef.current) {
      setCurrentTrack(t);
      engineRef.current.setTrack(trackId);
      setCheckpoints(engineRef.current.getCheckpoints());
      setFuelCanisters(engineRef.current.getFuelCanisters());
    }
  }, []);

  const handleSelectVehicle = useCallback((vehicleId: string) => {
    const v = VEHICLES.find((item) => item.id === vehicleId);
    if (v && engineRef.current) {
      setCurrentVehicle(v);
      engineRef.current.setVehicle(vehicleId);
    }
  }, []);

  const handleSelectColor = useCallback((hex: string) => {
    if (engineRef.current) {
      engineRef.current.setVehicleColor(hex);
      setCurrentVehicle((prev) => ({ ...prev, color: hex }));
    }
  }, []);

  const cycleCamera = useCallback(() => {
    setCameraMode((prev) => {
      const idx = CAMERA_MODES.indexOf(prev);
      const next = CAMERA_MODES[(idx + 1) % CAMERA_MODES.length];
      engineRef.current?.setCameraMode(next);
      return next;
    });
  }, []);

  const toggleMute = useCallback(() => {
    const muted = soundEngine.toggleMute();
    setIsMuted(muted);
  }, []);

  const handleNextTrack = useCallback(() => {
    const currentIdx = TRACKS.findIndex((t) => t.id === currentTrack.id);
    const nextTrack = TRACKS[(currentIdx + 1) % TRACKS.length];
    handleSelectTrack(nextTrack.id);
    handleStartRace();
  }, [currentTrack, handleSelectTrack, handleStartRace]);

  const handleTouchInput = useCallback((input: Partial<PlayerInput>) => {
    engineRef.current?.setInput(input);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950 select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* In-Game Racing HUD */}
      {gameState === 'racing' && (
        <>
          <HUD
            telemetry={telemetry}
            track={currentTrack}
            vehicle={currentVehicle}
            activeCheckpointIndex={activeCheckpointIndex}
            totalCheckpoints={currentTrack.checkpoints.length}
            raceTimer={raceTimer}
            cameraMode={cameraMode}
            isMuted={isMuted}
            carPos={carPos}
            carHeading={carHeading}
            checkpoints={checkpoints}
            startFinishLine={currentTrack.startFinishLine}
            fuelCanisters={fuelCanisters}
            finishLockedWarning={finishLockedWarning}
            onToggleCamera={cycleCamera}
            onToggleMute={toggleMute}
            onRestart={handleRestart}
            onPause={handlePause}
          />
          <TouchControls onInputChange={handleTouchInput} />
        </>
      )}

      {/* Start / Garage Menu */}
      {gameState === 'menu' && (
        <StartMenu
          selectedTrack={currentTrack}
          selectedVehicle={currentVehicle}
          onSelectTrack={handleSelectTrack}
          onSelectVehicle={handleSelectVehicle}
          onSelectColor={handleSelectColor}
          onStartRace={handleStartRace}
        />
      )}

      {/* Pause Menu */}
      {gameState === 'paused' && (
        <PauseModal
          track={currentTrack}
          isMuted={isMuted}
          onResume={handleResume}
          onRestart={handleRestart}
          onReturnToMenu={handleReturnToMenu}
          onToggleMute={toggleMute}
        />
      )}

      {/* Game Over / Stage Cleared Modal */}
      {(gameState === 'out_of_fuel' || gameState === 'finished') && (
        <GameOverModal
          type={gameState}
          track={currentTrack}
          vehicle={currentVehicle}
          timeTaken={raceTimer}
          remainingFuel={telemetry.fuel}
          topSpeed={topSpeedAchieved}
          checkpointsCompleted={checkpoints.filter((c) => c.collected).length}
          totalCheckpoints={currentTrack.checkpoints.length}
          onRetry={handleRestart}
          onNextTrack={handleNextTrack}
          onReturnToMenu={handleReturnToMenu}
        />
      )}
    </div>
  );
}
