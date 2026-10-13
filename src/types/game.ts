export type GameState = 'menu' | 'countdown' | 'racing' | 'paused' | 'out_of_fuel' | 'finished';

export type CameraView = 'chase_close' | 'chase_far' | 'hood' | 'top_down';

export interface VehicleConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  topSpeed: number; // km/h
  acceleration: number; // 0-100 rating
  handling: number; // rating
  fuelEfficiency: number; // rating (higher = less fuel consumption)
  fuelTankCapacity: number; // liters
  color: string;
  accentColor: string;
  mass: number; // kg
  maxEngineTorque: number;
  brakeForce: number;
}

export interface CheckpointData {
  id: number;
  position: [number, number, number];
  rotationY: number;
  width: number;
  fuelBonus: number; // Fuel restored on pass (liters)
  collected?: boolean;
}

export interface FuelCanisterData {
  id: number;
  position: [number, number, number];
  amount: number; // liters
  collected: boolean;
}

export interface RoadBranch {
  id: string;
  name?: string;
  points: [number, number, number][];
  isClosedLoop?: boolean;
  width?: number;
  type?: 'highway' | 'shortcut' | 'avenue' | 'bridge';
}

export interface StartFinishLineData {
  position: [number, number, number];
  rotationY: number;
  width: number;
}

export interface TrackConfig {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Expert';
  environment: 'coastal' | 'neon_city' | 'desert_canyon';
  skyColor: string;
  fogColor: string;
  groundColor: string;
  roadColor: string;
  lapsRequired: number;
  initialFuel: number; // starting liters
  waypoints: [number, number, number][];
  roadBranches: RoadBranch[];
  startFinishLine: StartFinishLineData;
  checkpoints: CheckpointData[];
  fuelCanisters: FuelCanisterData[];
  barriers: { start: [number, number, number]; end: [number, number, number] }[];
  sceneryElements: {
    type: 'tree' | 'building' | 'streetlight' | 'rock' | 'canyon_wall';
    position: [number, number, number];
    scale?: [number, number, number];
    rotationY?: number;
    color?: string;
  }[];
}

export interface PlayerInput {
  throttle: number; // 0 to 1
  brake: number; // 0 to 1
  steer: number; // -1 to 1
  handbrake: boolean;
  reverse: boolean;
}

export interface VehicleTelemetry {
  speedKmh: number;
  rpm: number;
  gear: number | 'R' | 'N';
  fuel: number;
  maxFuel: number;
  fuelRate: number; // L/s
  isDrifting: boolean;
  driftAngle: number;
  isOffroad: boolean;
  gForce: number;
}
