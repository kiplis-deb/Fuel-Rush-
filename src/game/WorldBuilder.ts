import * as THREE from 'three';
import { CheckpointData, FuelCanisterData, StartFinishLineData, TrackConfig } from '../types/game';

export interface WorldObjects {
  checkpointMeshes: {
    id: number;
    group: THREE.Group;
    gateMat: THREE.MeshStandardMaterial;
    beaconMat: THREE.MeshBasicMaterial;
    ringMesh: THREE.Mesh;
    data: CheckpointData;
  }[];
  startFinishMesh: {
    group: THREE.Group;
    archMat: THREE.MeshStandardMaterial;
    beaconMat: THREE.MeshBasicMaterial;
    finishLight: THREE.PointLight;
    signMesh: THREE.Mesh;
  };
  fuelCanisterMeshes: {
    id: number;
    group: THREE.Group;
    canister: THREE.Mesh;
    aura: THREE.Mesh;
    data: FuelCanisterData;
  }[];
  update: (time: number, targetCheckpointId: number, isFinishUnlocked: boolean) => void;
  dispose: () => void;
}

export class WorldBuilder {
  public static buildWorld(scene: THREE.Scene, track: TrackConfig): WorldObjects {
    // 1. Atmosphere: Fog & Sky Lighting (Bright, sunny, clear daytime!)
    scene.background = new THREE.Color(track.skyColor);
    scene.fog = new THREE.Fog(track.fogColor, 180, 850);

    // Bright Directional Sunlight
    const sunLight = new THREE.DirectionalLight(0xfffdf4, 2.2);
    sunLight.position.set(140, 180, 120);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 650;
    sunLight.shadow.camera.left = -320;
    sunLight.shadow.camera.right = 320;
    sunLight.shadow.camera.top = 320;
    sunLight.shadow.camera.bottom = -320;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    // Warm Ambient Daylight Fill
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    // Hemisphere sky-ground ambient reflection
    const hemiLight = new THREE.HemisphereLight(track.skyColor, 0xdcfce7, 1.1);
    scene.add(hemiLight);

    // Sunny Procedural Clouds
    this.buildClouds(scene);

    // 2. Terrain Ground Plane
    const groundGeo = new THREE.PlaneGeometry(1600, 1600, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: track.groundColor,
      roughness: 0.9,
      metalness: 0.1,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.02;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 3. Track Ribbon / Road Network
    this.buildRoadMesh(scene, track);

    // 4. Start / Finish Line Arch (Start awal sebagai finish line)
    const startFinishMesh = this.buildStartFinishLine(scene, track.startFinishLine || {
      position: track.waypoints[0] || [0, 0, 0],
      rotationY: 0,
      width: 22,
    });

    // 5. Checkpoint Arches & Sky Beacons
    const checkpointMeshes = this.buildCheckpoints(scene, track.checkpoints);

    // 6. Fuel Refill Canisters
    const fuelCanisterMeshes = this.buildFuelCanisters(scene, track.fuelCanisters);

    // 7. Trackside Scenery (Trees, Buildings, Streetlights, Rocks)
    this.buildScenery(scene, track);

    // Update handler for animations
    const update = (time: number, targetCheckpointId: number, isFinishUnlocked: boolean) => {
      // 1. Animate Checkpoints
      checkpointMeshes.forEach((cp) => {
        if (cp.data.collected) {
          // Already collected: quiet green transparent, beacon off
          cp.gateMat.emissive.set(0x059669);
          cp.gateMat.emissiveIntensity = 0.2;
          cp.beaconMat.opacity = 0.0;
          cp.ringMesh.visible = false;
        } else {
          // Not collected yet!
          cp.ringMesh.visible = true;
          cp.ringMesh.rotation.z = time * 1.5;

          const isTarget = cp.id === targetCheckpointId;
          if (isTarget) {
            // Nearest active target: Intense pulsing gold/emerald beacon
            const pulse = Math.sin(time * 6) * 0.3 + 0.7;
            cp.gateMat.emissive.set(0x10b981);
            cp.gateMat.emissiveIntensity = 2.4 * pulse;
            cp.beaconMat.opacity = 0.5 * pulse;
            cp.beaconMat.color.set(0x34d399);
          } else {
            // Other pending checkpoints: cyan beacon
            cp.gateMat.emissive.set(0x0284c7);
            cp.gateMat.emissiveIntensity = 0.8;
            cp.beaconMat.opacity = 0.25;
            cp.beaconMat.color.set(0x38bdf8);
          }
        }
      });

      // 2. Animate Start / Finish Line
      if (isFinishUnlocked) {
        // UNLOCKED VICTORY STATE: Blazing celebratory beacon & checkered lights
        const pulse = Math.sin(time * 7) * 0.35 + 0.65;
        startFinishMesh.archMat.emissive.set(0x10b981);
        startFinishMesh.archMat.emissiveIntensity = 2.5 * pulse;
        startFinishMesh.beaconMat.opacity = 0.6 * pulse;
        startFinishMesh.beaconMat.color.set(0xf59e0b); // Golden victory sky beam
        startFinishMesh.finishLight.intensity = 3.5 * pulse;
      } else {
        // LOCKED STATE: Caution amber indicator (Finish locked until all checkpoints collected)
        startFinishMesh.archMat.emissive.set(0xd97706);
        startFinishMesh.archMat.emissiveIntensity = 0.5;
        startFinishMesh.beaconMat.opacity = 0.08;
        startFinishMesh.beaconMat.color.set(0xf59e0b);
        startFinishMesh.finishLight.intensity = 0.5;
      }

      // 3. Animate fuel canisters (spin + bobbing float)
      fuelCanisterMeshes.forEach((fc) => {
        if (!fc.data.collected) {
          fc.group.visible = true;
          fc.canister.rotation.y = time * 2.2;
          fc.group.position.y = 0.8 + Math.sin(time * 3 + fc.id) * 0.25;
          fc.aura.scale.setScalar(1 + Math.sin(time * 4 + fc.id) * 0.15);
        } else {
          fc.group.visible = false;
        }
      });
    };

    const dispose = () => {
      groundGeo.dispose();
      groundMat.dispose();
    };

    return {
      checkpointMeshes,
      startFinishMesh,
      fuelCanisterMeshes,
      update,
      dispose,
    };
  }

  private static buildStartFinishLine(scene: THREE.Scene, sfData: StartFinishLineData) {
    const group = new THREE.Group();
    group.position.set(sfData.position[0], sfData.position[1], sfData.position[2]);
    group.rotation.y = sfData.rotationY;

    // Arch Material (Starts amber locked, turns gold/green when unlocked)
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });

