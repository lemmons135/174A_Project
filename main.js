import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { update } from 'three/examples/jsm/libs/tween.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const INITIAL_FOV = 100;
const BOOST_FOV = INITIAL_FOV * 1.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);

const camera = new THREE.PerspectiveCamera(INITIAL_FOV, window.innerWidth / window.innerHeight, 2.0, 25000);
const listener = new THREE.AudioListener();
camera.add(listener);

const loader = new GLTFLoader();
const audioLoader = new THREE.AudioLoader();

const airplanePath = 'airplane/scene.gltf';
const enemyPath = 'enemy/soldier_character/scene.gltf';
const explosionPath = 'explosion/scene.gltf';

// player sound effects
const playerShootPath = 'sounds/player_shoot.wav';
const afterburnerPath = 'sounds/afterburner.wav';
const afterburnerLoopPath = 'sounds/afterburner_continuous.wav';
const planeExplosionPath = 'sounds/plane_explosion.mp3';
const reloadPath = 'sounds/reload.wav';
const playerDamagePath = 'sounds/player_damage.wav';
// enviornment sound effects
const ringDingPath = 'sounds/ring_ding.wav';
const hitMarkerPath = 'sounds/hitmarker.wav';
// menu sound effects
const upgradePath = 'sounds/upgrade_purchase.wav';
// combo sound effects
const doubleKillPath = 'sounds/double_kill.wav';
const tripleKillPath = 'sounds/triple_kill.wav';
const quadKillPath = 'sounds/quad_kill.wav';
const pentaKillPath = 'sounds/penta_kill.wav';


// ── NEW Combo Kills State ───────────────────────────────────
let comboCount = 0;
let comboTimer = 0;
const COMBO_WINDOW = 1.0; // Seconds allowed between kills to maintain the combo
let comboFadeTimeout = null;

// ── NEW Upgrades & Currency State ───────────────────────────
let coins = 0;
let upgrades = {
    speed: 0,
    boostSpeed: 0,
    maxAmmo: 0,
    fireRate: 0,
    damage: 0,
    health: 0,
    boostDuration: 0
};

const UPGRADE_COSTS = { speed: 400, boostSpeed: 400, boostDuration: 600, maxAmmo: 600, fireRate: 600, damage: 800, health: 2000};
const UPGRADE_MAX = { speed: 10, boostSpeed: 10,  boostDuration: 10, maxAmmo: 10, fireRate: 5, damage: 2, health: 2};


// ── NEW Boost Meter State ───────────────────────────────────
const MAX_BOOST_TIME = 3.0;       // Max consecutive seconds of boosting
const BOOST_RECHARGE_RATE = 0.5;  // Seconds recovered per second of normal flight
const BOOST_COOLDOWN_TIME = 4.0;  // Forced penalty cooldown when empty

let currentMaxBoostTime = MAX_BOOST_TIME; 
let boostTimer = currentMaxBoostTime;
let boostCooldown = 0;
let isBoostOnCooldown = false;

// ── Tracking ─────────────────────────────────────────────────
let enemy = null;           // ground soldier (existing)
let projectiles = [];       // player bullets
let enemyJets = [];         // aerial enemy jets
let enemyProjectiles = [];  // enemy bullets
let lockTarget = null;      // unified lock-on target (ground or air)
let particles = [];         // particles per explosion
let explosionModelAsset = null; // preloaded asset for the explosion
let activeExplosionModel = null;// whether or not to render said asset
let respawnQueue = [];

// ── NEW Mechanics & Constants ────────────────────────────────
const LOCK_ON_MAX_DISTANCE    = 2500; // Max distance to allow locking on
const PLAYER_MAX_AMMO         = 25;  // Max ammo capacity
const FIRE_RATE_PER_SECOND    = 10;   // Rapid fire bullet rate
const FIRE_COOLDOWN           = 1.0 / FIRE_RATE_PER_SECOND;
const HEALTH_REGEN_ON_RING = 2;    // Hearts to restore when passing through the ring
const SCORE_PER_EXTRA_ENEMY   = 1000; // Points needed to increase max enemy jets
const ENEMY_SPAWN_DIST_MIN    = 1000; // Minimum distance dynamic jets spawn from player
const ENEMY_SPAWN_DIST_MAX    = 2000; // Maximum distance dynamic jets spawn from player
const BASE_ENEMY_COUNT        = 3;    // Starting number of enemy jets
const MAX_ENEMY_DISTANCE      = 2000; // Maximum distance for enemy jets

// Dynamic tracking replacements for your original static variables
let currentMaxAmmo = PLAYER_MAX_AMMO;

// ── Constants ────────────────────────────────────────────────
const PROJECTILE_SPEED        = 300;
const PROJECTILE_SIZE         = 2;
const PROJECTILE_LIFETIME     = 10;
const LOCK_ON_DURATION        = 2.0;
const LOCK_ON_SCREEN_THRESHOLD = 0.08;
const ENEMY_HEALTH            = 5;   // ground soldier HP

const PLAYER_MAX_HEALTH       = 3;
const PLAYER_TURN_RATE        = 2.0;
const ENEMY_JET_HEALTH        = 3;
const ENEMY_JET_SPEED         = 120;
const ENEMY_JET_TURN_RATE     = 1.5; // max steer per second (lerp weight)
const ENEMY_DETECT_RANGE      = 4000;
const ENEMY_ATTACK_RANGE      = 1800;
const ENEMY_SHOOT_INTERVAL    = 2.5;
const ENEMY_PROJECTILE_SPEED  = 220;
const ENEMY_PROJECTILE_SIZE   = 3;
const ENEMY_HIT_RADIUS        = 60;  // collision radius for jets
const PLAYER_HIT_RADIUS       = 40;  // collision radius for player
const POINTS_PER_PLANE_KILL   = 300;

const EXPLOSION_PARTICLE_COUNT = 1200;
const EXPLOSION_LIFETIME       = 2.0;

let currentRingType = 'YELLOW'; // 'YELLOW' or 'GREEN'

let currentMaxHealth = PLAYER_MAX_HEALTH;
let playerHealth = currentMaxHealth;
let playerAmmo = PLAYER_MAX_AMMO;
let score = 0;
let hasResupplied = false;
let lockOnTimer = 0;
let isLockedOn = false;

let isShooting = false;
let lastShootTime = 0;


// Load the sounds
const playerShootSound = new THREE.Audio(listener);
const afterburnerSound = new THREE.Audio(listener);
const planeExplosionSound = new THREE.Audio(listener);
const ringDingSound = new THREE.Audio(listener);
const upgradeSound = new THREE.Audio(listener);
const playerDamageSound = new THREE.Audio(listener);
const reloadSound = new THREE.Audio(listener);
const hitMarkerSound = new THREE.Audio(listener);
const doubleKillSound = new THREE.Audio(listener);
const tripleKillSound = new THREE.Audio(listener);
const quadKillSound = new THREE.Audio(listener);
const pentaKillSound = new THREE.Audio(listener);
const afterburnerLoopSound = new THREE.Audio(listener);

function loadSound(path, sound, volume = 0.3, loop = false) {
    audioLoader.load(path, (buffer) => {
        sound.setBuffer(buffer);
        sound.setVolume(volume); // Scale down volume so it doesn't clip
        sound.setLoop(loop);
    });
}
loadSound(playerShootPath, playerShootSound);
loadSound(afterburnerPath, afterburnerSound);
loadSound(planeExplosionPath, planeExplosionSound);
loadSound(ringDingPath, ringDingSound);
loadSound(upgradePath, upgradeSound);
loadSound(playerDamagePath, playerDamageSound);
loadSound(reloadPath, reloadSound);
loadSound(hitMarkerPath, hitMarkerSound);
loadSound(doubleKillPath, doubleKillSound, 0.5);
loadSound(tripleKillPath, tripleKillSound, 0.5);
loadSound(quadKillPath, quadKillSound, 0.5);
loadSound(pentaKillPath, pentaKillSound, 0.5);
loadSound(afterburnerLoopPath, afterburnerLoopSound, 0.05, true);

// ── NEW: Dynamic Difficulty Scaling Helpers ───────────────────
function getCurrentEnemyJetSpeed() {
    // Jet speed increases by 15 units per 1000 score points
    return ENEMY_JET_SPEED + (score / 1000) * 15;
}

function getCurrentEnemyShootInterval() {
    // Fire rate increases -> Interval between shots decreases.
    // Clamped to a minimum of 0.5s so it stays physically fair.
    return Math.max(0.5, ENEMY_SHOOT_INTERVAL - (score / 1000) * 0.3);
}

