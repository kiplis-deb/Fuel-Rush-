import * as THREE from 'three';
import { CameraView, GameState, PlayerInput, RoadBranch, TrackConfig, VehicleConfig, VehicleTelemetry } from '../types/game';
import { soundEngine } from '../utils/audio';
import { CarModel } from './CarModel';
import { EffectsManager } from './EffectsManager';
import { VehiclePhysics } from './physics';
import { TRACKS } from './trackData';
import { VEHICLES } from './vehicleConfigs';
import { WorldBuilder, WorldObjects } from './WorldBuilder';

export interface GameEngineCallbacks {
  onTelemetryUpdate: (telemetry: VehicleTelemetry) => void;
  onCheckpointPass: (collectedCount: number, totalCheckpoints: number, fuelAwarded: number) => void;
  onFuelCollected: (amount: number) => void;
  onFinishLocked: (remainingCount: number) => void;
  onLapComplete: (lapTime: number, totalLaps: number) => void;
  onRaceFinish: (totalTime: number, remainingFuel: number, topSpeed: number) => void;
  onOutOfFuel: () => void;
  onStateChange: (state: GameState) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private callbacks: GameEngineCallbacks;

  // Components
  public physics: VehiclePhysics;
  private carModel: CarModel;
  private worldObjects: WorldObjects | null = null;
  private effects: EffectsManager;

  // Active configurations
  private currentTrack: TrackConfig;
  private currentVehicle: VehicleConfig;
  private cameraMode: CameraView = 'chase_close';
  private gameState: GameState = 'menu';

  // Game Progress
  public activeCheckpointIndex: number = 0;
  private raceStartTime: number = 0;
  private raceTimer: number = 0;
  private topSpeedAchieved: number = 0;
  private lastTime: number = 0;
  private lastLockedWarningTime: number = 0;
  private animationFrameId: number | null = null;
  private isDestroyed: boolean = false;

  // Camera damping
  private cameraCurrentPos = new THREE.Vector3();
  private cameraTargetPos = new THREE.Vector3();

  // Inputs
  private input: PlayerInput = {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    reverse: false,
  };

  constructor(container: HTMLElement, callbacks: GameEngineCallbacks, initialTrackId = 'delta_fork_city', initialVehicleId = 'apex_gt') {
    this.container = container;
    this.callbacks = callbacks;

    this.currentTrack = TRACKS.find((t) => t.id === initialTrackId) || TRACKS[0];
    this.currentVehicle = VEHICLES.find((v) => v.id === initialVehicleId) || VEHICLES[0];

    // Setup Three.js Scene
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(65, container.clientWidth / container.clientHeight, 0.2, 1000);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);

    // Initialize Effects
    this.effects = new EffectsManager(this.scene);

    // Initialize Vehicle Physics & Model
    this.physics = new VehiclePhysics(this.currentVehicle, this.currentTrack.initialFuel, [0, 0, 0], 0);
    this.carModel = new CarModel(this.currentVehicle);
    this.scene.add(this.carModel.root);

    // Initialize Track World
    this.loadTrack(this.currentTrack);

    // Window Resize Handler
    window.addEventListener('resize', this.onWindowResize);

