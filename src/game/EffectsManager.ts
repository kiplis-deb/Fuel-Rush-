import * as THREE from 'three';

interface SmokeParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

interface SparkleParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class EffectsManager {
  private scene: THREE.Scene;
  private smokeParticles: SmokeParticle[] = [];
  private sparkleParticles: SparkleParticle[] = [];

  private smokeGeo: THREE.DodecahedronGeometry;
  private smokeMat: THREE.MeshBasicMaterial;

  private sparkleGeo: THREE.SphereGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    this.smokeGeo = new THREE.DodecahedronGeometry(0.3, 0);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });

    this.sparkleGeo = new THREE.SphereGeometry(0.12, 6, 6);
  }

  public emitTireSmoke(position: THREE.Vector3, intensity: number) {
    if (this.smokeParticles.length > 90) return; // Pool limit
    const count = Math.ceil(intensity * 3);

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      const offset = (Math.random() - 0.5) * 0.4;
      mesh.position.set(position.x + offset, 0.15, position.z + offset);
      const initialScale = 0.5 + Math.random() * 0.5;
      mesh.scale.setScalar(initialScale);

      this.scene.add(mesh);

      this.smokeParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          0.8 + Math.random() * 0.9,
          (Math.random() - 0.5) * 0.8
        ),
        life: 0,
        maxLife: 0.6 + Math.random() * 0.4,
      });
    }
  }

  public emitSparkles(position: THREE.Vector3, colorHex: number, count: number = 24) {
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.sparkleGeo, mat);
      mesh.position.copy(position);

      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 8;
      const upSpeed = 2 + Math.random() * 6;

      this.scene.add(mesh);

      this.sparkleParticles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          upSpeed,
          Math.sin(angle) * speed
        ),
        life: 0,
        maxLife: 0.8 + Math.random() * 0.5,
      });
    }
  }

  public update(dt: number) {
    // 1. Update Smoke Particles
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.smokeParticles.splice(i, 1);
        continue;
      }

      // Expand & rise
      p.mesh.position.addScaledVector(p.velocity, dt);
      const progress = p.life / p.maxLife;
      const scale = (1 + progress * 2.5);
      p.mesh.scale.setScalar(scale);

      const mat = p.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - progress) * 0.4;
    }

    // 2. Update Sparkles
    for (let i = this.sparkleParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkleParticles[i];
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        this.scene.remove(sp.mesh);
        this.sparkleParticles.splice(i, 1);
        continue;
      }

      sp.velocity.y -= 9.8 * dt; // Gravity
      sp.mesh.position.addScaledVector(sp.velocity, dt);

      const progress = sp.life / sp.maxLife;
      const mat = sp.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - progress;
    }
  }

  public clear() {
    this.smokeParticles.forEach((p) => {
      this.scene.remove(p.mesh);
    });
    this.sparkleParticles.forEach((sp) => {
      this.scene.remove(sp.mesh);
    });
    this.smokeParticles = [];
    this.sparkleParticles = [];
  }
}
