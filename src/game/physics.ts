import * as THREE from 'three';
import { PlayerInput, RoadBranch, VehicleConfig, VehicleTelemetry } from '../types/game';

export class VehiclePhysics {
  public position: THREE.Vector3;
  public velocity: THREE.Vector3;
  public forward: THREE.Vector3;
  public right: THREE.Vector3;
  public up: THREE.Vector3;

  public yaw: number = 0; // heading angle in radians
  public yawRate: number = 0; // angular velocity

  public speedKmh: number = 0;
  public rpm: number = 800;
  public gear: number | 'R' | 'N' = 1;

  public fuel: number = 40;
  public maxFuel: number = 40;
  public fuelRate: number = 0; // L/s

  public isDrifting: boolean = false;
  public driftAngle: number = 0;
  public driftIntensity: number = 0;
  public isOffroad: boolean = false;

  public longitudinalG: number = 0;
  public lateralG: number = 0;

  private config: VehicleConfig;
  private prevSpeed: number = 0;

  // Gear ratios for 5-speed sports transmission
  private readonly gearRatios = [3.4, 2.1, 1.45, 1.05, 0.82];
  private readonly reverseRatio = -3.2;

  constructor(config: VehicleConfig, initialFuel: number, startPos: [number, number, number] = [0, 0, 0], startYaw: number = 0) {
    this.config = config;
    this.fuel = Math.min(initialFuel, config.fuelTankCapacity);
    this.maxFuel = config.fuelTankCapacity;

    this.position = new THREE.Vector3(startPos[0], startPos[1], startPos[2]);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.forward = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(1, 0, 0);
    this.up = new THREE.Vector3(0, 1, 0);
    this.yaw = startYaw;
    this.updateOrientationVectors();
  }

  public reset(startPos: [number, number, number] = [0, 0, 0], startYaw: number = 0, initialFuel?: number) {
    this.position.set(startPos[0], startPos[1], startPos[2]);
    this.velocity.set(0, 0, 0);
    this.yaw = startYaw;
    this.yawRate = 0;
    this.speedKmh = 0;
    this.rpm = 800;
    this.gear = 1;
    this.longitudinalG = 0;
    this.lateralG = 0;
    this.isDrifting = false;
    this.driftIntensity = 0;
    if (initialFuel !== undefined) {
      this.fuel = Math.min(initialFuel, this.config.fuelTankCapacity);
    }
    this.updateOrientationVectors();
  }

  public setConfig(newConfig: VehicleConfig) {
    this.config = newConfig;
    this.maxFuel = newConfig.fuelTankCapacity;
    this.fuel = Math.min(this.fuel, this.maxFuel);
  }

  public addFuel(liters: number) {
    this.fuel = Math.min(this.fuel + liters, this.maxFuel);
  }

  private updateOrientationVectors() {
    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }

