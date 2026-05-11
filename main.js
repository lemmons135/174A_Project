import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);

const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
const loader = new GLTFLoader();
const airplanePath = 'airplane/scene.gltf';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setAnimationLoop( animate );
document.body.appendChild( renderer.domElement );

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
directionalLight.position.set(10, 10, 10);
scene.add(directionalLight);

// 1. Create a variable outside the loader so the animate loop can access it
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
// Disable controls by default so they don't fight our custom camera logic
controls.enabled = false; 

// 2. Set up an object to track which keys are currently pressed
const keys = { w: false, a: false, s: false, d: false, q: false, e: false, c: false };

window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] !== undefined) keys[key] = true;
});

window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys[key] !== undefined) keys[key] = false;
});

const clock = new THREE.Clock();

function animate() {
    // getDelta() returns the time in seconds since the last frame.
    // Using this ensures your plane rotates at the same speed regardless of monitor refresh rate!
    const delta = clock.getDelta(); 

    if (airplane) {
        const turnSpeed = 2.0 * delta;

        // --- FLIGHT CONTROLS ---
        // Roll (Z-axis)
        if (keys.a) airplaneContainer.rotateZ(turnSpeed);
        if (keys.d) airplaneContainer.rotateZ(-turnSpeed);
        
        // Pitch (X-axis) - Swapped to X for standard Three.js Y-up orientation
        if (keys.w) airplaneContainer.rotateX(turnSpeed);
        if (keys.s) airplaneContainer.rotateX(-turnSpeed);
        
        // Yaw (Y-axis) - Swapped to Y for standard Three.js Y-up orientation
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
            controls.enabled = false;

            // Step A: Define where the camera SHOULD be relative to the airplane.
            // (0 for X, 2 units up on Y, 8 units behind on Z). 
            // Note: If your plane faces the opposite way, change Z to -8.
            const offset = new THREE.Vector3(0, 25, -50); 

            // Step B: Apply the airplane's current position and rotation to that offset
            const idealCameraPosition = offset.applyMatrix4(airplaneContainer.matrixWorld);

            // Step C: Lerp (Linear Interpolate) the camera's actual position toward the ideal position.
            // The 0.05 value is the "smoothness" factor. Lower = slower/smoother, 1 = instant.
            camera.position.lerp(idealCameraPosition, 0.05);

            // Step D: Force the camera to look directly at the airplane
            camera.lookAt(airplaneContainer.position);
        }
    }

    renderer.render( scene, camera );
}