function getCurrentEnemyProjectileSpeed() {
    // Bullet speed increases by 25 units per 1000 score points
    return ENEMY_PROJECTILE_SPEED + (score / 1000) * 25;
}

function getCurrentEnemyJetHealth() {
    // Adds +1 maximum health point to newly spawned jets every 1500 score points
    return ENEMY_JET_HEALTH + Math.floor(score / 1500);
}

// ── Shared Scene Containers ──────────────────────────────────
const airplaneContainer = new THREE.Group();
scene.add(airplaneContainer);

// ── Renderer ─────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true // should improve long distance quality
    });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop((time) => animate(time));
document.body.appendChild(renderer.domElement);

// ── HUD elements ─────────────────────────────────────────────
const scoreUI = document.createElement('div');
scoreUI.style.cssText = 'position:absolute;top:20px;left:20px;color:#fff;font-size:30px;font-family:sans-serif;';
scoreUI.innerText = `Score: ${score}`;
document.body.appendChild(scoreUI);

const enemyStatusUI = document.createElement('div');
enemyStatusUI.style.cssText = 'position:absolute;top:20px;right:20px;color:#ff6600;font-size:24px;font-family:monospace;text-align:right;';
enemyStatusUI.innerText = `Enemy Health: ${ENEMY_HEALTH}`;
document.body.appendChild(enemyStatusUI);

const jetsRemainingUI = document.createElement('div');
jetsRemainingUI.style.cssText = 'position:absolute;top:56px;right:20px;color:#ff4444;font-size:20px;font-family:monospace;text-align:right;';
document.body.appendChild(jetsRemainingUI);

function updateJetsRemainingUI() {
    const alive = enemyJets.length;
    jetsRemainingUI.innerText = `Enemy Jets: ${alive}`;
    jetsRemainingUI.style.color = '#ff4444';
}

// Player health hearts — bottom-centre
const playerHealthUI = document.createElement('div');
playerHealthUI.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:#ff4444;font-size:28px;font-family:monospace;text-shadow:0 0 6px #ff0000;letter-spacing:4px;';
document.body.appendChild(playerHealthUI);

function updatePlayerHealthUI() {
    playerHealthUI.innerText = '♥'.repeat(playerHealth) + '♡'.repeat(Math.max(0, currentMaxHealth - playerHealth));
}
updatePlayerHealthUI();

// Player ammo — bottom-right
const ammoUI = document.createElement('div');
ammoUI.style.cssText = 'position:absolute;bottom:24px;right:20px;color:#00ffff;font-size:24px;font-family:monospace;text-shadow:0 0 6px #00aaaa;letter-spacing:2px;text-align:right;';
document.body.appendChild(ammoUI);

function updateAmmoUI() {
    ammoUI.innerText = `Ammo: ${playerAmmo} / ${currentMaxAmmo}`;
    ammoUI.style.color = playerAmmo > (currentMaxAmmo * 0.3) ? '#00ffff' : '#ff4444';
    if (reloadSound.isPlaying) reloadSound.stop();
    reloadSound.play();
}
updateAmmoUI();

// Crosshair
const crosshairContainer = document.createElement('div');
crosshairContainer.style.cssText = 'position:absolute;pointer-events:none;width:0;height:0;transform:translate(-50%,-50%);';
document.body.appendChild(crosshairContainer);

const crosshairH = document.createElement('div');
crosshairH.style.cssText = 'position:absolute;width:24px;height:2px;background:white;top:-1px;left:-12px;';
crosshairContainer.appendChild(crosshairH);

const crosshairV = document.createElement('div');
crosshairV.style.cssText = 'position:absolute;width:2px;height:24px;background:white;top:-12px;left:-1px;';
crosshairContainer.appendChild(crosshairV);

const lockRing = document.createElement('div');
lockRing.style.cssText = 'position:absolute;width:48px;height:48px;border:2px solid rgba(255,255,255,0.6);border-radius:50%;top:-24px;left:-24px;transition:border-color 0.1s;';
crosshairContainer.appendChild(lockRing);

const lockLabel = document.createElement('div');
lockLabel.style.cssText = 'position:absolute;color:red;font-family:monospace;font-size:14px;font-weight:bold;top:30px;left:-24px;width:48px;text-align:center;display:none;letter-spacing:1px;';
lockLabel.innerText = 'LOCKED';
crosshairContainer.appendChild(lockLabel);

const hitMarker = document.createElement('div');
hitMarker.style.cssText = 'position:absolute; font-size: 32px; color: white; display: none; pointer-events: none; transform: translate(-50%, -50%); font-family: sans-serif; font-weight: 100; text-shadow: 0 0 2px black;';
hitMarker.innerText = 'X';
crosshairContainer.appendChild(hitMarker);

let hitMarkerTimer = 0;

// Dynamic UI text element for center-screen announcements
const comboUI = document.createElement('div');
comboUI.style.cssText = 'position:absolute; top:25%; left:50%; transform:translate(-50%, -50%); color:#ffcc00; font-size:42px; font-family:sans-serif; font-weight:bold; text-shadow:0 0 8px #000, 0 0 20px #ff3300; display:none; z-index:10; pointer-events:none; letter-spacing:2px; text-align:center;';
document.body.appendChild(comboUI);

// ── Main Menu UI ─────────────────────────────────────────────
let isGameStarted = false; // Tracks if we are on the menu or playing
let isPaused = false;

const mainMenuUI = document.createElement('div');
mainMenuUI.style.cssText = `
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(15, 18, 27, 0.93);
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
    z-index: 100; font-family: monospace; color: #fff;
    cursor: auto;
    overflow-y: auto;
`;

// Create Shop Panel
const shopContainer = document.createElement('div');
shopContainer.style.cssText = 'margin-top: 30px; width: 80%; max-width: 600px; background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); display: none;';
shopContainer.innerHTML = `<h2 style="text-align:center;color:#ffd700;margin-top:0;letter-spacing:2px;">Hangar Upgrade Shop</h2>`;

const shopGrid = document.createElement('div');
shopGrid.style.cssText = 'display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 15px;';
shopContainer.appendChild(shopGrid);
mainMenuUI.appendChild(shopContainer);

function updateShopUI() {
    shopGrid.innerHTML = '';
    Object.keys(upgrades).forEach(key => {
        const currentLvl = upgrades[key];
        const isMax = currentLvl >= UPGRADE_MAX[key];
        const cost = Math.floor(UPGRADE_COSTS[key] * (1 + currentLvl * 0.5));
        
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:4px;';
        
        // Clean label transformations
        const labels = { 
            speed: 'Base Engine Speed', 
            boostSpeed: 'Afterburner Thrust', 
            boostDuration: 'Afterburner Capacity',
            maxAmmo: 'Ammo Capacity', 
            fireRate: 'Fire Rate', 
            damage: 'Weapon Damage',
            health: 'Maximum Health',
         };
        
        row.innerHTML = `
            <div>
                <strong style="color:#00ffff;">${labels[key]}</strong> <span style="color:#888;">(Lvl ${currentLvl}/${UPGRADE_MAX[key]})</span>
            </div>
        `;
        
        const actionBtn = document.createElement('button');
        actionBtn.style.cssText = 'padding:6px 14px; font-family:monospace; font-weight:bold; cursor:pointer; border:none; border-radius:3px;';
        
        if (isMax) {
            actionBtn.innerText = 'MAXED';
            actionBtn.style.background = '#444';
            actionBtn.style.color = '#aaa';
            actionBtn.disabled = true;
        } else {
            actionBtn.innerText = `BUY: $${cost}`;
            if (coins >= cost) {
                actionBtn.style.background = '#00aa00';
                actionBtn.style.color = '#fff';
                actionBtn.onclick = () => purchaseUpgrade(key, cost);
            } else {
                actionBtn.style.background = '#552222';
                actionBtn.style.color = '#aa8888';
                actionBtn.disabled = true;
            }
        }
        
        row.appendChild(actionBtn);
        shopGrid.appendChild(row);
    });
}

function purchaseUpgrade(type, cost) {
    if (coins >= cost && upgrades[type] < UPGRADE_MAX[type]) {
        coins -= cost;

        if(upgradeSound.isPlaying) upgradeSound.stop();
        upgradeSound.play();

        upgrades[type]++;
        coinsUI.innerText = `Coins: $${coins}`;
        
        // Dynamic stats applying instantly upon checkout
        currentMaxAmmo = PLAYER_MAX_AMMO + (upgrades.maxAmmo * 5);
        if (type === 'maxAmmo') playerAmmo = currentMaxAmmo; // Auto-fill on extension
        if (type === 'boostDuration') {
            currentMaxBoostTime = 3.0 + (upgrades.boostDuration * 0.5);
            boostTimer = Math.min(currentMaxBoostTime, boostTimer + 0.5); // Fills a portion of the newly added capacity
        }
        if (type === 'health') {
            currentMaxHealth = PLAYER_MAX_HEALTH + upgrades.health;
            playerHealth = Math.min(currentMaxHealth, playerHealth + 1); // Fills a portion of the newly added capacity
            updatePlayerHealthUI();
        }
        updateAmmoUI();
        updateShopUI();
    }
}

