import { VehicleConfig } from '../types/game';

export const VEHICLES: VehicleConfig[] = [
  {
    id: 'apex_gt',
    name: 'Apex GT-R',
    category: 'Sports Coupe',
    description: 'Precision engineered twin-turbo sports coupe with responsive rack-and-pinion steering and balanced fuel economy.',
    topSpeed: 210, // km/h
    acceleration: 85,
    handling: 88,
    fuelEfficiency: 75,
    fuelTankCapacity: 45,
    color: '#06b6d4', // Electric Cyan
    accentColor: '#0f172a',
    mass: 1450,
    maxEngineTorque: 540,
    brakeForce: 850,
  },
  {
    id: 'phantom_v12',
    name: 'Phantom V12',
    category: 'Hypercar',
    description: 'V12 naturally aspirated supercar with tremendous straight-line velocity, high downforce, and ravenous fuel consumption.',
    topSpeed: 250, // km/h
    acceleration: 96,
    handling: 90,
    fuelEfficiency: 52,
    fuelTankCapacity: 50,
    color: '#ef4444', // Crimson Red
    accentColor: '#171717',
    mass: 1380,
    maxEngineTorque: 720,
    brakeForce: 1050,
  },
  {
    id: 'baja_rover',
    name: 'Dune Striker 4x4',
    category: 'All-Terrain Raid',
    description: 'Heavy off-road suspension, deep-tread all-terrain tires, high fuel reserves, and rugged durability over rough cut corners.',
    topSpeed: 180, // km/h
    acceleration: 78,
    handling: 76,
    fuelEfficiency: 82,
    fuelTankCapacity: 55,
    color: '#f59e0b', // Amber Ochre
    accentColor: '#262626',
    mass: 1820,
    maxEngineTorque: 620,
    brakeForce: 900,
  },
];