    // Start Render Loop
    this.lastTime = performance.now();
    this.animate(this.lastTime);
  }

  public setInput(input: Partial<PlayerInput>) {
    this.input = { ...this.input, ...input };
  }

  public setCameraMode(mode: CameraView) {
    this.cameraMode = mode;
    this.camera.up.set(0, 1, 0);
    this.snapCameraToMode(mode);
  }

  private snapCameraToMode(mode: CameraView) {
    const carPos = this.physics.position;
    const forward = this.physics.forward;

    this.camera.up.set(0, 1, 0);

    if (mode === 'chase_close') {
      const targetPos = carPos.clone().addScaledVector(forward, -6.8);
      targetPos.y = Math.max(1.8, carPos.y + 2.8);
      const lookTarget = carPos.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(forward, 3.5);

      this.cameraCurrentPos.copy(targetPos);
      this.cameraTargetPos.copy(lookTarget);
      this.camera.position.copy(targetPos);
      this.camera.lookAt(lookTarget);
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
    } else if (mode === 'chase_far') {
      const targetPos = carPos.clone().addScaledVector(forward, -11.0);
      targetPos.y = carPos.y + 5.2;
      const lookTarget = carPos.clone().add(new THREE.Vector3(0, 1.0, 0));

      this.cameraCurrentPos.copy(targetPos);
      this.cameraTargetPos.copy(lookTarget);
      this.camera.position.copy(targetPos);
      this.camera.lookAt(lookTarget);
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
    } else if (mode === 'hood') {
      const hoodPos = carPos.clone().add(new THREE.Vector3(0, 0.95, 0)).addScaledVector(forward, 0.8);
      const lookTarget = hoodPos.clone().addScaledVector(forward, 25);

      this.cameraCurrentPos.copy(hoodPos);
      this.cameraTargetPos.copy(lookTarget);
      this.camera.position.copy(hoodPos);
      this.camera.lookAt(lookTarget);
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();
    } else if (mode === 'top_down') {
      const topPos = carPos.clone().addScaledVector(forward, -3.5);
      topPos.y = 36;
      const lookTarget = carPos.clone();

      this.cameraCurrentPos.copy(topPos);
      this.cameraTargetPos.copy(lookTarget);
      this.camera.position.copy(topPos);
      this.camera.lookAt(lookTarget);
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
    }
  }

  public getCameraMode(): CameraView {
    return this.cameraMode;
  }

  public setVehicle(vehicleId: string) {
    const v = VEHICLES.find((item) => item.id === vehicleId);
    if (!v) return;
    this.currentVehicle = v;
    this.physics.setConfig(v);

    this.scene.remove(this.carModel.root);
    this.carModel = new CarModel(v);
    this.scene.add(this.carModel.root);
  }

  public setVehicleColor(hex: string) {
    this.currentVehicle.color = hex;
    this.carModel.updatePaintColor(hex);
  }

  public setTrack(trackId: string) {
    const t = TRACKS.find((item) => item.id === trackId);
    if (!t) return;
    this.currentTrack = t;
    this.loadTrack(t);
    this.resetRace();
  }

  private loadTrack(track: TrackConfig) {
    if (this.worldObjects) {
      this.worldObjects.dispose();
      // Remove all meshes from scene except vehicle and effects
      const toRemove: THREE.Object3D[] = [];
      this.scene.children.forEach((child) => {
        if (child !== this.carModel.root) {
          toRemove.push(child);
        }
      });
      toRemove.forEach((obj) => this.scene.remove(obj));
    }

    // Reset Fuel Canisters status
    track.fuelCanisters.forEach((fc) => (fc.collected = false));

    // Rebuild world
    this.worldObjects = WorldBuilder.buildWorld(this.scene, track);
  }

  public startRace() {
    soundEngine.init();
    soundEngine.resume();
    this.resetRace();
    this.gameState = 'racing';
    this.callbacks.onStateChange(this.gameState);
    this.raceStartTime = performance.now();
  }

  public pauseRace() {
    if (this.gameState === 'racing') {
      this.gameState = 'paused';
      soundEngine.pause();
      this.callbacks.onStateChange(this.gameState);
    }
  }

  public resumeRace() {
    if (this.gameState === 'paused') {
      this.gameState = 'racing';
      soundEngine.resume();
      this.callbacks.onStateChange(this.gameState);
    }
  }

  public resetRace() {
    soundEngine.stopEngineSound();
    this.activeCheckpointIndex = 0;
    this.raceTimer = 0;
    this.topSpeedAchieved = 0;
    this.lastLockedWarningTime = 0;

    // Reset Checkpoints status
    this.currentTrack.checkpoints.forEach((cp) => (cp.collected = false));

    // Reset Canisters status
    this.currentTrack.fuelCanisters.forEach((fc) => (fc.collected = false));

    // Reset physics to start line (Start awal sebagai finish line)
    const sf = this.currentTrack.startFinishLine || {
      position: this.currentTrack.waypoints[0] || [0, 0, 0],
      rotationY: 0,
      width: 22,
    };
    const startPoint = sf.position;
    const startYaw = sf.rotationY;

    this.physics.reset(startPoint, startYaw, this.currentTrack.initialFuel);
    this.effects.clear();

    // Camera initial snap
    const camOffset = new THREE.Vector3(0, 3.5, -7).applyAxisAngle(new THREE.Vector3(0, 1, 0), startYaw);
    this.cameraCurrentPos.copy(this.physics.position).add(camOffset);
    this.cameraTargetPos.copy(this.physics.position).add(new THREE.Vector3(0, 1.2, 0));
    this.camera.position.copy(this.cameraCurrentPos);
    this.camera.lookAt(this.cameraTargetPos);
  }

  public getTargetCheckpointInfo(): {
    targetId: number;
    targetPos: [number, number, number];
    isFinish: boolean;
    remaining: number;
    total: number;
  } {
    const checkpoints = this.currentTrack.checkpoints;
    const uncollected = checkpoints.filter((c) => !c.collected);

    if (uncollected.length === 0) {
      // All checkpoints collected! Target is Start / Finish Line!
      const sf = this.currentTrack.startFinishLine;
      return {
        targetId: -1,
        targetPos: sf.position,
        isFinish: true,
        remaining: 0,
        total: checkpoints.length,
      };
    }

    // Find closest uncollected checkpoint to vehicle
    const carPos = this.physics.position;
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

    return {
      targetId: closest.id,
      targetPos: closest.position,
      isFinish: false,
      remaining: uncollected.length,
      total: checkpoints.length,
    };
  }

  private onWindowResize = () => {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = (now: number) => {
    if (this.isDestroyed) return;
    this.animationFrameId = requestAnimationFrame(this.animate);

    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.gameState === 'racing') {
      this.raceTimer += dt;
      this.updateRaceStep(dt, now);
    } else if (this.gameState === 'menu' || this.gameState === 'countdown') {
      // Idle slow camera pan in menu
      const radius = 9;
      const angle = now * 0.0004;
      this.camera.position.set(
        this.physics.position.x + Math.sin(angle) * radius,
        3.2,
        this.physics.position.z + Math.cos(angle) * radius
      );
      this.camera.lookAt(this.physics.position.x, 1.2, this.physics.position.z);
    }

    // World animation (beacons, fuel canisters, start/finish line)
    const targetInfo = this.getTargetCheckpointInfo();
    this.worldObjects?.update(now * 0.001, targetInfo.targetId, targetInfo.isFinish);

    // Particle update
    this.effects.update(dt);

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  };

  private updateRaceStep(dt: number, now: number) {
    // 1. Physics Step
    const telemetry = this.physics.update(
      dt,
      this.input,
      this.currentTrack.waypoints,
      this.currentTrack.roadBranches
    );
    this.topSpeedAchieved = Math.max(this.topSpeedAchieved, telemetry.speedKmh);

    // 2. Update 3D Car Model Position & Orientation
    this.carModel.root.position.copy(this.physics.position);
    this.carModel.root.rotation.y = this.physics.yaw;

    // Wheel rotations & steering angle
    const distanceDelta = this.physics.velocity.length() * dt;
    this.carModel.updateWheelAnimation(this.input.steer * THREE.MathUtils.degToRad(30), distanceDelta);

    // Suspension dynamics (lean into turns, squat/dive)
    this.carModel.updateChassisDynamics(this.physics.lateralG, this.physics.longitudinalG);

    // Brake lights
    this.carModel.updateBrakes(this.input.brake > 0.1 || this.input.handbrake);

    // 3. Audio synthesis update
    const isOutOfFuel = telemetry.fuel <= 0;
    soundEngine.updateVehicleSound(telemetry.rpm, this.input.throttle, this.physics.driftIntensity, isOutOfFuel);

    // Low fuel warning alarm
    if (telemetry.fuel > 0 && telemetry.fuel <= this.currentVehicle.fuelTankCapacity * 0.18) {
      soundEngine.playLowFuelWarning();
    }

    // 4. Effects (Tire smoke on drift)
    if (telemetry.isDrifting && telemetry.speedKmh > 20) {
      const rearLeftPos = this.carModel.wheels.rearLeft.getWorldPosition(new THREE.Vector3());
      const rearRightPos = this.carModel.wheels.rearRight.getWorldPosition(new THREE.Vector3());
      this.effects.emitTireSmoke(rearLeftPos, this.physics.driftIntensity);
      this.effects.emitTireSmoke(rearRightPos, this.physics.driftIntensity);
    }

    // 5. Checkpoint Crossing Detection
    this.checkCheckpointCrossing();

    // 6. Fuel Refill Canister Pickup Detection
    this.checkFuelPickups();

    // 7. Check Out of Fuel Condition
    if (isOutOfFuel && telemetry.speedKmh < 0.6) {
      this.gameState = 'out_of_fuel';
      soundEngine.stopEngineSound();
      this.callbacks.onStateChange(this.gameState);
      this.callbacks.onOutOfFuel();
    }

    // 8. Dynamic Camera Follow
    this.updateCamera(dt, telemetry.speedKmh);

    // 9. Send Telemetry to React HUD
    this.callbacks.onTelemetryUpdate(telemetry);
  }

  private checkCheckpointCrossing() {
    const checkpoints = this.currentTrack.checkpoints;
    const carPos = this.physics.position;

    // 1. Check crossing for any uncollected checkpoint
    checkpoints.forEach((cp) => {
      if (cp.collected) return;
      const cpPos = new THREE.Vector3(cp.position[0], cp.position[1], cp.position[2]);
      const distance = carPos.distanceTo(cpPos);

      // Generous hit radius so vehicles never miss the gate
      const hitRadius = Math.max(cp.width * 0.75, 14);
      if (distance < hitRadius) {
        cp.collected = true;
        this.physics.addFuel(cp.fuelBonus);
        soundEngine.playCheckpointSound();

        // Emerald sparkles burst at the checkpoint gate
        this.effects.emitSparkles(cpPos.clone().add(new THREE.Vector3(0, 3, 0)), 0x10b981, 40);

        const collectedCount = checkpoints.filter((c) => c.collected).length;
        this.activeCheckpointIndex = collectedCount;
        this.callbacks.onCheckpointPass(collectedCount, checkpoints.length, cp.fuelBonus);
      }
    });

    // 2. Check Start / Finish Line Crossing (Start awal sebagai finish line)
    const sf = this.currentTrack.startFinishLine;
    if (sf) {
      const sfPos = new THREE.Vector3(sf.position[0], sf.position[1], sf.position[2]);
      const distanceToFinish = carPos.distanceTo(sfPos);
      const finishHitRadius = Math.max(sf.width * 0.75, 16);

      // Only check finish line after car has moved away from start grid (raceTimer > 3 seconds)
      if (distanceToFinish < finishHitRadius && this.raceTimer > 3) {
        const uncollected = checkpoints.filter((c) => !c.collected).length;

        if (uncollected === 0) {
          // ALL CHECKPOINTS COLLECTED! COMPLETE RACE!
          this.gameState = 'finished';
          soundEngine.stopEngineSound();
          soundEngine.playVictoryFanfare();
          this.effects.emitSparkles(sfPos.clone().add(new THREE.Vector3(0, 5, 0)), 0xf59e0b, 60);
          this.callbacks.onStateChange(this.gameState);
          this.callbacks.onRaceFinish(this.raceTimer, this.physics.fuel, this.topSpeedAchieved);
        } else {
          // NOT ALL CHECKPOINTS COLLECTED -> FINISH LINE DOES NOT WORK!
          const now = performance.now();
          if (now - this.lastLockedWarningTime > 2500) {
            this.lastLockedWarningTime = now;
            this.callbacks.onFinishLocked(uncollected);
          }
        }
      }
    }
  }

  private checkFuelPickups() {
    const canisters = this.currentTrack.fuelCanisters;
    const carPos = this.physics.position;

    canisters.forEach((fc) => {
      if (fc.collected) return;
      const canPos = new THREE.Vector3(fc.position[0], fc.position[1], fc.position[2]);
      if (carPos.distanceTo(canPos) < 2.8) {
        // Collect fuel
        fc.collected = true;
        this.physics.addFuel(fc.amount);
        soundEngine.playFuelPickupSound();
        this.effects.emitSparkles(canPos.clone().add(new THREE.Vector3(0, 1, 0)), 0xf59e0b, 30);
        this.callbacks.onFuelCollected(fc.amount);
      }
    });
  }

  private updateCamera(dt: number, speedKmh: number) {
    const carPos = this.physics.position;
    const forward = this.physics.forward;

    // Strict upright world axis - prevents camera tilting or rolling
    this.camera.up.set(0, 1, 0);

    if (this.cameraMode === 'chase_close') {
      // Dynamic chase camera: sits behind, rises with speed, FOV widens
      const baseDistance = 6.8 + (speedKmh / 220) * 1.5;
      const baseHeight = 2.8;

      const targetCamPos = carPos.clone().addScaledVector(forward, -baseDistance);
      targetCamPos.y = Math.max(1.8, carPos.y + baseHeight);

      const lookTarget = carPos.clone().add(new THREE.Vector3(0, 1.2, 0)).addScaledVector(forward, 3.5);

      // Smooth damping
      this.cameraCurrentPos.lerp(targetCamPos, dt * 10);
      this.cameraTargetPos.lerp(lookTarget, dt * 12);

      this.camera.position.copy(this.cameraCurrentPos);
      this.camera.lookAt(this.cameraTargetPos);

      // Dynamic FOV widening for speed sensation
      const targetFov = 62 + (speedKmh / 220) * 12;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 4);
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'chase_far') {
      const baseDistance = 11.0;
      const baseHeight = 5.2;

      const targetCamPos = carPos.clone().addScaledVector(forward, -baseDistance);
      targetCamPos.y = carPos.y + baseHeight;

      const lookTarget = carPos.clone().add(new THREE.Vector3(0, 1.0, 0));

      this.cameraCurrentPos.lerp(targetCamPos, dt * 8);
      this.cameraTargetPos.lerp(lookTarget, dt * 10);

      this.camera.position.copy(this.cameraCurrentPos);
      this.camera.lookAt(this.cameraTargetPos);
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'hood') {
      // Cockpit / Hood POV: fixed to front hood, looking forward
      const hoodPos = carPos.clone().add(new THREE.Vector3(0, 0.95, 0)).addScaledVector(forward, 0.8);
      const lookTarget = hoodPos.clone().addScaledVector(forward, 25);

      this.camera.position.copy(hoodPos);
      this.camera.lookAt(lookTarget);
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();
    } else if (this.cameraMode === 'top_down') {
      // High-angle tactical overhead view: sits behind & high above, perfectly level and upright
      const topPos = carPos.clone().addScaledVector(forward, -3.5);
      topPos.y = 36;
      const lookTarget = carPos.clone();

      this.cameraCurrentPos.lerp(topPos, dt * 8);
      this.cameraTargetPos.lerp(lookTarget, dt * 10);

      this.camera.position.copy(this.cameraCurrentPos);
      this.camera.lookAt(this.cameraTargetPos);
      this.camera.fov = 65;
      this.camera.updateProjectionMatrix();
    }
  }

  public getTrackWaypoints() {
    return this.currentTrack.waypoints;
  }

  public getRoadBranches(): RoadBranch[] {
    return this.currentTrack.roadBranches || [];
  }

  public getCurrentTrack(): TrackConfig {
    return this.currentTrack;
  }

  public getCurrentVehicle(): VehicleConfig {
    return this.currentVehicle;
  }

  public getCheckpoints(): { id: number; position: [number, number, number]; collected: boolean }[] {
    return this.currentTrack.checkpoints.map((cp) => ({
      id: cp.id,
      position: cp.position,
      collected: !!cp.collected,
    }));
  }

  public getStartFinishLine(): { position: [number, number, number]; width: number } {
    return this.currentTrack.startFinishLine || {
      position: this.currentTrack.waypoints[0] || [0, 0, 0],
      width: 22,
    };
  }

  public getFuelCanisters(): { id: number; position: [number, number, number]; collected: boolean }[] {
    return this.currentTrack.fuelCanisters.map((fc) => ({ id: fc.id, position: fc.position, collected: fc.collected }));
  }

  public getCarWorldPosition(): THREE.Vector3 {
    return this.physics.position;
  }

  public getCarHeading(): number {
    return this.physics.yaw;
  }

  public destroy() {
    this.isDestroyed = true;
    soundEngine.stopEngineSound();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    this.worldObjects?.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