function registerKill() {
    comboCount++;
    comboTimer = COMBO_WINDOW; // Reset the countdown window

    if (comboCount === 2) {
        if (doubleKillSound.isPlaying) doubleKillSound.stop();
        doubleKillSound.play();

        showComboMessage("DOUBLE KILL!<br><span style='font-size:20px; color:#00ffff;'>BOOST REFRESHED</span>");
        
        // Reset boost values and clear forced cooldowns
        boostTimer = currentMaxBoostTime;
        isBoostOnCooldown = false;
        boostBar.style.background = '#00ffff';
        boostLabel.innerText = 'BOOST ENERGY';

    } else if (comboCount === 3) {
        if (tripleKillSound.isPlaying) tripleKillSound.stop();
        tripleKillSound.play();

        // Grants +25 ammo back (clamped to your upgraded currentMaxAmmo limit)
        playerAmmo = Math.min(currentMaxAmmo, playerAmmo + 25);
        updateAmmoUI();
        showComboMessage("TRIPLE KILL!<br><span style='font-size:20px; color:#00ff00;'>+25 AMMO REFRESHED</span>");

    } else if (comboCount === 4) {
        if (quadKillSound.isPlaying) quadKillSound.stop();
        quadKillSound.play();

        showComboMessage("QUADRA KILL!");

    } else if (comboCount >= 5) {
        if (pentaKillSound.isPlaying) pentaKillSound.stop();
        pentaKillSound.play();

        showComboMessage("PENTA KILL!<br><span style='font-size:20px; color:#ff4444;'>+1 HP RECOVERED</span>");
        
        // Safely add a heart back up to the game's maximum health limit
        playerHealth = Math.min(currentMaxHealth, playerHealth + 1);
        updatePlayerHealthUI();
    }
}

function showComboMessage(text) {
    comboUI.innerHTML = text;
    comboUI.style.display = 'block';
    
    // Scale-pop animation trigger
    comboUI.style.transform = 'translate(-50%, -50%) scale(1.3)';
    setTimeout(() => {
        comboUI.style.transition = 'transform 0.15s ease-out';
        comboUI.style.transform = 'translate(-50%, -50%) scale(1.0)';
    }, 20);

    clearTimeout(comboFadeTimeout);
    comboFadeTimeout = setTimeout(() => {
        comboUI.style.display = 'none';
    }, 2000); // Clear message from view after 2 seconds
}

const menuTitle = document.createElement('h1');
menuTitle.innerText = 'JET FIGHTER SIMULATOR';
menuTitle.style.cssText = 'font-size: 48px; margin-bottom: 40px; letter-spacing: 4px; text-shadow: 0 0 10px #ff6600;';
mainMenuUI.appendChild(menuTitle);

const playButton = document.createElement('button');
playButton.innerText = 'START MISSION';
playButton.style.cssText = `
    padding: 15px 40px; font-size: 20px; font-family: monospace;
    background: #ff6600; color: white; border: none; border-radius: 4px;
    cursor: pointer; font-weight: bold; letter-spacing: 2px;
    box-shadow: 0 0 15px rgba(255,102,0,0.5); transition: 0.2s;
`;
playButton.onmouseover = () => playButton.style.background = '#ff8833';
playButton.onmouseout = () => playButton.style.background = '#ff6600';

// When clicked, hide menu and hide cursor
playButton.addEventListener('click', () => {
    mainMenuUI.style.display = 'none';
    document.body.style.cursor = 'none'; // Hides cursor for gameplay
    isGameStarted = true;
    isPaused = false; 
    shopContainer.style.display = 'none';
});

mainMenuUI.appendChild(playButton);
document.body.appendChild(mainMenuUI);

// Coin HUD element below the score
const coinsUI = document.createElement('div');
coinsUI.style.cssText = 'position:absolute;top:60px;left:20px;color:#ffd700;font-size:24px;font-family:sans-serif;text-shadow:0 0 4px #aa8800;';
coinsUI.innerText = `Coins: $${coins}`;
document.body.appendChild(coinsUI);

// Boost Meter element (Bottom left)
const boostUIContainer = document.createElement('div');
boostUIContainer.style.cssText = 'position:absolute;bottom:24px;left:20px;width:200px;height:16px;background:rgba(0,0,0,0.5);border:2px solid #00ffff;border-radius:4px;overflow:hidden;';
const boostBar = document.createElement('div');
boostBar.style.cssText = 'width:100%;height:100%;background:#00ffff;transition:width 0.05s linear;';
boostUIContainer.appendChild(boostBar);

const boostLabel = document.createElement('div');
boostLabel.style.cssText = 'position:absolute;bottom:45px;left:20px;color:#00ffff;font-family:monospace;font-size:14px;letter-spacing:1px;';
boostLabel.innerText = 'BOOST ENERGY';
document.body.appendChild(boostLabel);
document.body.appendChild(boostUIContainer);

// Helper function to update score and coins uniformly
function addScoreAndCoins(amount) {
    score += amount;
    if (amount > 0) coins += amount; // Only gain coins on point increases
    scoreUI.innerText = `Score: ${score}`;
    coinsUI.innerText = `Coins: $${coins}`;
    if (typeof updateShopUI === 'function') updateShopUI();
}

// ── Lights ───────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// ── Sky / fog ────────────────────────────────────────────────
const skyTexture = new THREE.TextureLoader().load('sky/skyCopy.jpg');
skyTexture.mapping = THREE.EquirectangularReflectionMapping;
skyTexture.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTexture;

scene.fog = new THREE.Fog(0x87ceeb, 5000, 20000);

// ============================================================
// Procedural terrain: value noise + FBM
// ============================================================
function hash2d(ix, iy) {
    let h = (Math.imul(ix, 1619) ^ Math.imul(iy, 31337)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x119de1f3) >>> 0;
    return ((h ^ (h >>> 13)) >>> 0) / 0xffffffff;
}

function valuenoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    return hash2d(ix,   iy  ) * (1-ux) * (1-uy)
         + hash2d(ix+1, iy  ) * ux  * (1-uy)
         + hash2d(ix,   iy+1) * (1-ux) * uy
         + hash2d(ix+1, iy+1) * ux  * uy;
}

function fbm(x, y) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < 5; i++) { v += valuenoise(x*f, y*f) * a; a *= 0.5; f *= 2; }
    return v;
}

const TERRAIN_SCALE     = 0.0003;
const TERRAIN_AMPLITUDE = 400;
const TERRAIN_BASE      = -280;

function getTerrainHeight(wx, wz) {
    return fbm(wx * TERRAIN_SCALE, wz * TERRAIN_SCALE) * TERRAIN_AMPLITUDE + TERRAIN_BASE;
}

function getBiomeColor(h) {
    if (h < -240) return [0.90, 0.82, 0.58];
    if (h < -160) return [0.70, 1.00, 0.60];
    if (h <  -60) return [1.00, 1.00, 1.00];
    if (h <   20) return [0.65, 0.60, 0.50];
    return [0.92, 0.95, 1.00];
}

// ============================================================
// Terrain chunk system
// ============================================================
const CHUNK_SIZE   = 2000;
const CHUNK_SEGS   = 40;
const CHUNK_RADIUS = 3; // # of chunks to load around player
const TEXTURE_TILE = 400;

const chunkPool    = [];
const activeChunks = new Map();
let lastChunkCX = null, lastChunkCZ = null;

const gridSize       = 20000;
const gridDivisions  = 200;
const gridShiftingSize = gridSize / gridDivisions;

const groundTexture = new THREE.TextureLoader().load('ground/texture.jpg');
groundTexture.wrapS = THREE.RepeatWrapping;
groundTexture.wrapT = THREE.RepeatWrapping;
groundTexture.repeat.set(1, 1);
groundTexture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
groundTexture.colorSpace = THREE.SRGBColorSpace;

const groundMaterial = new THREE.MeshLambertMaterial({ map: groundTexture, vertexColors: true });

function createChunkMesh() {
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGS, CHUNK_SEGS);
    geo.rotateX(-Math.PI / 2);
    const n = geo.attributes.position.count;
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return new THREE.Mesh(geo, groundMaterial);
}

