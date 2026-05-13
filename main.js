import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
// blue sky
scene.background = new THREE.Color(0x80b0ff);

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const loader = new GLTFLoader();
const airplanePath = 'airplane/scene.gltf';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

// warm sunlight
const ambientLight = new THREE.AmbientLight(0xfff8e0, 1.5);
scene.add(ambientLight);

// warm sunlight
const directionalLight = new THREE.DirectionalLight(0xfff8e0, 2);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// Setup fog:
scene.fog = new THREE.Fog(0x87ceeb, 200, 3000); // blue fog that increases over distance and makes further objects foggy sky blue

const gridSize = 5000;
const gridDivisions = 200;
const gridShiftingSize = gridSize / gridDivisions; // this calculated value contains the exact amount of shift that's needed to make the grids looks like they're infinitely moving beneath the plane

// TODO: Make ground plane textured and simple trees or hills with fancy far off distance land model
// Create the ground plane:
const ground = new THREE.Mesh(new THREE.PlaneGeometry(gridSize, gridSize), 
               new THREE.MeshLambertMaterial({ color: 0x228B22 })); // setting ground to be green like grass for now
ground.rotation.x = -Math.PI / 2; // horizontal ground
ground.position.y = -100; // start the plane above the ground

scene.add(ground);

// Create a grid over the ground that can be hidden/toggled with 'g'
const gridLinesOnGround = new THREE.GridHelper(gridSize, // size of the grid
                                                gridDivisions); // number of lines (smaller means bigger sub squares)
gridLinesOnGround.position.y = -99.0; // small amount above the ground plane
gridLinesOnGround.visible = false; // hidden default
scene.add(gridLinesOnGround);

let airplane = null;
let airplaneContainer = new THREE.Group();
scene.add(airplaneContainer)

loader.load(
    airplanePath, 
    (gltf) => {
        airplane = gltf.scene;
        console.log("Model loaded successfully!");
        airplane.rotation.y = -Math.PI / 2;
        airplaneContainer.add(airplane); 
    },
    (xhr) => { console.log((xhr.loaded / xhr.total * 100) + '% loaded'); },
    (error) => { console.error('An error happened while loading the model:', error); }
);


const controls = new OrbitControls(camera, renderer.domElement);
controls.enabled = false; 

const keys = { w: false, a: false, s: false, d: false, q: false, e: false, c: false, shift: false };

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] !== undefined) keys[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] !== undefined) keys[key] = false;
});

const clock = new THREE.Clock();

const debugElement = document.getElementById('debug');

let lastInputTime = 0; // Stores the elapsed time of the last key press

function animate() {
    // plane rotates at the same speed regardless of monitor refresh rate
    const delta = clock.getDelta(); 
    const elapsed = clock.getElapsedTime(); // Use the clock's total time

    if (airplane) {
        const turnSpeed = 2.0 * delta;
        const targetFOV = keys.shift ? 100 : 75;
        camera.fov += (targetFOV - camera.fov) * 0.1;

        camera.updateProjectionMatrix();

        // --- DETECT INPUT ---
        // Check if any flight control keys are pressed
        const isInteracting = keys.w || keys.a || keys.s || keys.d || keys.q || keys.e;
        if (isInteracting) {
            lastInputTime = elapsed;
        }

        // --- FLIGHT CONTROLS ---
        // Roll (Z-axis)
        if (keys.a) airplaneContainer.rotateZ(turnSpeed);
        if (keys.d) airplaneContainer.rotateZ(-turnSpeed);
        
        // Pitch (X-axis) 
        if (keys.w) airplaneContainer.rotateX(turnSpeed);
        if (keys.s) airplaneContainer.rotateX(-turnSpeed);
        
        // Yaw (Y-axis) 
        if (keys.q) airplaneContainer.rotateY(turnSpeed);
        if (keys.e) airplaneContainer.rotateY(-turnSpeed);


        // --- CAMERA CONTROLS ---
        if (keys.c) {
            // Free Look Mode
            controls.enabled = true;
            controls.target.copy(airplaneContainer.position); // Ensure controls orbit around the plane
            controls.update();
        } else {
            // Chase Camera Mode
            // 1. Ensure the airplane's world matrix is up to date
            airplaneContainer.updateMatrixWorld();

            // 2. Define your fixed offset in LOCAL space
            // (0 right/left, 25 units above the plane, -50 units behind the tail)
            const offset = new THREE.Vector3(0, 25, -50); 

            // 3. Convert that local offset to a world position 
            // using the airplane's actual current orientation
            const idealPosition = offset.applyMatrix4(airplaneContainer.matrixWorld);

            // 4. Smoothly move the camera to that ideal position
            // Use a higher lerp factor (e.g., 0.1) for a tighter follow
            camera.position.lerp(idealPosition, 0.1);

            // 5. Update the camera's "Up" vector to match the airplane's "Up"
            // This is what allows the camera to "Roll" with the wings
            const airplaneUp = new THREE.Vector3(0, 1, 0).applyQuaternion(airplaneContainer.quaternion);
            camera.up.lerp(airplaneUp, 0.1);

            // 6. Point the camera at the plane
            camera.lookAt(airplaneContainer.position);
        }

        // --- AUTO-LEVEL LOGIC ---
        // If more than 0.5 seconds have passed since last input
        if (elapsed - lastInputTime > 0.5) {
            // Get current rotation in Euler (YXZ order is best for planes)
            const currentEuler = new THREE.Euler().setFromQuaternion(airplaneContainer.quaternion, 'YXZ');
            
            // Create a target where Pitch (X) and Yaw (Y) stay same, but Roll (Z) is 0
            const targetEuler = new THREE.Euler(currentEuler.x, currentEuler.y, 0, 'YXZ');
            const targetQuaternion = new THREE.Quaternion().setFromEuler(targetEuler);
            
            // Smoothly move towards the level rotation
            // 0.03 is the speed of leveling; adjust to your liking
            airplaneContainer.quaternion.slerp(targetQuaternion, 0.01);
        }

        // DEBUG
        if (clock.getElapsedTime() % 1 < 0.02) { 
            console.clear();
            
            console.log(`Camera Pos: x:${camera.position.x.toFixed(2)}, y:${camera.position.y.toFixed(2)}, z:${camera.position.z.toFixed(2)}`);
            
            if (airplaneContainer) {
                console.log(`Plane Pos: x:${airplaneContainer.position.x.toFixed(2)}, y:${airplaneContainer.position.y.toFixed(2)}, z:${airplaneContainer.position.z.toFixed(2)}`);
            }

            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            console.log(`Camera Dir: x:${direction.x.toFixed(2)}, y:${direction.y.toFixed(2)}, z:${direction.z.toFixed(2)}`);
        }

        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);

        debugElement.innerHTML = `
            <b>Camera Pos:</b> ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}<br>
            <b>Plane Pos:</b> ${airplaneContainer.position.x.toFixed(1)}, ${airplaneContainer.position.y.toFixed(1)}, ${airplaneContainer.position.z.toFixed(1)}<br>
            <b>Camera Dir:</b> ${dir.x.toFixed(2)}, ${dir.y.toFixed(2)}, ${dir.z.toFixed(2)}
        `;

        renderer.render(scene, camera);
    }

    renderer.render( scene, camera );
}