import * as THREE from 'three';
import { VehicleConfig } from '../types/game';

export interface CarWheelNodes {
  frontLeft: THREE.Group;
  frontRight: THREE.Group;
  rearLeft: THREE.Group;
  rearRight: THREE.Group;
  meshFL: THREE.Mesh;
  meshFR: THREE.Mesh;
  meshRL: THREE.Mesh;
  meshRR: THREE.Mesh;
}

export class CarModel {
  public root: THREE.Group;
  public chassis: THREE.Group;
  public wheels: CarWheelNodes;
  public brakeLights: THREE.MeshStandardMaterial[] = [];
  public headlights: THREE.SpotLight[] = [];
  public bodyMaterials: THREE.MeshStandardMaterial[] = [];

  constructor(config: VehicleConfig) {
    this.root = new THREE.Group();
    this.chassis = new THREE.Group();
    this.root.add(this.chassis);

    // Build vehicle components
    this.buildBody(config);
    this.wheels = this.buildWheels();
    this.buildLighting();
  }

  public updatePaintColor(hex: string) {
    this.bodyMaterials.forEach((mat) => {
      mat.color.set(hex);
    });
  }

  private buildBody(config: VehicleConfig) {
    const isTruck = config.id === 'baja_rover';
    const isSupercar = config.id === 'phantom_v12';

    // Main body paint material
    const paintMat = new THREE.MeshStandardMaterial({
      color: config.color,
      metalness: 0.85,
      roughness: 0.25,
      envMapIntensity: 1.2,
    });
    this.bodyMaterials.push(paintMat);

    const darkAccentMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.5,
      roughness: 0.4,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      metalness: 0.9,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.88,
    });

    // 1. Lower Chassis Base
    const baseGeo = new THREE.BoxGeometry(2.0, 0.45, 4.4);
    const baseMesh = new THREE.Mesh(baseGeo, paintMat);
    baseMesh.position.y = 0.5;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    this.chassis.add(baseMesh);

    // 2. Hood / Front Nose
    const noseLength = isTruck ? 1.4 : 1.6;
    const noseHeight = isTruck ? 0.6 : (isSupercar ? 0.35 : 0.45);
    const noseGeo = new THREE.BoxGeometry(1.9, noseHeight, noseLength);
    const noseMesh = new THREE.Mesh(noseGeo, paintMat);
    noseMesh.position.set(0, 0.6 + noseHeight / 2, 1.3);
    noseMesh.castShadow = true;
    this.chassis.add(noseMesh);

    // Front Bumper Splitter
    const splitterGeo = new THREE.BoxGeometry(2.05, 0.12, 0.6);
    const splitter = new THREE.Mesh(splitterGeo, darkAccentMat);
    splitter.position.set(0, 0.35, 2.2);
    this.chassis.add(splitter);

    // 3. Cabin & Glass Roof
    const cabinWidth = isTruck ? 1.8 : 1.65;
    const cabinHeight = isTruck ? 0.85 : (isSupercar ? 0.5 : 0.65);
    const cabinLength = isTruck ? 1.8 : 1.9;
    const cabinGeo = new THREE.BoxGeometry(cabinWidth, cabinHeight, cabinLength);
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(0, 0.75 + cabinHeight / 2, -0.2);
    cabinMesh.castShadow = true;
    this.chassis.add(cabinMesh);

    // Cabin roof strip (painted metal on top of glass)
    const roofGeo = new THREE.BoxGeometry(cabinWidth - 0.2, 0.08, cabinLength - 0.3);
    const roofMesh = new THREE.Mesh(roofGeo, paintMat);
    roofMesh.position.set(0, 0.75 + cabinHeight + 0.04, -0.2);
    roofMesh.castShadow = true;
    this.chassis.add(roofMesh);

    // 4. Rear Trunk & Diffuser
    const rearLength = isTruck ? 1.1 : 1.3;
    const rearGeo = new THREE.BoxGeometry(1.9, 0.5, rearLength);
    const rearMesh = new THREE.Mesh(rearGeo, paintMat);
    rearMesh.position.set(0, 0.7, -1.5);
    rearMesh.castShadow = true;
    this.chassis.add(rearMesh);

    // Rear wing / spoiler for sports and supercar
    if (!isTruck) {
      const spoilerWingGeo = new THREE.BoxGeometry(2.1, 0.06, 0.35);
      const spoilerWing = new THREE.Mesh(spoilerWingGeo, darkAccentMat);
      spoilerWing.position.set(0, 1.25, -2.1);
      spoilerWing.castShadow = true;
      this.chassis.add(spoilerWing);

      // Struts
      [-0.65, 0.65].forEach((sx) => {
        const strutGeo = new THREE.BoxGeometry(0.06, 0.35, 0.1);
        const strut = new THREE.Mesh(strutGeo, darkAccentMat);
        strut.position.set(sx, 1.05, -2.1);
        this.chassis.add(strut);
      });
    }

    // Baja Rover Roll Cage
    if (isTruck) {
      const cageMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 });
      const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.2);
      const bar1 = new THREE.Mesh(barGeo, cageMat);
      bar1.rotation.z = Math.PI / 2;
      bar1.position.set(0, 1.7, -0.5);
      this.chassis.add(bar1);
    }

    // Rear Exhaust Tips (Twin)
    const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 16);
    exhaustGeo.rotateX(Math.PI / 2);
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    [-0.45, 0.45].forEach((ex) => {
      const exhaust = new THREE.Mesh(exhaustGeo, chromeMat);
      exhaust.position.set(ex, 0.36, -2.25);
      this.chassis.add(exhaust);
    });
  }

  private buildWheels(): CarWheelNodes {
    const wheelRadius = 0.38;
    const wheelWidth = 0.28;

    // Wheel Geometry
    const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 24);
    tireGeo.rotateZ(Math.PI / 2);

    const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.65, wheelRadius * 0.65, wheelWidth + 0.02, 16);
    rimGeo.rotateZ(Math.PI / 2);

    const brakeDiscGeo = new THREE.CylinderGeometry(wheelRadius * 0.5, wheelRadius * 0.5, 0.04, 16);
    brakeDiscGeo.rotateZ(Math.PI / 2);

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1c1917,
      roughness: 0.9,
      metalness: 0.1,
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.85,
      roughness: 0.2,
    });

    const brakeDiscMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.3,
    });

    const caliperMat = new THREE.MeshStandardMaterial({
      color: 0xef4444, // Red caliper
      roughness: 0.4,
    });

    const createWheelUnit = (x: number, z: number) => {
      const pivot = new THREE.Group();
      pivot.position.set(x, wheelRadius, z);

      const spinGroup = new THREE.Group();

      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.castShadow = true;
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.castShadow = true;

      spinGroup.add(tireMesh);
      spinGroup.add(rimMesh);

      // Brake assembly stays stationary relative to rotation
      const disc = new THREE.Mesh(brakeDiscGeo, brakeDiscMat);
      const caliperGeo = new THREE.BoxGeometry(0.08, 0.14, 0.18);
      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(x > 0 ? 0.05 : -0.05, 0.12, 0.05);

      pivot.add(spinGroup);
      pivot.add(disc);
      pivot.add(caliper);

      this.chassis.add(pivot);
      return { pivot, spinGroup, tireMesh };
    };

    const fl = createWheelUnit(1.05, 1.4);
    const fr = createWheelUnit(-1.05, 1.4);
    const rl = createWheelUnit(1.05, -1.4);
    const rr = createWheelUnit(-1.05, -1.4);

    return {
      frontLeft: fl.pivot,
      frontRight: fr.pivot,
      rearLeft: rl.pivot,
      rearRight: rr.pivot,
      meshFL: fl.tireMesh,
      meshFR: fr.tireMesh,
      meshRL: rl.tireMesh,
      meshRR: rr.tireMesh,
    };
  }

  private buildLighting() {
    // Headlights (Front Left & Right)
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xe0f2fe,
      emissiveIntensity: 2.0,
      roughness: 0.1,
    });

    const headGeo = new THREE.BoxGeometry(0.3, 0.12, 0.1);
    const hlLeft = new THREE.Mesh(headGeo, headMat);
    hlLeft.position.set(0.72, 0.6, 2.15);
    const hlRight = new THREE.Mesh(headGeo, headMat);
    hlRight.position.set(-0.72, 0.6, 2.15);
    this.chassis.add(hlLeft);
    this.chassis.add(hlRight);

    // Actual spot lights projecting forward
    [-0.72, 0.72].forEach((x) => {
      const spot = new THREE.SpotLight(0xffffff, 2.5, 60, Math.PI / 6, 0.4, 1.5);
      spot.position.set(x, 0.6, 2.2);
      const target = new THREE.Object3D();
      target.position.set(x, 0.2, 30);
      this.chassis.add(target);
      spot.target = target;
      spot.castShadow = true;
      spot.shadow.mapSize.width = 512;
      spot.shadow.mapSize.height = 512;
      this.chassis.add(spot);
      this.headlights.push(spot);
    });

    // Rear Taillights / Brake lights
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.5,
      roughness: 0.2,
    });
    this.brakeLights.push(brakeMat);

    const tailGeo = new THREE.BoxGeometry(0.4, 0.1, 0.08);
    const tailL = new THREE.Mesh(tailGeo, brakeMat);
    tailL.position.set(0.72, 0.7, -2.18);
    const tailR = new THREE.Mesh(tailGeo, brakeMat);
    tailR.position.set(-0.72, 0.7, -2.18);
    this.chassis.add(tailL);
    this.chassis.add(tailR);
  }

  public updateBrakes(isBraking: boolean) {
    this.brakeLights.forEach((mat) => {
      mat.emissiveIntensity = isBraking ? 3.0 : 0.5;
      mat.emissive.set(isBraking ? 0xff2222 : 0xef4444);
    });
  }

  public updateWheelAnimation(steerAngle: number, distanceTraveledDelta: number) {
    const wheelRadius = 0.38;
    const rotationDelta = distanceTraveledDelta / wheelRadius;

    // Steering rotation on front wheel pivots
    this.wheels.frontLeft.rotation.y = steerAngle;
    this.wheels.frontRight.rotation.y = steerAngle;

    // Spin all wheels around local X
    [this.wheels.frontLeft, this.wheels.frontRight, this.wheels.rearLeft, this.wheels.rearRight].forEach((pivot) => {
      const spin = pivot.children[0];
      if (spin) {
        spin.rotation.x += rotationDelta;
      }
    });
  }

  public updateChassisDynamics(lateralG: number, longitudinalG: number) {
    // Chassis roll (lean into turns / body roll opposite of lateral G)
    const targetRoll = -lateralG * 0.06;
    // Chassis pitch (nose dive under braking, squat under acceleration)
    const targetPitch = longitudinalG * 0.05;

    this.chassis.rotation.z = THREE.MathUtils.lerp(this.chassis.rotation.z, targetRoll, 0.2);
    this.chassis.rotation.x = THREE.MathUtils.lerp(this.chassis.rotation.x, targetPitch, 0.2);
  }
}