function buildChunk(mesh, cx, cz) {
    const wx0 = cx * CHUNK_SIZE, wz0 = cz * CHUNK_SIZE;
    const pos = mesh.geometry.attributes.position;
    const uv  = mesh.geometry.attributes.uv;
    const col = mesh.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++) {
        const wx = wx0 + pos.getX(i), wz = wz0 + pos.getZ(i);
        const h = getTerrainHeight(wx, wz);
        pos.setY(i, h);
        uv.setXY(i, wx / TEXTURE_TILE, wz / TEXTURE_TILE);
        const [r, g, b] = getBiomeColor(h);
        col.setXYZ(i, r, g, b);
    }
    pos.needsUpdate = true; uv.needsUpdate = true; col.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingSphere(); // Update bounding sphere for culling
    mesh.position.set(wx0, 0, wz0);
    mesh.userData.cx = cx; mesh.userData.cz = cz;
}

function updateChunks(px, pz) {
    const cx0 = Math.floor(px / CHUNK_SIZE), cz0 = Math.floor(pz / CHUNK_SIZE);
    const needed = new Set();
    for (let i = -CHUNK_RADIUS; i <= CHUNK_RADIUS; i++)
        for (let j = -CHUNK_RADIUS; j <= CHUNK_RADIUS; j++)
            needed.add(`${cx0+i},${cz0+j}`);
    for (const [key, mesh] of activeChunks) {
        if (!needed.has(key)) { scene.remove(mesh); chunkPool.push(mesh); activeChunks.delete(key); }
    }
    for (let i = -CHUNK_RADIUS; i <= CHUNK_RADIUS; i++) {
        for (let j = -CHUNK_RADIUS; j <= CHUNK_RADIUS; j++) {
            const key = `${cx0+i},${cz0+j}`;
            if (!activeChunks.has(key)) {
                const mesh = chunkPool.pop() ?? createChunkMesh();
                buildChunk(mesh, cx0+i, cz0+j);
                scene.add(mesh); activeChunks.set(key, mesh);
            }
        }
    }
    rebuildTrees();
}

// ============================================================
// Instanced trees
// ============================================================
const TREES_PER_CHUNK    = 150;
const MAX_TREE_INSTANCES = 8000;
const TREE_Y_MIN = -230, TREE_Y_MAX = 20;

const trunkGeo = new THREE.CylinderGeometry(3, 5, 22, 5);
trunkGeo.translate(0, 11, 0);
const foliageGeo = new THREE.ConeGeometry(20, 40, 7);
foliageGeo.translate(0, 42, 0);

const trunkMesh = new THREE.InstancedMesh(trunkGeo,
    new THREE.MeshLambertMaterial({ color: 0x6B3A2A }), MAX_TREE_INSTANCES);
const foliageMesh = new THREE.InstancedMesh(foliageGeo,
    new THREE.MeshLambertMaterial({ color: 0x2D6A2D }), MAX_TREE_INSTANCES);
trunkMesh.count = foliageMesh.count = 0;
trunkMesh.frustumCulled = foliageMesh.frustumCulled = true;
scene.add(trunkMesh); scene.add(foliageMesh);

const _dummy = new THREE.Object3D();

const TREE_CHUNK_RADIUS = 2.2; // Only spawn trees on a land mass (2.2 seems fine for chunk radius of 3 and size of 2k)

function rebuildTrees() {
    let idx = 0;
    const cx0 = Math.floor(airplaneContainer.position.x / CHUNK_SIZE);
    const cz0 = Math.floor(airplaneContainer.position.z / CHUNK_SIZE);

    for (const mesh of activeChunks.values()) {
        const { cx, cz } = mesh.userData;
        // Only spawn trees in nearbychunks to prevent water hovering
        if (Math.abs(cx - cx0) > TREE_CHUNK_RADIUS || Math.abs(cz - cz0) > TREE_CHUNK_RADIUS) continue;
        const wx0 = cx * CHUNK_SIZE, wz0 = cz * CHUNK_SIZE;
        for (let i = 0; i < TREES_PER_CHUNK; i++) {
            if (idx >= MAX_TREE_INSTANCES) break;
            const rx = hash2d(cx*1000+i,      cz*500    ) * CHUNK_SIZE;
            const rz = hash2d(cx*700 +i+333,  cz*300+i  ) * CHUNK_SIZE;
            const wx = wx0+rx, wz = wz0+rz;
            const wy = getTerrainHeight(wx, wz);
            if (wy < TREE_Y_MIN || wy > TREE_Y_MAX) continue;
            if (fbm(wx*0.0004+77.3, wz*0.0004+13.7) < 0.52) continue;
            const scale = 0.7 + hash2d(Math.floor(wx)+9, Math.floor(wz)+5) * 0.6;
            _dummy.position.set(wx, wy, wz);
            _dummy.rotation.set(0, hash2d(Math.floor(wx)+1, Math.floor(wz)+1)*Math.PI*2, 0);
            _dummy.scale.setScalar(scale);
            _dummy.updateMatrix();
            trunkMesh.setMatrixAt(idx, _dummy.matrix);
            foliageMesh.setMatrixAt(idx, _dummy.matrix);
            idx++;
        }
        if (idx >= MAX_TREE_INSTANCES) break;
    }
    trunkMesh.count = foliageMesh.count = idx;
    trunkMesh.instanceMatrix.needsUpdate = foliageMesh.instanceMatrix.needsUpdate = true;
    
    // Updates the instanced mesh after calling setMatrixAt, and updates culling
    trunkMesh.computeBoundingSphere();
    foliageMesh.computeBoundingSphere();
}

// ============================================================
// Water plane
// ============================================================
const WATER_LEVEL = -230;
const waterMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 40000, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a6b9e, transparent: true, opacity: 0.78, depthWrite: false })
);
waterMesh.rotation.x = -Math.PI / 2;
waterMesh.position.y = WATER_LEVEL;
waterMesh.frustumCulled = false;
scene.add(waterMesh);

// Initial terrain
updateChunks(0, 0);
lastChunkCX = lastChunkCZ = 0;

// Debug grid
const gridLinesOnGround = new THREE.GridHelper(gridSize, gridDivisions);
gridLinesOnGround.position.y = -99.0;
gridLinesOnGround.visible = false;
scene.add(gridLinesOnGround);

// ── Resupply Ring ────────────────────────────────────────────
const ringRadius = 100; // Slightly smaller base
const resupplyRing = new THREE.Mesh(
    new THREE.TorusGeometry(ringRadius, 10, 16, 100),
    new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide })
);
resupplyRing.position.set(0, 600, 1000);
const newScale = 0.8 + Math.random() * 0.7;
resupplyRing.scale.set(newScale, newScale, newScale);
resupplyRing.material.color.set(0xffff00); // Set to yellow to start with
scene.add(resupplyRing);

// ── Player jet ───────────────────────────────────────────────
let airplane = null;

const engineGlow = new THREE.PointLight(0xff4500, 5, 150);
engineGlow.position.set(0, 0, -36);
airplaneContainer.add(engineGlow);

const engineGlowVisibleMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xff4500 })
);
engineGlowVisibleMesh.visible = false;
engineGlowVisibleMesh.position.copy(engineGlow.position);
airplaneContainer.add(engineGlowVisibleMesh);

loader.load(airplanePath,
    (gltf) => { airplane = gltf.scene; airplane.rotation.y = -Math.PI / 2; airplaneContainer.add(airplane); engineGlowVisibleMesh.visible = true; },
    (xhr) => { console.log((xhr.loaded / xhr.total * 100) + '% loaded'); },
    (error) => { console.error('Airplane load error:', error); }
);

// Load Explosion Model Template
loader.load(explosionPath,
    (gltf) => { 
        explosionModelAsset = gltf.scene; 
        explosionModelAsset.scale.set(7, 7, 7);
        explosionModelAsset.traverse((child) => {
            if (child.isMesh) {
                child.material = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.9 });
            }
        });
    },
    undefined,
    (error) => { console.error('Explosion model load error:', error); }
);

// ── Ground soldier (existing enemy) ──────────────────────────
loader.load(enemyPath,
    (gltf) => {
        enemy = gltf.scene;
        enemy.scale.set(5, 5, 5);
        enemy.health = ENEMY_HEALTH;
        enemy.position.set(0, getTerrainHeight(0, 1000) + 5, 1000);
        enemy.visible = false; // THE ENEMY IS NOT VISIBLE CAUSE ITS JANK RN, UPDATE THIS TO MAKE IT AA GUN OR SMTH LATER
        scene.add(enemy);
    },
    (xhr) => { console.log('Enemy: ' + (xhr.loaded / xhr.total * 100) + '% loaded'); },
    (error) => { console.error('Enemy load error:', error); }
);