    const postGeo = new THREE.BoxGeometry(1.2, 9, 1.2);
    const postL = new THREE.Mesh(postGeo, archMat);
    postL.position.set(-sfData.width / 2, 4.5, 0);
    postL.castShadow = true;
    group.add(postL);

    const postR = new THREE.Mesh(postGeo, archMat);
    postR.position.set(sfData.width / 2, 4.5, 0);
    postR.castShadow = true;
    group.add(postR);

    // Top Gantries & Bridge
    const bridgeGeo = new THREE.BoxGeometry(sfData.width + 2.4, 2.0, 1.8);
    const bridge = new THREE.Mesh(bridgeGeo, archMat);
    bridge.position.set(0, 9, 0);
    bridge.castShadow = true;
    group.add(bridge);

    // Overhead Checkered Flag Signboard
    const signMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
    });
    const signGeo = new THREE.BoxGeometry(sfData.width - 2, 1.4, 0.2);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(0, 9, 0.95);
    group.add(signMesh);

    // Alternate checkered squares on the signboard
    const checkMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const checkMatBlack = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const checkSquareGeo = new THREE.PlaneGeometry(1.2, 0.6);

    const numCols = Math.floor((sfData.width - 4) / 1.3);
    for (let c = 0; c < numCols; c++) {
      for (let r = 0; r < 2; r++) {
        const isWhite = (c + r) % 2 === 0;
        const square = new THREE.Mesh(checkSquareGeo, isWhite ? checkMatWhite : checkMatBlack);
        square.position.set(-((numCols - 1) * 1.3) / 2 + c * 1.3, 8.7 + r * 0.6, 1.06);
        group.add(square);
      }
    }

    // Checkered strip across the road surface on the ground
    const roadCheckGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const roadCheckCols = Math.floor(sfData.width / 1.6);
    for (let c = 0; c < roadCheckCols; c++) {
      for (let r = 0; r < 2; r++) {
        const isWhite = (c + r) % 2 === 0;
        const tile = new THREE.Mesh(roadCheckGeo, isWhite ? checkMatWhite : checkMatBlack);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(-((roadCheckCols - 1) * 1.6) / 2 + c * 1.6, 0.08, (r - 0.5) * 1.5);
        tile.receiveShadow = true;
        group.add(tile);
      }
    }

    // Towering Victory Sky Light Beam (Shoots up to 85m into the sky)
    const beaconGeo = new THREE.CylinderGeometry(0.5, sfData.width * 0.45, 85, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 42.5, 0);
    group.add(beacon);

    // Illuminating Finish Light
    const finishLight = new THREE.PointLight(0x10b981, 1.0, 35, 1.5);
    finishLight.position.set(0, 8.5, 0);
    group.add(finishLight);

    scene.add(group);

    return {
      group,
      archMat,
      beaconMat,
      finishLight,
      signMesh,
    };
  }

  private static buildCheckpoints(scene: THREE.Scene, checkpoints: CheckpointData[]) {
    return checkpoints.map((cp) => {
      const group = new THREE.Group();
      group.position.set(cp.position[0], cp.position[1], cp.position[2]);
      group.rotation.y = cp.rotationY;

      const gateMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.2,
        roughness: 0.2,
        transparent: true,
        opacity: 0.95,
      });

      // Arch Posts
      const postGeo = new THREE.BoxGeometry(0.8, 8, 0.8);
      const postL = new THREE.Mesh(postGeo, gateMat);
      postL.position.set(-cp.width / 2, 4, 0);
      postL.castShadow = true;
      group.add(postL);

      const postR = new THREE.Mesh(postGeo, gateMat);
      postR.position.set(cp.width / 2, 4, 0);
      postR.castShadow = true;
      group.add(postR);

      // Top Crossbar
      const crossGeo = new THREE.BoxGeometry(cp.width + 1.6, 1.2, 1.2);
      const cross = new THREE.Mesh(crossGeo, gateMat);
      cross.position.set(0, 8, 0);
      cross.castShadow = true;
      group.add(cross);

      // Sky Light Beam (High-rising vertical cylindrical beacon)
      const beaconGeo = new THREE.CylinderGeometry(0.3, cp.width * 0.4, 75, 16, 1, true);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 37.5, 0);
      group.add(beacon);

      // Holographic Ring
      const ringGeo = new THREE.TorusGeometry(cp.width / 2 - 0.5, 0.15, 12, 32);
      const ringMesh = new THREE.Mesh(ringGeo, gateMat);
      ringMesh.position.set(0, 4.5, 0);
      group.add(ringMesh);

      scene.add(group);

      return {
        id: cp.id,
        group,
        gateMat,
        beaconMat,
        ringMesh,
        data: cp,
      };
    });
  }

  private static buildFuelCanisters(scene: THREE.Scene, fuelCanisters: FuelCanisterData[]) {
    const canisterMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 1.2,
      metalness: 0.8,
      roughness: 0.25,
    });

    const auraMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });

    return fuelCanisters.map((fc) => {
      const group = new THREE.Group();
      group.position.set(fc.position[0], fc.position[1], fc.position[2]);

      const canGeo = new THREE.BoxGeometry(0.8, 1.1, 0.5);
      const canister = new THREE.Mesh(canGeo, canisterMat);
      canister.castShadow = true;
      group.add(canister);

      const handleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.6);
      handleGeo.rotateZ(Math.PI / 2);
      const handle = new THREE.Mesh(handleGeo, canisterMat);
      handle.position.set(0, 0.65, 0);
      canister.add(handle);

      const spoutGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.3);
      const spout = new THREE.Mesh(spoutGeo, canisterMat);
      spout.position.set(0.3, 0.65, 0);
      canister.add(spout);

      const auraGeo = new THREE.RingGeometry(1.2, 1.5, 24);
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.rotation.x = -Math.PI / 2;
      group.add(aura);

      scene.add(group);

      return {
        id: fc.id,
        group,
        canister,
        aura,
        data: fc,
      };
    });
  }

  private static buildRoadMesh(scene: THREE.Scene, track: TrackConfig) {
    const branches = track.roadBranches && track.roadBranches.length > 0
      ? track.roadBranches
      : [{ id: 'main', points: track.waypoints, isClosedLoop: true, width: 14 }];

    const roadMat = new THREE.MeshStandardMaterial({
      color: track.roadColor,
      roughness: 0.8,
      metalness: 0.15,
    });

    const curbMatWhite = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
    const curbMatRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });
    const curbGeo = new THREE.BoxGeometry(0.8, 0.2, 2.5);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const lineGeo = new THREE.BoxGeometry(0.3, 0.04, 2.2);

    branches.forEach((branch) => {
      const isLoop = !!branch.isClosedLoop;
      const roadWidth = branch.width || 12;
      const halfWidth = roadWidth / 2;

      const pts = branch.points.map((p) => new THREE.Vector3(p[0], 0.06, p[2]));
      if (pts.length < 2) return;

      const curve = new THREE.CatmullRomCurve3(pts, isLoop);
      const divisions = Math.max(30, Math.min(240, Math.round(curve.getLength() / 2.5)));
      const curvePoints = curve.getSpacedPoints(divisions);

      const positions: number[] = [];
      const normals: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      const totalSegments = isLoop ? divisions : divisions;

      for (let i = 0; i <= totalSegments; i++) {
        const pt = curvePoints[i % curvePoints.length];
        const nextPt = i < divisions
          ? curvePoints[i + 1]
          : (isLoop ? curvePoints[0] : curvePoints[divisions]);

        const dir = new THREE.Vector3().subVectors(nextPt, pt);
        if (dir.lengthSq() === 0) {
          dir.set(0, 0, 1);
        } else {
          dir.normalize();
        }

        const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();

        const pLeft = new THREE.Vector3().copy(pt).addScaledVector(normal, -halfWidth);
        const pRight = new THREE.Vector3().copy(pt).addScaledVector(normal, halfWidth);

        positions.push(pLeft.x, pLeft.y, pLeft.z);
        positions.push(pRight.x, pRight.y, pRight.z);

        normals.push(0, 1, 0);
        normals.push(0, 1, 0);

        const v = (i / divisions) * (curve.getLength() / 10);
        uvs.push(0, v);
        uvs.push(1, v);
      }

      for (let i = 0; i < divisions; i++) {
        const idx = i * 2;
        indices.push(idx, idx + 1, idx + 2);
        indices.push(idx + 1, idx + 3, idx + 2);
      }

      const roadGeo = new THREE.BufferGeometry();
      roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      roadGeo.setIndex(indices);

      const roadMesh = new THREE.Mesh(roadGeo, roadMat);
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);

      for (let i = 0; i < divisions; i += 3) {
        const pt = curvePoints[i];
        const nextPt = curvePoints[(i + 1) % curvePoints.length];
        const dir = new THREE.Vector3().subVectors(nextPt, pt).normalize();
        const normal = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        const rotY = Math.atan2(dir.x, dir.z);

        if (i % 2 === 0) {
          const dash = new THREE.Mesh(lineGeo, lineMat);
          dash.position.set(pt.x, 0.08, pt.z);
          dash.rotation.y = rotY;
          scene.add(dash);
        }

        [-halfWidth - 0.4, halfWidth + 0.4].forEach((offset) => {
          const curb = new THREE.Mesh(curbGeo, (i / 3) % 2 === 0 ? curbMatWhite : curbMatRed);
          curb.position.copy(pt).addScaledVector(normal, offset);
          curb.position.y = 0.1;
          curb.rotation.y = rotY;
          curb.receiveShadow = true;
          scene.add(curb);
        });
      }
    });

    const junctionPoints: [number, number, number][] = [];
    branches.forEach((b) => {
      junctionPoints.push(b.points[0]);
      junctionPoints.push(b.points[b.points.length - 1]);
    });

    const padMat = new THREE.MeshStandardMaterial({
      color: track.roadColor,
      roughness: 0.8,
      metalness: 0.15,
    });

    junctionPoints.forEach((jp) => {
      const padGeo = new THREE.CylinderGeometry(10, 10, 0.08, 20);
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(jp[0], 0.05, jp[2]);
      pad.receiveShadow = true;
      scene.add(pad);
    });
  }

  private static buildScenery(scene: THREE.Scene, track: TrackConfig) {
    track.sceneryElements.forEach((el) => {
      const pos = el.position;
      const scale = el.scale || [1, 1, 1];

      if (el.type === 'tree') {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(pos[0], 0, pos[2]);

        const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 2.5, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3818, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 });
        [
          { r: 2.2, h: 2.8, y: 3.2 },
          { r: 1.6, h: 2.4, y: 4.8 },
          { r: 1.0, h: 1.8, y: 6.2 },
        ].forEach((layer) => {
          const coneGeo = new THREE.ConeGeometry(layer.r, layer.h, 8);
          const cone = new THREE.Mesh(coneGeo, foliageMat);
          cone.position.y = layer.y;
          cone.castShadow = true;
          treeGroup.add(cone);
        });

        scene.add(treeGroup);
      } else if (el.type === 'building') {
        const bGeo = new THREE.BoxGeometry(scale[0], scale[1], scale[2]);
        const bMat = new THREE.MeshStandardMaterial({
          color: el.color || 0x1e293b,
          roughness: 0.35,
          metalness: 0.7,
        });
        const building = new THREE.Mesh(bGeo, bMat);
        building.position.set(pos[0], scale[1] / 2, pos[2]);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);

        const beaconGeo = new THREE.SphereGeometry(0.8, 12, 12);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(pos[0], scale[1] + 0.8, pos[2]);
        scene.add(beacon);
      } else if (el.type === 'streetlight') {
        const poleGroup = new THREE.Group();
        poleGroup.position.set(pos[0], 0, pos[2]);

        const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7.5);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 3.75;
        pole.castShadow = true;
        poleGroup.add(pole);

        const lampArm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), poleMat);
        lampArm.position.set(0.6, 7.4, 0);
        poleGroup.add(lampArm);

        const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef08a, emissiveIntensity: 2.0 });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 8), bulbMat);
        bulb.position.set(1.2, 7.2, 0);
        poleGroup.add(bulb);

        const light = new THREE.PointLight(0xfef08a, 1.2, 28, 1.8);
        light.position.set(1.2, 7.0, 0);
        poleGroup.add(light);

        scene.add(poleGroup);
      } else if (el.type === 'rock' || el.type === 'canyon_wall') {
        const rockGeo = new THREE.DodecahedronGeometry(1.0, 1);
        const rockMat = new THREE.MeshStandardMaterial({
          color: track.environment === 'desert_canyon' ? 0x9a3412 : 0x475569,
          roughness: 0.95,
          metalness: 0.05,
        });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(pos[0], scale[1] / 2, pos[2]);
        rock.scale.set(scale[0], scale[1], scale[2]);
        rock.rotation.y = (pos[0] * 17) % Math.PI;
        rock.castShadow = true;
        rock.receiveShadow = true;
        scene.add(rock);
      }
    });
  }

  private static buildClouds(scene: THREE.Scene) {
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.92,
    });

    const cloudClusterCoords = [
      [-180, 110, -140],
      [-50, 125, -220],
      [120, 115, -160],
      [220, 130, 40],
      [140, 110, 180],
      [-40, 120, 190],
      [-190, 115, 60],
      [20, 135, -40],
    ];

    cloudClusterCoords.forEach((coord) => {
      const cloudGroup = new THREE.Group();
      cloudGroup.position.set(coord[0], coord[1], coord[2]);

      const puffCount = 5;
      for (let p = 0; p < puffCount; p++) {
        const radius = 18 + Math.random() * 12;
        const puffGeo = new THREE.DodecahedronGeometry(radius, 1);
        const puff = new THREE.Mesh(puffGeo, cloudMat);
        puff.position.set(
          (p - puffCount / 2) * 16 + (Math.random() - 0.5) * 8,
          (Math.random() - 0.5) * 6,
          (Math.random() - 0.5) * 16
        );
        puff.scale.set(1.4, 0.7, 1.1);
        cloudGroup.add(puff);
      }

      scene.add(cloudGroup);
    });
  }
}
