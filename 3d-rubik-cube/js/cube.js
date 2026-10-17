import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { COLORS, CUBE_CONFIG } from './config.js';

export class RubiksCube {
    constructor(scene) {
        this.scene = scene;
        this.cubies = [];
        this.isAnimating = false;
        
        // 1. 魔方根节点，用于整体旋转 (XYZ)
        this.cubeRoot = new THREE.Group();
        this.scene.add(this.cubeRoot);
        
        // 2. 旋转枢轴，作为 cubeRoot 的子节点
        this.pivot = new THREE.Object3D();
        this.cubeRoot.add(this.pivot);
        
        this.init();
    }

    init() {
        const { size } = CUBE_CONFIG;
        const geometry = new RoundedBoxGeometry(size, size, size, 4, 0.1);

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const materials = [
                        this.getMat(x === 1 ? COLORS.RIGHT : COLORS.INNER),
                        this.getMat(x === -1 ? COLORS.LEFT : COLORS.INNER),
                        this.getMat(y === 1 ? COLORS.UP : COLORS.INNER),
                        this.getMat(y === -1 ? COLORS.DOWN : COLORS.INNER),
                        this.getMat(z === 1 ? COLORS.FRONT : COLORS.INNER),
                        this.getMat(z === -1 ? COLORS.BACK : COLORS.INNER),
                    ];
                    const cubie = new THREE.Mesh(geometry, materials);
                    cubie.position.set(x, y, z);
                    
                    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size));
                    cubie.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000 })));
                    
                    // 挂载到 cubeRoot
                    this.cubeRoot.add(cubie);
                    this.cubies.push(cubie);
                    
                    // 记录初始局部状态，用于精准还原检测
                    cubie.userData.initPos = cubie.position.clone();
                    cubie.userData.initQuat = cubie.quaternion.clone();
                }
            }
        }
    }

    getMat(color) {
        return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1 });
    }

    // 面/中层旋转 (R, L, U, D, F, B, M, E, S)
    rotateLayer(axis, layer, direction, duration = CUBE_CONFIG.animDuration, instant = false, onComplete = null) {
        if (this.isAnimating && !instant) return;
        this.isAnimating = true;

        const targetCubies = this.cubies.filter(c => Math.round(c.position[axis]) === layer);
        this.pivot.rotation.set(0, 0, 0);
        this.pivot.updateMatrixWorld();
        targetCubies.forEach(c => this.pivot.attach(c));

        if (instant) {
            this.pivot.rotation[axis] = direction * (Math.PI / 2);
            this.pivot.updateMatrixWorld();
            targetCubies.forEach(c => {
                this.cubeRoot.attach(c); // 移回 cubeRoot
                this._roundTransform(c);
            });
            this.isAnimating = false;
            if (onComplete) onComplete();
            return;
        }

        const startRot = this.pivot.rotation[axis];
        const targetRot = startRot + direction * (Math.PI / 2);
        const startTime = performance.now();

        const animate = (time) => {
            const progress = Math.min((time - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            this.pivot.rotation[axis] = startRot + (targetRot - startRot) * ease;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.pivot.rotation[axis] = targetRot;
                this.pivot.updateMatrixWorld();
                targetCubies.forEach(c => {
                    this.cubeRoot.attach(c); // 移回 cubeRoot
                    this._roundTransform(c);
                });
                this.isAnimating = false;
                if (onComplete) onComplete();
            }
        };
        requestAnimationFrame(animate);
    }

    // 整体转体 (x, y, z)
    rotateCube(axis, direction, duration = CUBE_CONFIG.animDuration, instant = false, onComplete = null) {
        if (this.isAnimating && !instant) return;
        this.isAnimating = true;

        if (instant) {
            this.cubeRoot.rotation[axis] += direction * (Math.PI / 2);
            this._roundCubeRotation();
            this.isAnimating = false;
            if (onComplete) onComplete();
            return;
        }

        const startRot = this.cubeRoot.rotation[axis];
        const targetRot = startRot + direction * (Math.PI / 2);
        const startTime = performance.now();

        const animate = (time) => {
            const progress = Math.min((time - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            this.cubeRoot.rotation[axis] = startRot + (targetRot - startRot) * ease;

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.cubeRoot.rotation[axis] = targetRot;
                this._roundCubeRotation();
                this.isAnimating = false;
                if (onComplete) onComplete();
            }
        };
        requestAnimationFrame(animate);
    }

    _roundCubeRotation() {
        this.cubeRoot.rotation.x = Math.round(this.cubeRoot.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
        this.cubeRoot.rotation.y = Math.round(this.cubeRoot.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
        this.cubeRoot.rotation.z = Math.round(this.cubeRoot.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
    }

    // 还原检测：基于局部坐标，无视整体转体
    isSolved() {
        return this.cubies.every(c => 
            c.position.equals(c.userData.initPos) && 
            c.quaternion.equals(c.userData.initQuat)
        );
    }

    _roundTransform(obj) {
        obj.position.x = Math.round(obj.position.x);
        obj.position.y = Math.round(obj.position.y);
        obj.position.z = Math.round(obj.position.z);
        const euler = new THREE.Euler().setFromQuaternion(obj.quaternion);
        euler.x = Math.round(euler.x / (Math.PI / 2)) * (Math.PI / 2);
        euler.y = Math.round(euler.y / (Math.PI / 2)) * (Math.PI / 2);
        euler.z = Math.round(euler.z / (Math.PI / 2)) * (Math.PI / 2);
        obj.quaternion.setFromEuler(euler);
        obj.updateMatrixWorld(true);
    }
}