// ============================================================
// Aerial enemy jets
// ============================================================
function createEnemyJetMesh() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x882222 });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x441111 });

    // Fuselage
    const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 38, 6), bodyMat);
    fuselage.rotation.x = Math.PI / 2;
    group.add(fuselage);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(2.5, 14, 6), bodyMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 26;
    group.add(nose);

    // Main wings
    const wings = new THREE.Mesh(new THREE.BoxGeometry(55, 1.5, 16), bodyMat);
    wings.position.z = -4;
    group.add(wings);

    // Horizontal tail
    const tailH = new THREE.Mesh(new THREE.BoxGeometry(24, 1.5, 9), darkMat);
    tailH.position.z = -21;
    group.add(tailH);

    // Vertical tail fin
    const tailV = new THREE.Mesh(new THREE.BoxGeometry(1.5, 12, 9), darkMat);
    tailV.position.set(0, 6, -21);
    group.add(tailV);

    return group;
}

// Generate dynamic spawn point taking player location into account
function getSpawnPositionNearPlayer() {
    const angle = Math.random() * Math.PI * 2;
    const dist = ENEMY_SPAWN_DIST_MIN + Math.random() * (ENEMY_SPAWN_DIST_MAX - ENEMY_SPAWN_DIST_MIN);
    const pos = airplaneContainer.position.clone();
    pos.x += Math.cos(angle) * dist;
    pos.z += Math.sin(angle) * dist;
    pos.y = 300 + Math.random() * 200; // Airborne height
    return pos;
}

function spawnEnemyJets() {
    const spawnPoints = [
        new THREE.Vector3( 2000, 300,  2000),
        new THREE.Vector3(-2500, 400,  3000),
        new THREE.Vector3( 1000, 350, -1500),
    ];
    for (const pos of spawnPoints) {
        spawnSingleEnemyJet(pos);
    }
}

function spawnSingleEnemyJet(pos) {
    const jet = createEnemyJetMesh();
    jet.position.copy(pos);
    
    const dynamicSpeed = getCurrentEnemyJetSpeed(); 
    
    jet.userData = {
        health:       getCurrentEnemyJetHealth(),  
        state:        'PATROL',
        velocity:     new THREE.Vector3(dynamicSpeed, 0, 0), 
        shootTimer:   Math.random() * getCurrentEnemyShootInterval(), 
        patrolCenter: pos.clone(),
        patrolAngle:  Math.random() * Math.PI * 2,
        patrolRadius: 700 + Math.random() * 300,
        patrolAlt:    pos.y,
    };
    scene.add(jet);
    enemyJets.push(jet);
    updateJetsRemainingUI();
}

spawnEnemyJets();

function fireEnemyProjectile(jet) {
    const p = new THREE.Mesh(
        new THREE.SphereGeometry(ENEMY_PROJECTILE_SIZE, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    p.position.copy(jet.position);
    const dir = new THREE.Vector3().subVectors(airplaneContainer.position, jet.position).normalize();
    
    dir.x += (Math.random() - 0.5) * 0.12;
    dir.y += (Math.random() - 0.5) * 0.12;
    dir.normalize();
    
    p.velocity = dir.multiplyScalar(getCurrentEnemyProjectileSpeed()); 
    p.lifetime = 0;
    scene.add(p);
    enemyProjectiles.push(p);
}

function damagePlayer(isCrash = false) {
    if (playerDamageSound.isPlaying) playerDamageSound.stop();
    playerDamageSound.play();

    if (playerHealth <= 0) return;
    if (isCrash) {
        playerHealth = 0;
        createParticleExplosion(airplaneContainer.position);

        // replacing the airplane with the explosion
        if (airplane) airplane.visible = false; 
        if (engineGlowVisibleMesh) engineGlowVisibleMesh.visible = false;
        if (explosionModelAsset && !activeExplosionModel) {
            activeExplosionModel = explosionModelAsset.clone();
            // Position it slightly offset or exactly at the container origin
            airplaneContainer.add(activeExplosionModel);
        }
    } else {
        playerHealth--;
    }
    updatePlayerHealthUI();
    if (playerHealth <= 0) {
        scoreUI.innerText = isCrash ? `💥 CRASHED! Final Score: ${score}` : `💥 SHOT DOWN! Final Score: ${score}`;
        playerHealthUI.innerText = '💀 Press R to restart';

        // replacing the airplane with the explosion
        if (airplane) airplane.visible = false; 
        if (engineGlowVisibleMesh) engineGlowVisibleMesh.visible = false;
        if (explosionModelAsset && !activeExplosionModel) {
            activeExplosionModel = explosionModelAsset.clone();
            // Position it slightly offset or exactly at the container origin
            airplaneContainer.add(activeExplosionModel);
        }

        if (planeExplosionSound.isPlaying) planeExplosionSound.stop();
        planeExplosionSound.play();
    }
}

function updateHitMarker(isKill) {
    hitMarker.style.display = 'block';
    hitMarker.style.color = isKill ? '#ff0000' : '#ffffff'; // Red for kill, white for hit
    hitMarkerTimer = 0.5; // Sets the duration

    if (hitMarkerSound.isPlaying) hitMarkerSound.stop();
    hitMarkerSound.play();
}

function gaussian(mean, stdDev)
{
    let nonZero1 = Math.random();
    let nonZero2 = Math.random();
    while (nonZero1 === 0) nonZero1 = Math.random();
    while (nonZero2 === 0) nonZero2 = Math.random();

    return Math.sqrt(-2.0 * Math.log(nonZero1)) * Math.cos(2.0 * Math.PI * nonZero2) * stdDev + mean;
}

// Particle Explosion
const particleGeometry = new THREE.SphereGeometry(2, 4, 4);
function createParticleExplosion(positionLocation) {
    for (let i = 0; i < EXPLOSION_PARTICLE_COUNT; i++) {
        const particleMaterial = new THREE.MeshStandardMaterial({ 
            color: 0XC40A0A,
            metalness: Math.random(),
            roughness: Math.random(),
            emissive: 0XC40A0A,
            emissiveIntensity: Math.random()
        });

        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(positionLocation);
        
        particle.userData = {
            velocity: new THREE.Vector3(
                gaussian(100, 50) - 75,
                gaussian(100, 50) - 75,
                gaussian(100, 50) - 75
            ),
            lifetime: EXPLOSION_LIFETIME
        };

        scene.add(particle);
        particles.push(particle);
    }
}

function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        particle.position.addScaledVector(particle.userData.velocity, delta); // particles will continue to move in their velocity directions
        particle.userData.lifetime -= delta; // decrement lifetime chunk
        particle.scale.multiplyScalar(0.97); // shrink the particle as time goes on
        if (particle.userData.lifetime <= 0)
        {
            scene.remove(particle); // remove the particles that die off over time (eventually all)
            particles.splice(i, 1); // remove the expired particles from the particles array too
        }
    }
}

function updateEnemyRespawns(delta) {
    for (let i = respawnQueue.length - 1; i >= 0; i--) {
        respawnQueue[i].timer -= delta;
        if (respawnQueue[i].timer <= 0) {
            spawnSingleEnemyJet(getSpawnPositionNearPlayer());
            respawnQueue.splice(i, 1); // Remove from queue
        }
    }
}

