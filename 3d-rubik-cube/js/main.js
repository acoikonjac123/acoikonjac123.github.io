import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RubiksCube } from './cube.js';
import { Timer, formatTime } from './timer.js';
import { CUBE_CONFIG } from './config.js';

// --- 1. 场景初始化 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x202020);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
camera.position.set(5, 8, 6);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;

const rubiksCube = new RubiksCube(scene);
const timer = new Timer();
let currentScramble = '';

// --- 2. 键盘映射表 ---
// 面旋转 & 中层旋转 (M跟随L, E跟随D, S跟随F)
const MOVE_MAP = {
    'r': { axis: 'x', layer: 1, dir: -1 }, 'R': { axis: 'x', layer: 1, dir: 1 },
    'l': { axis: 'x', layer: -1, dir: 1 }, 'L': { axis: 'x', layer: -1, dir: -1 },
    'u': { axis: 'y', layer: 1, dir: -1 }, 'U': { axis: 'y', layer: 1, dir: 1 },
    'd': { axis: 'y', layer: -1, dir: 1 }, 'D': { axis: 'y', layer: -1, dir: -1 },
    'f': { axis: 'z', layer: 1, dir: -1 }, 'F': { axis: 'z', layer: 1, dir: 1 },
    'b': { axis: 'z', layer: -1, dir: 1 }, 'B': { axis: 'z', layer: -1, dir: -1 },
    // 中层
    'm': { axis: 'x', layer: 0, dir: 1 }, 'M': { axis: 'x', layer: 0, dir: -1 },
    'e': { axis: 'y', layer: 0, dir: 1 }, 'E': { axis: 'y', layer: 0, dir: -1 },
    's': { axis: 'z', layer: 0, dir: -1 }, 'S': { axis: 'z', layer: 0, dir: 1 },
};

// 整体转体 (x跟随R, y跟随U, z跟随F)
const ROTATE_MAP = {
    'x': { axis: 'x', dir: -1 }, 'X': { axis: 'x', dir: 1 },
    'y': { axis: 'y', dir: -1 }, 'Y': { axis: 'y', dir: 1 },
    'z': { axis: 'z', dir: -1 }, 'Z': { axis: 'z', dir: 1 },
};

// --- 3. 核心逻辑函数 ---
function handleScramble() {
    timer.reset();
    const moves = ['r', 'l', 'u', 'd', 'f', 'b'];
    let seq = [], lastAxis = '';
    
    for (let i = 0; i < CUBE_CONFIG.SCRAMBLE_LENGTH; i++) {
        let move = moves[Math.floor(Math.random() * moves.length)];
        while (move[0] === lastAxis) move = moves[Math.floor(Math.random() * moves.length)];
        lastAxis = move[0];
        
        const isPrime = Math.random() > 0.5;
        const key = isPrime ? move.toUpperCase() : move;
        seq.push(key);
        
        const m = MOVE_MAP[key];
        rubiksCube.rotateLayer(m.axis, m.layer, m.dir, 0, true);
    }
    
    currentScramble = seq.join(' ');
    timer.state = 'READY';
    updateUI();
}

function onMoveComplete() {
    if (timer.state === 'RUNNING' && rubiksCube.isSolved()) {
        timer.stop();
        timer.saveRecord(timer.elapsedTime, currentScramble);
        updateUI();
    }
}

function handleTurn(key) {
    if (rubiksCube.isAnimating) return;
    
    // 优先检查整体转体
    const rot = ROTATE_MAP[key];
    if (rot) {
        rubiksCube.rotateCube(rot.axis, rot.dir, CUBE_CONFIG.animDuration, false, onMoveComplete);
        return;
    }
    
    // 再检查面/中层旋转
    const move = MOVE_MAP[key];
    if (move) {
        rubiksCube.rotateLayer(move.axis, move.layer, move.dir, CUBE_CONFIG.animDuration, false, onMoveComplete);
    }
}

// --- 4. 事件监听 ---
window.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleScramble();
        return;
    }

    if (e.code === 'Space') {
        e.preventDefault();
        if (timer.state === 'READY') timer.start();
        else if (timer.state === 'RUNNING') timer.stop();
        updateUI();
        return;
    }

    let key = e.key;
    if (key.length === 1 && key >= 'a' && key <= 'z') {
        key = e.shiftKey ? key.toUpperCase() : key.toLowerCase();
    }
    
    handleTurn(key);
});

// 导出按钮
document.getElementById('btn-json').onclick = () => download(timer.exportJSON(), 'rubiks_history.json', 'application/json');
document.getElementById('btn-csv').onclick = () => download(timer.exportCSV(), 'rubiks_history.csv', 'text/csv');
document.getElementById('btn-clear').onclick = () => {
    if(confirm('确定清空所有历史记录？')) { timer.clearHistory(); updateUI(); }
};

function download(content, fileName, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
}

// --- 5. UI 更新 ---
function updateUI() {
    const stats = timer.getStats();
    document.getElementById('stat-best').innerText = stats.best ? formatTime(stats.best) : '-';
    document.getElementById('stat-ao5').innerText = stats.ao5 ? formatTime(stats.ao5) : '-';
    document.getElementById('stat-ao12').innerText = stats.ao12 ? formatTime(stats.ao12) : '-';
    document.getElementById('stat-count').innerText = stats.count;
    document.getElementById('scramble-text').innerText = currentScramble || '-';
    
    let status = '';
    if (timer.state === 'IDLE') status = '按 Alt+R 打乱';
    else if (timer.state === 'READY') status = '按 Space 开始';
    else if (timer.state === 'RUNNING') status = '计时中...';
    else if (timer.state === 'STOPPED') status = rubiksCube.isSolved() ? '✅ 还原成功!' : '⏹ 已停止';
    document.getElementById('status-text').innerText = status;
    
    if (timer.state !== 'RUNNING') {
        document.getElementById('current-time').innerText = formatTime(timer.elapsedTime);
    }
}

function tick() {
    if (timer.state === 'RUNNING') {
        document.getElementById('current-time').innerText = formatTime(timer.getElapsedTime());
    }
    requestAnimationFrame(tick);
}
tick();

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
updateUI();