  public update(
    dt: number,
    input: PlayerInput,
    trackWaypoints?: [number, number, number][],
    roadBranches?: RoadBranch[]
  ): VehicleTelemetry {
    // Clamp delta time to avoid physics explosion on lag spikes
    const delta = Math.min(dt, 0.05);

    this.updateOrientationVectors();

    // Check if off-road by comparing distance to all road branches or waypoints
    if (roadBranches && roadBranches.length > 0) {
      this.isOffroad = this.checkIfOffroadBranches(roadBranches);
    } else if (trackWaypoints && trackWaypoints.length > 1) {
      this.isOffroad = this.checkIfOffroad(trackWaypoints, 12.0);
    } else {
      this.isOffroad = false;
    }

    // Fuel consumption calculations
    const isOutOfFuel = this.fuel <= 0;
    if (!isOutOfFuel) {
      // Base idle fuel burn: ~0.02 L/s
      // Active throttle burn scales with RPM and vehicle efficiency rating
      const efficiencyMult = 100 / this.config.fuelEfficiency; // Higher efficiency = lower mult
      const throttleBurn = input.throttle * (this.rpm / 6000) * 0.16 * efficiencyMult;
      const totalBurnRate = (0.02 + throttleBurn) * (this.isOffroad ? 1.3 : 1.0);

      this.fuelRate = totalBurnRate;
      this.fuel = Math.max(0, this.fuel - totalBurnRate * delta);
    } else {
      this.fuel = 0;
      this.fuelRate = 0;
    }

    // Current velocity in vehicle local coordinates
    const forwardSpeed = this.velocity.dot(this.forward);
    const lateralSpeed = this.velocity.dot(this.right);
    const totalSpeed = this.velocity.length();
    this.speedKmh = totalSpeed * 3.6;

    // Determine Gear and Engine RPM
    this.updateGearsAndRpm(forwardSpeed, input.throttle, isOutOfFuel);

    // Forces calculation
    let driveForce = 0;
    let brakeForce = 0;

    const effectiveThrottle = isOutOfFuel ? 0 : input.throttle;

    if (input.reverse && forwardSpeed < 2.0) {
      // Reverse mode
      this.gear = 'R';
      driveForce = -this.config.maxEngineTorque * 0.5 * (input.brake > 0 ? input.brake : (effectiveThrottle > 0 ? effectiveThrottle : 0.6));
    } else {
      if (effectiveThrottle > 0) {
        // Torque output modulated by RPM torque curve peak at 4500 RPM
        const rpmNorm = Math.min(Math.max((this.rpm - 1000) / 6000, 0), 1);
        const torqueMultiplier = Math.sin(rpmNorm * Math.PI * 0.8 + 0.3);
        const gearRatio = typeof this.gear === 'number' ? this.gearRatios[this.gear - 1] : 1.0;

        driveForce = effectiveThrottle * this.config.maxEngineTorque * gearRatio * torqueMultiplier * 1.8;

        // Top speed governor
        const maxSpeedMs = this.config.topSpeed / 3.6;
        if (forwardSpeed > maxSpeedMs) {
          driveForce *= Math.max(0, 1 - (forwardSpeed - maxSpeedMs) / 5);
        }
      }

      if (input.brake > 0) {
        brakeForce = input.brake * this.config.brakeForce * (forwardSpeed > 0 ? 1 : 0);
      }
    }

    // Aerodynamic Drag & Rolling Resistance
    const airDensity = 1.225;
    const cd = 0.32; // Sports car drag coefficient
    const frontalArea = 2.1; // m^2
    const aeroDrag = 0.5 * cd * frontalArea * airDensity * totalSpeed * totalSpeed;

    const baseRollingCoeff = this.isOffroad ? 0.08 : 0.015;
    const rollingResistance = baseRollingCoeff * this.config.mass * 9.81;

    // Handbrake effect
    const handbrakeBraking = input.handbrake ? this.config.brakeForce * 0.9 : 0;
    const totalBraking = brakeForce + handbrakeBraking;

    // Net longitudinal force
    const longitudinalForce = driveForce - Math.sign(forwardSpeed) * (totalBraking + aeroDrag + rollingResistance);
    const longitudinalAccel = longitudinalForce / this.config.mass;

    // Steering & Lateral Grip Dynamics
    const maxSteerAngle = THREE.MathUtils.degToRad(32);
    // Steering sensitivity reduces at high speeds for realistic stability
    const steerSpeedFactor = Math.max(0.28, 1 - (this.speedKmh / 220) * 0.6);
    const effectiveSteerAngle = input.steer * maxSteerAngle * steerSpeedFactor;

    // Lateral grip friction
    const tireGripBase = this.isOffroad ? 0.55 : 1.0;
    const driftModifier = input.handbrake ? 0.25 : 0.85;
    const maxLateralGrip = this.config.mass * 9.81 * tireGripBase * (this.config.handling / 100) * driftModifier;

    // Lateral slip angle
    const slipAngle = Math.atan2(lateralSpeed, Math.max(Math.abs(forwardSpeed), 1.0));
    const lateralFrictionForce = -Math.sign(lateralSpeed) * Math.min(Math.abs(slipAngle) * maxLateralGrip * 2.5, maxLateralGrip);

    // Drifting state detection
    const isDriftSpeed = this.speedKmh > 25;
    const hasLateralSlip = Math.abs(lateralSpeed) > 3.2;
    this.isDrifting = (input.handbrake || hasLateralSlip) && isDriftSpeed;
    this.driftIntensity = this.isDrifting ? Math.min(Math.abs(lateralSpeed) / 10, 1.0) : 0;
    this.driftAngle = Math.atan2(lateralSpeed, forwardSpeed);

    // Yaw dynamics (turning the vehicle)
    const turnRadiusRate = (forwardSpeed / 2.8) * Math.tan(effectiveSteerAngle);
    const oversteerMoment = this.isDrifting ? -Math.sign(lateralSpeed) * this.driftIntensity * 1.8 : 0;
    const targetYawRate = turnRadiusRate + oversteerMoment;

    // Smooth yaw rate response
    this.yawRate = THREE.MathUtils.lerp(this.yawRate, targetYawRate, delta * 12);
    this.yaw += this.yawRate * delta;

    // Update orientation vectors
    this.updateOrientationVectors();

    // Integrate Acceleration into Velocity
    const newForwardSpeed = forwardSpeed + longitudinalAccel * delta;
    const newLateralSpeed = (lateralSpeed + (lateralFrictionForce / this.config.mass) * delta) * (this.isDrifting ? 0.98 : 0.88);

    // Reconstruct velocity in world coordinates
    this.velocity.copy(this.forward).multiplyScalar(newForwardSpeed).addScaledVector(this.right, newLateralSpeed);

    // Stop complete jitter when car is nearly stopped
    if (this.velocity.length() < 0.1 && effectiveThrottle === 0 && !input.reverse) {
      this.velocity.set(0, 0, 0);
    }

    // Update Position
    this.position.addScaledVector(this.velocity, delta);

    // Keep car grounded on Y=0 plane
    this.position.y = 0;

    // G-Forces calculation for suspension pitch and roll
    const accelG = (totalSpeed - this.prevSpeed) / delta / 9.81;
    this.longitudinalG = THREE.MathUtils.clamp(accelG, -1.5, 1.5);
    this.lateralG = THREE.MathUtils.clamp((forwardSpeed * this.yawRate) / 9.81, -1.8, 1.8);
    this.prevSpeed = totalSpeed;

    return {
      speedKmh: this.speedKmh,
      rpm: this.rpm,
      gear: this.gear,
      fuel: this.fuel,
      maxFuel: this.maxFuel,
      fuelRate: this.fuelRate,
      isDrifting: this.isDrifting,
      driftAngle: this.driftAngle,
      isOffroad: this.isOffroad,
      gForce: Math.sqrt(this.longitudinalG * this.longitudinalG + this.lateralG * this.lateralG),
    };
  }