function updateEnemyJets(delta) {
    for (let i = enemyJets.length - 1; i >= 0; i--) {
        const jet = enemyJets[i];
        const d   = jet.userData;
        if (d.health <= 0) continue;

        const playerPos    = airplaneContainer.position;
        const distToPlayer = jet.position.distanceTo(playerPos);
        if (distToPlayer > MAX_ENEMY_DISTANCE) {
            scene.remove(jet);
            enemyJets.splice(i, 1);
            updateJetsRemainingUI();
            respawnQueue.push({ timer: 1.0 }); // Respawn soon
            continue;
        }

        // ── State transitions ──────────────────────────────────
        if (d.state === 'PATROL' && distToPlayer < ENEMY_DETECT_RANGE) {
            d.state = 'CHASE';
        } else if (d.state === 'CHASE') {
            if (distToPlayer < ENEMY_ATTACK_RANGE) d.state = 'ATTACK';
            else if (distToPlayer > ENEMY_DETECT_RANGE * 1.5) d.state = 'PATROL';
        } else if (d.state === 'ATTACK') {
            if (distToPlayer > ENEMY_ATTACK_RANGE * 1.5) d.state = 'CHASE';
        }

        // ── Desired direction per state ────────────────────────
        let desiredDir;
        if (d.state === 'PATROL') {
            d.patrolAngle += delta * 0.4;
            const target = new THREE.Vector3(
                d.patrolCenter.x + Math.cos(d.patrolAngle) * d.patrolRadius,
                d.patrolAlt,
                d.patrolCenter.z + Math.sin(d.patrolAngle) * d.patrolRadius
            );
            desiredDir = new THREE.Vector3().subVectors(target, jet.position).normalize();
        } else if (d.state === 'CHASE') {
            desiredDir = new THREE.Vector3().subVectors(playerPos, jet.position).normalize();
        } else { // ATTACK: strafe around player
            d.patrolAngle += delta * 0.7;
            const offset = new THREE.Vector3(
                Math.cos(d.patrolAngle) * 600, 50, Math.sin(d.patrolAngle) * 600
            );
            desiredDir = new THREE.Vector3().subVectors(playerPos.clone().add(offset), jet.position).normalize();
        }

        // ── Steer + move ───────────────────────────────────────
        const currentDir = d.velocity.clone().normalize();
        currentDir.lerp(desiredDir, Math.min(ENEMY_JET_TURN_RATE * delta, 1.0)).normalize();
        
        // ◄── MODIFIED: Multiplies by dynamic speed instead of static constant
        d.velocity.copy(currentDir).multiplyScalar(getCurrentEnemyJetSpeed()); 
        jet.position.addScaledVector(d.velocity, delta);

        // Keep above terrain / water
        const minY = Math.max(getTerrainHeight(jet.position.x, jet.position.z) + 60, WATER_LEVEL + 60);
        if (jet.position.y < minY) jet.position.y += (minY - jet.position.y) * 0.3;

        // Face direction of travel
        if (d.velocity.lengthSq() > 0.01)
            jet.lookAt(jet.position.clone().add(d.velocity));

        // ── Enemy shooting ─────────────────────────────────────
        if (d.state === 'ATTACK') {
            d.shootTimer -= delta;
            if (d.shootTimer <= 0) {
                // ◄── MODIFIED: Recalculates dynamically scaling pattern interval
                const currentInterval = getCurrentEnemyShootInterval();
                d.shootTimer = currentInterval + (Math.random() - 0.5) * 0.5;
                fireEnemyProjectile(jet);
            }
        }

        // ── Check if player bullets hit this jet ───────────────
        for (const p of projectiles) {
            if (p.dead) continue;
            if (p.position.distanceTo(jet.position) < ENEMY_HIT_RADIUS) {
                p.dead = true;       // let the player projectile loop clean it up
                scene.remove(p);

                const currentWeaponDamage = 1 + upgrades.damage;

                d.health -= currentWeaponDamage;

                if (d.health <= 0) {
                    updateHitMarker(true);
                    if (lockTarget === jet) { lockTarget = null; isLockedOn = false; lockOnTimer = 0; }
                    createParticleExplosion(jet.position);
                    scene.remove(jet);
                    enemyJets.splice(i, 1);
                    updateJetsRemainingUI();
                    addScoreAndCoins(POINTS_PER_PLANE_KILL);
                    registerKill();
                    scoreUI.innerText = `Enemy Jet Down! +300 | Total Score: ${score}`;

                    respawnQueue.push({ timer: 3.0 });
                } else {
                    updateHitMarker(false); // Just a hit
                }
                break;
            }
        }
    }
}

function updateEnemyProjectiles(delta) {
    for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
        const p = enemyProjectiles[i];
        p.position.addScaledVector(p.velocity, delta);
        p.lifetime += delta;

        if (p.position.distanceTo(airplaneContainer.position) < PLAYER_HIT_RADIUS) {
            damagePlayer();
            scene.remove(p);
            enemyProjectiles.splice(i, 1);
            continue;
        }
        if (p.lifetime > 8 || p.position.distanceTo(airplaneContainer.position) > 3000) {
            scene.remove(p);
            enemyProjectiles.splice(i, 1);
        }
    }
}

// ── Controls ─────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false;

const keys = { w:false, a:false, s:false, d:false, q:false, e:false, c:false, g:false, n:false, shift:false, control:false };

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] !== undefined) keys[key] = true;
    if (key === 'g') gridLinesOnGround.visible = !gridLinesOnGround.visible;
    if (key === 'r') resetScene();
    if (key === 'n') INVERT_ROLL = INVERT_ROLL === 1 ? -1 : 1;

    if (e.key === 'Escape') {
        // Only allow pausing if the player is alive and has actually started the mission
        if (isGameStarted && playerHealth > 0) {
            isPaused = !isPaused;
            isShooting = false; // Prevent shooting while paused

            if (isPaused) {
                playButton.innerText = 'RESUME';
                mainMenuUI.style.display = 'flex';
                document.body.style.cursor = 'auto'; // Show mouse
                shopContainer.style.display = 'block';
                updateShopUI();
            } else {
                mainMenuUI.style.display = 'none';
                document.body.style.cursor = 'none'; // Hide mouse
                shopContainer.style.display = 'none';
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] !== undefined) keys[key] = false;
});

let INVERT_ROLL = 1;

window.addEventListener('mousedown', (e) => {
    if (isGameStarted && !isPaused && playerHealth > 0 && e.button === 0 && airplane) {
        isShooting = true;
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) isShooting = false;
});

// Clear shooting flag if the window loses focus
window.addEventListener('blur', () => { isShooting = false; });

// ── Reset ────────────────────────────────────────────────────
function resetScene() {
    airplaneContainer.position.set(0, 0, 0);
    airplaneContainer.quaternion.set(0, 0, 0, 1);
    currentMaxBoostTime = 3.0;
    boostTimer = currentMaxBoostTime;

    comboCount = 0;
    comboTimer = 0;
    comboUI.style.display = 'none';

    if (activeExplosionModel) {
        airplaneContainer.remove(activeExplosionModel);
        activeExplosionModel = null;
    }
    if (airplane) airplane.visible = true;
    if (engineGlowVisibleMesh) engineGlowVisibleMesh.visible = true;

    for (const p of projectiles) scene.remove(p);
    projectiles = [];
    for (const p of enemyProjectiles) scene.remove(p);
    enemyProjectiles = [];
    for (const j of enemyJets) scene.remove(j);
    enemyJets = [];

    respawnQueue = [];

    lockTarget = null; lockOnTimer = 0; isLockedOn = false;
    isShooting = false; lastShootTime = 0;

    isGameStarted = false;
    isPaused = false;
    playButton.innerText = 'START MISSION';
    mainMenuUI.style.display = 'flex';
    document.body.style.cursor = 'auto';

    score = 0; hasResupplied = false;
    scoreUI.innerText = `Score: ${score}`;

    // Add these status resets into your existing resetScene() body
    coins = 0;
    boostTimer = MAX_BOOST_TIME;
    boostCooldown = 0;
    isBoostOnCooldown = false;
    currentMaxAmmo = PLAYER_MAX_AMMO;
    Object.keys(upgrades).forEach(k => upgrades[k] = 0);

    // Update HUD texts explicitly
    coinsUI.innerText = `Coins: $${coins}`;
    boostBar.style.width = '100%';
    boostBar.style.background = '#00ffff';
    boostLabel.innerText = 'BOOST ENERGY';
    // scoreUI text changes are handled dynamically inside your original engine structure

    playerHealth = PLAYER_MAX_HEALTH;
    updatePlayerHealthUI();
    
    playerAmmo = PLAYER_MAX_AMMO;
    updateAmmoUI();

    if (enemy) {
        if (!scene.children.includes(enemy)) scene.add(enemy);
        enemy.health = ENEMY_HEALTH;
        enemy.position.set(0, getTerrainHeight(0, 1000) + 5, 1000);
    }
    updateEnemyHealthUI();

    spawnEnemyJets();

    camera.fov = INITIAL_FOV;
    camera.updateProjectionMatrix();
}

// ── Player shooting ──────────────────────────────────────────
const MISSILE_TURN_RATE = 4.0; // steer strength per second (higher = tighter tracking)
const MISSILE_SPEED     = PROJECTILE_SPEED * 1.4; // missiles are faster than dumb shots

