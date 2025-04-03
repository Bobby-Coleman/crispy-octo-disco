// js/main.js

let scene, camera, renderer;
let player, demon, environment;
let clock;
let isMobile = false;
let bgMusic, satanDialog; // Declare audio variables globally within the script scope
let finalDialog; // Add final dialog audio variable
let wooshAudio, flamesAudio, playerBulletAudio, playerGruntAudio; // Add new sound effect variables
let audioStarted = false; // Flag to ensure audio plays only once on interaction

function init() {
    console.log('Initializing game...');
    
    // Create Audio objects but don't play yet
    bgMusic = new Audio('audio/boss.mp3');
    bgMusic.loop = true;
    bgMusic.volume = 0.1; // Set to 10% volume

    satanDialog = new Audio('audio/satan_dialog.mp3');
    satanDialog.volume = 0.8; // Example volume

    finalDialog = new Audio('audio/final_dialog.mp3'); // Initialize final dialog
    finalDialog.volume = 0.8; // Match satan dialog volume

    // Initialize sound effects
    wooshAudio = new Audio('audio/woosh.mp3');
    wooshAudio.volume = 0.3; // Lower volume

    flamesAudio = new Audio('audio/flames.mp3');
    flamesAudio.volume = 0.6;

    playerBulletAudio = new Audio('audio/bullet.mp3');
    playerBulletAudio.volume = 0.2; // Lower volume

    playerGruntAudio = new Audio('audio/grunt.mp3');
    playerGruntAudio.volume = 0.7;

    // Add listener for first interaction to start audio
    document.addEventListener('click', startAudioOnInteraction, { once: true });
    document.addEventListener('touchstart', startAudioOnInteraction, { once: true }); // For mobile touch

    // Basic Setup
    scene = new THREE.Scene();
    if (!scene) {
        console.error('Failed to create Three.js scene!');
        return;
    }
    console.log('Scene created successfully');

    scene.background = new THREE.Color(0x333333); // Slightly lighter background

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    if (!camera) {
        console.error('Failed to create camera!');
        return;
    }
    console.log('Camera created successfully');

    try {
        renderer = new THREE.WebGLRenderer({ antialias: true });
        console.log('Renderer created successfully');
    } catch (e) {
        console.error('Failed to create WebGL renderer:', e);
        return;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // Enable shadows
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Optional: softer shadows
    renderer.shadowMap.autoUpdate = true;

    document.getElementById('game-canvas-container').appendChild(renderer.domElement);

    clock = new THREE.Clock();

    // Detect Mobile
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // Create Game Components
    environment = new Environment(scene, finalDialog, flamesAudio); // Pass final dialog and flames audio
    const playerStartPos = new THREE.Vector3(0, 1.6, 12); // Start near front wall
    player = new Player(scene, camera, playerStartPos, environment, playerBulletAudio, playerGruntAudio); // Pass bullet and grunt audio
    environment.setPlayer(player);

    const demonStartPos = new THREE.Vector3(0, 0, -12); // Start near back wall
    demon = new Demon(scene, demonStartPos, environment, player, wooshAudio); // Pass woosh audio

    // Setup Controls based on device
    if (isMobile) {
        const joyLeft = document.getElementById('joystick-zone-left');
        const joyRight = document.getElementById('joystick-zone-right');
        player.setupMobileControls(joyLeft, joyRight);
         document.getElementById('crosshair').style.display = 'block'; // Ensure crosshair is visible
    } else {
        player.setupDesktopControls();
        // player.setupPointAndClickControls(); // Uncomment if implementing point-and-click
        // Crosshair visibility handled by pointer lock in player.js for desktop
    }


    // Handle Window Resize
    window.addEventListener('resize', onWindowResize, false);

    // Start the animation loop ONLY after the demon model might be loaded
    // A better approach would use promises or callbacks from the loader
    // For simplicity, we start immediately, but demon logic waits for model load.
    animate();
}

function startAudioOnInteraction() {
    if (audioStarted) return; // Prevent multiple triggers
    console.log('User interaction detected, attempting to play audio...');
    
    // Try playing background music
    const bgPromise = bgMusic.play();
    if (bgPromise !== undefined) {
        bgPromise.then(_ => {
            console.log('Background music started.');
        }).catch(error => {
            console.error('Background music playback failed:', error);
        });
    }

    // Try playing satan dialog
    const dialogPromise = satanDialog.play();
     if (dialogPromise !== undefined) {
        dialogPromise.then(_ => {
            console.log('Satan dialog started.');
        }).catch(error => {
            console.error('Satan dialog playback failed:', error);
            // If dialog fails, maybe still try bg music? Or handle differently.
        });
    }
    
    audioStarted = true; 
    // Remove listeners explicitly if needed, though { once: true } should handle it
    document.removeEventListener('click', startAudioOnInteraction);
    document.removeEventListener('touchstart', startAudioOnInteraction);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const deltaTime = clock.getDelta();

    // Update game components if they exist and are ready
    if (player && !player.isDead) {
        player.update(deltaTime);
    }

    if (demon && !demon.isDead && demon.model) { // Ensure model is loaded before updating
        demon.update(deltaTime);
    } else if (demon && demon.isDead && demon.model && demon.mixer) {
         // Continue updating mixer even after death for the death animation
         demon.mixer.update(deltaTime);
    }


    if (environment) {
        environment.update(deltaTime);
    }

    // Collision Checks (moved specific checks into player/demon updates)
    // Example: Check if charging demon hits player (can be done in demon.update)
    // Example: Check if player bullets hit demon (can be done in demon.update)
    // Example: Check if demon bullets/hazards hit player (can be done in player.update)


    renderer.render(scene, camera);
}

// Start the game initialization process
init();