  private updateGearsAndRpm(forwardSpeed: number, throttle: number, isOutOfFuel: boolean) {
    if (isOutOfFuel) {
      this.rpm = Math.max(400, this.rpm - 15);
      return;
    }

    const speedKmh = Math.abs(forwardSpeed) * 3.6;

    // Automatic transmission shift thresholds
    const upshiftSpeeds = [35, 70, 115, 165, 230];
    const downshiftSpeeds = [0, 25, 55, 95, 145];

    let currentGear = 1;
    for (let g = 0; g < upshiftSpeeds.length; g++) {
      if (speedKmh > upshiftSpeeds[g]) {
        currentGear = g + 2;
      }
    }
    currentGear = Math.min(Math.max(currentGear, 1), 5);
    this.gear = currentGear;

    // RPM based on current gear and vehicle speed
    const minRpm = 800; // Idle RPM
    const maxRpm = 7800; // Redline
    const gearBaseSpeed = downshiftSpeeds[currentGear - 1] || 0;
    const gearTopSpeed = upshiftSpeeds[currentGear - 1] || 240;

    const gearProgress = Math.min(Math.max((speedKmh - gearBaseSpeed) / (gearTopSpeed - gearBaseSpeed), 0), 1);
    const targetRpm = minRpm + gearProgress * (maxRpm - minRpm) + throttle * 600;

    this.rpm = THREE.MathUtils.lerp(this.rpm, Math.min(targetRpm, maxRpm), 0.18);
  }

  private checkIfOffroadBranches(branches: RoadBranch[]): boolean {
    const px = this.position.x;
    const pz = this.position.z;

    for (let b = 0; b < branches.length; b++) {
      const branch = branches[b];
      const pts = branch.points;
      const roadHalfWidth = (branch.width || 12) / 2 + 2.5; // generous margin before penalty
      const limitSq = roadHalfWidth * roadHalfWidth;

      const count = branch.isClosedLoop ? pts.length : pts.length - 1;
      for (let i = 0; i < count; i++) {
        const p1 = pts[i];
        const p2 = pts[(i + 1) % pts.length];
        const distSq = this.distToSegmentSq(px, pz, p1[0], p1[2], p2[0], p2[2]);
        if (distSq <= limitSq) {
          return false; // Car is safely on this road branch!
        }
      }
    }

    return true; // Not on any branch -> offroad!
  }

  private checkIfOffroad(waypoints: [number, number, number][], roadWidth: number): boolean {
    const px = this.position.x;
    const pz = this.position.z;
    let minDistanceSq = Infinity;

    // Find distance to closest road segment
    for (let i = 0; i < waypoints.length; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[(i + 1) % waypoints.length];

      const distSq = this.distToSegmentSq(px, pz, p1[0], p1[2], p2[0], p2[2]);
      if (distSq < minDistanceSq) {
        minDistanceSq = distSq;
      }
    }

    return Math.sqrt(minDistanceSq) > roadWidth;
  }

  private distToSegmentSq(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;
    if (lenSq === 0) return (px - x1) * (px - x1) + (pz - z1) * (pz - z1);

    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / lenSq));
    const projX = x1 + t * dx;
    const projZ = z1 + t * dz;
    return (px - projX) * (px - projX) + (pz - projZ) * (pz - projZ);
  }
}