function fireProjectile() {
    if (!airplane || playerAmmo <= 0) return;

    playerAmmo--;
    updateAmmoUI();

    const lockHealth = lockTarget?.health ?? lockTarget?.userData?.health ?? 0;
    const isHoming   = isLockedOn && lockTarget && lockHealth > 0 && enemyJets.includes(lockTarget);

    const projectile = new THREE.Mesh(
        new THREE.SphereGeometry(PROJECTILE_SIZE, 8, 8),
        new THREE.MeshBasicMaterial({ color: isHoming ? 0xff6600 : 0xffff00 })
    );
    projectile.position.copy(airplaneContainer.position);

    let direction;
    if (isLockedOn && lockTarget && lockHealth > 0) {
        direction = new THREE.Vector3().subVectors(lockTarget.position, airplaneContainer.position).normalize();
    } else {
        direction = new THREE.Vector3(0, 0, 1).applyQuaternion(airplaneContainer.quaternion);
    }

    const speed = isHoming ? MISSILE_SPEED : PROJECTILE_SPEED;
    projectile.velocity      = direction.multiplyScalar(speed);
    projectile.lifetime      = 0;
    projectile.homingTarget  = isHoming ? lockTarget : null;
    scene.add(projectile);
    projectiles.push(projectile);

    if (playerShootSound.isPlaying) playerShootSound.stop();
    playerShootSound.play();
}

function checkProjectileEnemyCollision(p, tgt) {
    return tgt && p.position.distanceTo(tgt.position) < 30;
}

function updateEnemyHealthUI() {
    if (enemy && enemy.health > 0) {
        enemyStatusUI.innerText = `Enemy Health: ${enemy.health}`;
        enemyStatusUI.style.color = '#ff6600';
    } else {
        enemyStatusUI.innerText = 'Enemy Destroyed!';
        enemyStatusUI.style.color = '#00ff00';
    }
}

// ── Animate ──────────────────────────────────────────────────
let _prevTime = 0;
let soundPlayed = false;

function animate(time) {
    const delta = Math.min((time - _prevTime) / 1000, 0.1);
    _prevTime = time;

    // Day/night cycle
    const t = Math.sin((time / 1000) * 0.02) * 0.5 + 0.5;
    scene.backgroundIntensity  = t * 1.5 + 0.1;
    scene.fog.color.setHSL(0.55, 1.0, t * 0.6 + 0.02);
    directionalLight.intensity = t * 2.5;
    ambientLight.intensity     = t * 1.5 + 0.1;

    if (isGameStarted && !isPaused && airplane && playerHealth > 0) {
        // Handle Automatic Firing
        const upgradedFireRate = 10 + (upgrades.fireRate * 2.5);
        const currentFireCooldown = 1.0 / upgradedFireRate;

        if (isShooting && time - lastShootTime >= currentFireCooldown * 1000) {
            fireProjectile();
            lastShootTime = time;
        }

        if (hitMarkerTimer > 0) {
            hitMarkerTimer -= delta;
            if (hitMarkerTimer <= 0) hitMarker.style.display = 'none';
        }

        if (comboTimer > 0) {
            comboTimer -= delta;
            if (comboTimer <= 0) {
                comboCount = 0; // Combo sequence drops back to zero
            }
        }

        // ── Resupply Ring Logic ────────────────────────────
        const ringDist = airplaneContainer.position.distanceTo(resupplyRing.position);

        if (ringDist < (ringRadius * resupplyRing.scale.x) + 20) { 

            if (ringDingSound.isPlaying) ringDingSound.stop();
            ringDingSound.play();

            if (!hasResupplied) {
                if (currentRingType === 'YELLOW') {
                    playerAmmo = currentMaxAmmo;
                    scoreUI.innerText = `Ammo Refilled!`;
                    updateAmmoUI();
                } else {
                    playerHealth = Math.min(PLAYER_MAX_HEALTH, playerHealth + 2);
                    updatePlayerHealthUI();
                    scoreUI.innerText = `Health Repaired!`;
                }
                boostTimer = currentMaxBoostTime; // reset the boost timer to maximum
                isBoostOnCooldown = false;
                boostBar.style.background = '#00ffff';
                boostLabel.innerText = 'BOOST ENERGY';
                
                hasResupplied = true;
                const angle = Math.random() * Math.PI * 2;
                const dist = 1000 + Math.random() * 1000;

                let canSpawnGreen = playerHealth < PLAYER_MAX_HEALTH;
                let isYellow = true;

                if (!canSpawnGreen || Math.random() > 0.25) {
                    isYellow = true; // Force yellow if at max health or roll fails
                } else {
                    isYellow = false;
                }

                currentRingType = isYellow ? 'YELLOW' : 'GREEN';
                resupplyRing.material.color.set(isYellow ? 0xffff00 : 0x00ff00);
                resupplyRing.position.set(
                    airplaneContainer.position.x + Math.cos(angle) * dist,
                    400 + Math.random() * 300,
                    airplaneContainer.position.z + Math.sin(angle) * dist
                );

                // Random size logic
                const newScale = 0.8 + Math.random() * 0.7;
                resupplyRing.scale.set(newScale, newScale, newScale);
            }
        } else if (hasResupplied) {
            hasResupplied = false;
        }

        // ── Dynamic Performance Scaling Calculations ─────────
        const baseSpeedUpgraded  = 150 + (upgrades.speed * 25);
        const boostSpeedUpgraded = 400 + (upgrades.boostSpeed * 45);
        const brakeSpeedUpgraded = 60;
        
        let spd = baseSpeedUpgraded;

        // Boost Cooldown Manager Loop
        if (isBoostOnCooldown) {
            boostCooldown -= delta;
            boostBar.style.background = '#ff4444';
            boostLabel.innerText = `BOOST COOLING: ${Math.ceil(boostCooldown)}s`;
            if (boostCooldown <= 0) {
                isBoostOnCooldown = false;
                boostBar.style.background = '#00ffff';
                boostLabel.innerText = 'BOOST ENERGY';
                boostTimer = currentMaxBoostTime; // reset the boost timer to maximum
            }
        }

        // Processing Speed States Based on Controls & Overheat Status
        if (keys.shift && !isBoostOnCooldown && boostTimer > 0) {
            if (!soundPlayed) {
                soundPlayed = true;
                afterburnerSound.stop();
                afterburnerSound.play();
            }

            if (!afterburnerLoopSound.isPlaying) afterburnerLoopSound.play();


            spd = boostSpeedUpgraded;
            boostTimer = Math.max(0, boostTimer - delta);
            
            if (boostTimer <= 0) {
                isBoostOnCooldown = true;
                boostCooldown = BOOST_COOLDOWN_TIME;
            }
        } else {
            afterburnerLoopSound.stop();

            if (!isBoostOnCooldown) {
                // ◄── Uses dynamic currentMaxBoostTime instead of a hardcoded value
                boostTimer = Math.min(currentMaxBoostTime, boostTimer + delta * BOOST_RECHARGE_RATE);
            }
            if (keys.control) {
                spd = brakeSpeedUpgraded;
            }
        }
        if (!keys.shift) {
            soundPlayed = false;
        }

        // ── Render Graphical Output Gauge Percentage ─────────
        // ◄── Uses dynamic currentMaxBoostTime to compute correct UI width
        const boostPct = (boostTimer / currentMaxBoostTime) * 100;
        boostBar.style.width = `${boostPct}%`;

        airplaneContainer.translateZ(spd * delta);

        camera.fov += ((keys.shift && !isBoostOnCooldown ? BOOST_FOV : INITIAL_FOV) - camera.fov) * 0.08;
        camera.updateProjectionMatrix();

        const tgtI = keys.shift && !isBoostOnCooldown ? 30 : 5, tgtD = keys.shift && !isBoostOnCooldown ? 350 : 150, tgtS = keys.shift && !isBoostOnCooldown ? 3.5 : 1.0;
        engineGlow.intensity += (tgtI - engineGlow.intensity) * 0.1;
        engineGlow.distance  += (tgtD - engineGlow.distance)  * 0.2;
        const gs = engineGlowVisibleMesh.scale.x + (tgtS - engineGlowVisibleMesh.scale.x) * 0.1;
        engineGlowVisibleMesh.scale.set(gs, gs, gs);

        const turn = PLAYER_TURN_RATE * delta;

        if (keys.a) airplaneContainer.rotateZ(INVERT_ROLL * -turn);
        if (keys.d) airplaneContainer.rotateZ(INVERT_ROLL * turn);
        if (keys.w) airplaneContainer.rotateX( turn);
        if (keys.s) airplaneContainer.rotateX(-turn);
        if (keys.q) airplaneContainer.rotateY( turn);
        if (keys.e) airplaneContainer.rotateY(-turn);

        // ── Ground collision ───────────────────────────────────
        const terrainY    = getTerrainHeight(airplaneContainer.position.x, airplaneContainer.position.z);
        const groundLevel = Math.max(terrainY, WATER_LEVEL) + 5;
        if (airplaneContainer.position.y < groundLevel) {
            const pitch = new THREE.Euler().setFromQuaternion(airplaneContainer.quaternion, 'YXZ').x;
            const isHardImpact = pitch > 0.4 || pitch < -0.8 || spd > 250;

            if (isHardImpact) {
                damagePlayer(true);
            } else {
                airplaneContainer.position.y = groundLevel + 0.1;
                
                const euler = new THREE.Euler().setFromQuaternion(airplaneContainer.quaternion, 'YXZ');
                euler.x = -30 * Math.PI / 180;
                euler.z = 0;
                airplaneContainer.quaternion.setFromEuler(euler);
            }
        }

        // ── Camera ─────────────────────────────────────────────
        if (keys.c) {
            controls.enabled = true;
            controls.target.copy(airplaneContainer.position);
            controls.update();
        } else {
            controls.enabled = false;
            const offset = new THREE.Vector3(0, 35, -50);
            camera.position.lerp(offset.applyMatrix4(airplaneContainer.matrixWorld), 0.05);
            camera.lookAt(airplaneContainer.position);
        }

        // ── Crosshair ──────────────────────────────────────────
        const aimWorld = new THREE.Vector3(0, 0, 500).applyMatrix4(airplaneContainer.matrixWorld);
        const aimNDC   = aimWorld.clone().project(camera);
        crosshairContainer.style.left = ((aimNDC.x*0.5+0.5) * window.innerWidth)  + 'px';
        crosshairContainer.style.top  = ((-aimNDC.y*0.5+0.5) * window.innerHeight) + 'px';

        // ── Lock-on: find closest enemy to crosshair ───────────
        {
            let best = null, bestD = LOCK_ON_SCREEN_THRESHOLD * 1.5;
            const check = (obj, pos) => {
                const ndc = pos.clone().project(camera);
                if (ndc.z >= 1.0) return;
                const d = Math.hypot(ndc.x - aimNDC.x, ndc.y - aimNDC.y);
                if (d < bestD) { bestD = d; best = obj; }
            };
            if (enemy && enemy.health > 0) check(enemy, enemy.position);
            for (const jet of enemyJets) {
                if (jet.userData.health > 0) check(jet, jet.position);
            }
            if (best && best !== lockTarget) { lockTarget = best; lockOnTimer = 0; isLockedOn = false; }
        }

        const lockHealth = lockTarget?.health ?? lockTarget?.userData?.health ?? 0;
        if (lockTarget && lockHealth > 0) {
            const tNDC = lockTarget.position.clone().project(camera);
            const distToTarget = lockTarget.position.distanceTo(airplaneContainer.position);
            
            // Validate targeting (with Distance requirement)
            const onTarget = tNDC.z < 1.0 &&
                Math.hypot(tNDC.x - aimNDC.x, tNDC.y - aimNDC.y) < LOCK_ON_SCREEN_THRESHOLD &&
                distToTarget <= LOCK_ON_MAX_DISTANCE;

            if (onTarget) {
                if (enemyJets.includes(lockTarget)) {
                    // Instant lock for aerial enemies
                    lockOnTimer = LOCK_ON_DURATION;
                    isLockedOn = true;
                } else {
                    lockOnTimer = Math.min(lockOnTimer + delta, LOCK_ON_DURATION);
                    if (lockOnTimer >= LOCK_ON_DURATION) isLockedOn = true;
                }
            } else {
                lockOnTimer = Math.max(lockOnTimer - delta * 2, 0);
                if (lockOnTimer === 0) isLockedOn = false;
            }

            const progress = lockOnTimer / LOCK_ON_DURATION;
            if (isLockedOn) {
                lockRing.style.borderColor = 'red'; lockRing.style.boxShadow = '0 0 8px red';
                lockLabel.style.display = 'block';
                crosshairH.style.background = crosshairV.style.background = 'red';
            } else if (progress > 0) {
                const g = Math.floor(255 * progress);
                lockRing.style.borderColor = `rgb(255,${255-g},0)`; lockRing.style.boxShadow = 'none';
                lockLabel.style.display = 'none';
                crosshairH.style.background = crosshairV.style.background = 'white';
            } else {
                lockRing.style.borderColor = 'rgba(255,255,255,0.6)'; lockRing.style.boxShadow = 'none';
                lockLabel.style.display = 'none';
                crosshairH.style.background = crosshairV.style.background = 'white';
            }
        } else {
            lockTarget = null; lockOnTimer = 0; isLockedOn = false;
            lockRing.style.borderColor = 'rgba(255,255,255,0.6)'; lockRing.style.boxShadow = 'none';
            lockLabel.style.display = 'none';
            crosshairH.style.background = crosshairV.style.background = 'white';
        }

        // ── Player projectiles ─────────────────────────────────
        for (let i = projectiles.length - 1; i >= 0; i--) {
            const p = projectiles[i];
            if (p.dead) { projectiles.splice(i, 1); continue; } // cleaned up by updateEnemyJets

            // Homing steering — steer velocity toward live target each frame
            if (p.homingTarget) {
                const tHealth = p.homingTarget.userData?.health ?? p.homingTarget.health ?? 0;
                if (tHealth > 0) {
                    const toTarget  = new THREE.Vector3().subVectors(p.homingTarget.position, p.position).normalize();
                    const currentDir = p.velocity.clone().normalize();
                    currentDir.lerp(toTarget, Math.min(MISSILE_TURN_RATE * delta, 1.0)).normalize();
                    p.velocity.copy(currentDir).multiplyScalar(MISSILE_SPEED);
                } else {
                    p.homingTarget = null; // target dead, fly straight
                }
            }

            p.position.addScaledVector(p.velocity, delta);
            p.lifetime += delta;

            // Hit ground soldier
            if (enemy && enemy.health > 0 && checkProjectileEnemyCollision(p, enemy)) {
                enemy.health--;
                updateEnemyHealthUI();
                if (enemy.health <= 0) {
                    createParticleExplosion(enemy.position);
                    scene.remove(enemy);
                    if (lockTarget === enemy) { lockTarget = null; isLockedOn = false; lockOnTimer = 0; }
                    addScoreAndCoins(200);
                    scoreUI.innerText = `Enemy Eliminated! +200 | Total Score: ${score}`;
                }
                scene.remove(p); projectiles.splice(i, 1);
                continue;
            }

            if (p.lifetime > PROJECTILE_LIFETIME ||
                p.position.distanceTo(airplaneContainer.position) > 2000) {
                scene.remove(p); projectiles.splice(i, 1);
            }
        }

        // ── Dynamic Enemy Plane Scaling ────────────────────────
        const targetEnemyCount = BASE_ENEMY_COUNT + Math.floor(score / SCORE_PER_EXTRA_ENEMY);
        const currentEnemyCount = enemyJets.length + respawnQueue.length;
        if (currentEnemyCount < targetEnemyCount) {
            // Instantly spawn an extra enemy near the player to increase density
            spawnSingleEnemyJet(getSpawnPositionNearPlayer());
        }

        // ── Aerial enemies ─────────────────────────────────────
        updateEnemyJets(delta);
        updateEnemyProjectiles(delta);
        updateEnemyRespawns(delta);

        // Aerial Jet Collision
        for (const jet of enemyJets) {
            if (airplaneContainer.position.distanceTo(jet.position) < ENEMY_HIT_RADIUS) {
                damagePlayer(false); // Lose 1 HP
                createParticleExplosion(jet.position);
                scene.remove(jet);
                enemyJets.splice(enemyJets.indexOf(jet), 1);
                break;
            }
        }
    }

    // ── World upkeep (runs even when player is dead) ───────────
    updateParticles(delta);

    if (airplane) {
        gridLinesOnGround.position.x = Math.floor(airplaneContainer.position.x / gridShiftingSize) * gridShiftingSize;
        gridLinesOnGround.position.z = Math.floor(airplaneContainer.position.z / gridShiftingSize) * gridShiftingSize;

        // Pin/snap the water to a grid to prevent jiggle/glitching
        const waterToGridSnap = 100;
        waterMesh.position.x = Math.floor(airplaneContainer.position.x / waterToGridSnap) * waterToGridSnap;
        waterMesh.position.z = Math.floor(airplaneContainer.position.z / waterToGridSnap) * waterToGridSnap;

        const planeCX = Math.floor(airplaneContainer.position.x / CHUNK_SIZE);
        const planeCZ = Math.floor(airplaneContainer.position.z / CHUNK_SIZE);
        if (planeCX !== lastChunkCX || planeCZ !== lastChunkCZ) {
            updateChunks(airplaneContainer.position.x, airplaneContainer.position.z);
            lastChunkCX = planeCX; lastChunkCZ = planeCZ;
        }
    }

    renderer.render(scene, camera);
}