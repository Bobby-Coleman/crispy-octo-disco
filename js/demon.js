// js/demon.js

class Demon {
    constructor(scene, initialPos, environment, player) {
        this.scene = scene;
        this.environment = environment;
        this.player = player; // Reference to player for targeting

        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;
        this.model = null; // To hold the loaded GLB model
        this.mixer = null; // Animation mixer
        this.animations = {}; // To store AnimationActions

        this.speed = 2.0; // Normal walk speed

        this.initialPosition = initialPos.clone();

        // AI State Machine
        this.state = 'IDLE'; // IDLE, WALKING, ATTACKING_FIREBALL, ATTACKING_SPAWN, ATTACKING_OMNI, HIT, DYING
        this.attackCooldown = 2.0; // Time between deciding attacks (approx)
        this.attackTimer = Math.random() * this.attackCooldown; // Start with random delay
        this.lastActionTime = Date.now(); // Track last action time

        this.loadModel();
        this.updateHealthUI();
    }

    loadModel() {
        console.log('Starting to load demon model...');
        const loader = new THREE.GLTFLoader();
        loader.load(
            'models/demon.glb',
            (gltf) => {
                console.log('Demon model loaded successfully:', gltf);
                this.model = gltf.scene;
                this.model.scale.set(1.5, 1.5, 1.5); // Adjust scale if needed
                this.model.position.copy(this.initialPosition);
                
                // Add collision box
                const boxGeometry = new THREE.BoxGeometry(4, 5, 4); // Much larger collision box
                const boxMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.3,
                    visible: true // Make it visible
                });
                this.collisionBox = new THREE.Mesh(boxGeometry, boxMaterial);
                this.model.add(this.collisionBox);
                
                this.model.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                         //node.receiveShadow = true; // Optional, can be performance heavy
                    }
                });
                this.scene.add(this.model);

                // Animation Setup
                this.mixer = new THREE.AnimationMixer(this.model);
                const animationClips = gltf.animations;
                console.log('Available animations:', animationClips.map(clip => clip.name));

                // Map specified animation names
                const animNameMap = {
                    walk: 'Walk_F_RM',
                    walkBack: 'Walk_B_IP',
                    charge: 'Run_Attack_RM',
                    fireball: 'Attack_1',
                    hit: 'Hit_F',
                    death: 'Death'
                };

                animationClips.forEach((clip) => {
                     // Find which spec name this clip corresponds to
                     for (const key in animNameMap) {
                         if (animNameMap[key] === clip.name) {
                             const action = this.mixer.clipAction(clip);
                             if (key === 'hit' || key === 'death' || key === 'fireball') {
                                 action.setLoop(THREE.LoopOnce); // Play once
                                 action.clampWhenFinished = true; // Stay on last frame
                             } else {
                                 action.setLoop(THREE.LoopRepeat); // Loop walk/charge
                             }
                             this.animations[key] = action;
                             console.log(`Loaded animation: ${key} (${clip.name})`);
                             break; // Found mapping
                         }
                     }
                });


                // Initial state
                if (this.animations.walk) {
                    this.playAnimation('walk');
                    this.state = 'WALKING'; // Start walking around or idle
                } else {
                    console.warn("Walk animation 'Walk_F_RM' not found in GLB.");
                    this.state = 'IDLE';
                }
                 this.attackTimer = this.attackCooldown * (1 + Math.random()); // Reset timer after load

            },
            undefined, // onProgress callback (optional)
            (error) => {
                console.error('Error loading demon model:', error);
            }
        );
    }

    playAnimation(name, crossfadeDuration = 0.3) {
        if (!this.mixer || !this.animations[name]) {
             //console.warn(`Animation "${name}" not found or mixer not ready.`);
             return null;
        }

        const newAction = this.animations[name];
        let currentAction = null;

         // Find currently active action
        for (const key in this.animations) {
            if (this.animations[key].isRunning()) {
                currentAction = this.animations[key];
                break;
            }
        }

        if (currentAction === newAction) {
            if (!newAction.isRunning()) newAction.play(); // Ensure it's playing if it's the same
            return newAction;
        }

        newAction.reset(); // Reset the action before playing/crossfading

        if (currentAction) {
             currentAction.crossFadeTo(newAction, crossfadeDuration, true);
             newAction.play();
        } else {
            newAction.play();
        }

        // Handle one-shot animations completing
        if (name === 'hit' || name === 'fireball' || name === 'death') {
            const listener = (event) => {
                if (event.action === newAction) {
                    this.mixer.removeEventListener('finished', listener);
                     // After hit/fireball, return to walking/idle
                     if (this.state !== 'DYING' && (name === 'hit' || name === 'fireball')) {
                         this.state = 'WALKING'; // Or IDLE?
                         this.playAnimation('walk');
                     }
                }
            };
            this.mixer.addEventListener('finished', listener);
        }

        return newAction;
    }


    takeDamage(amount) {
        if (this.isDead || this.state === 'DYING') return;

        this.health -= amount;
        this.updateHealthUI();
        console.log(`Demon took ${amount} damage. Health: ${this.health}`);

        if (this.health <= 0) {
            this.health = 0;
            this.die();
        } else {
            // Play hit animation only if not already doing a major action
            if (this.state !== 'HIT' && this.state !== 'ATTACKING_FIREBALL') {
                 this.state = 'HIT';
                 this.playAnimation('hit');
                 // The animation finish handler will return to WALKING
            }
        }
    }

     updateHealthUI() {
        const healthPercentage = (this.health / this.maxHealth) * 100;
        const healthFill = document.getElementById('demon-health-fill');
         const healthValue = document.getElementById('demon-health-value');
        if (healthFill) healthFill.style.width = `${healthPercentage}%`;
         if(healthValue) healthValue.textContent = Math.max(0, Math.ceil(this.health)); // Show integer health
    }

    die() {
        if (this.isDead || this.state === 'DYING') return;

        this.isDead = true;
        this.state = 'DYING';
        console.log("Demon Died!");

        const deathAction = this.playAnimation('death');

        // Wait for death animation to finish, then hide model and open door
        if (deathAction) {
            const listener = (event) => {
                 if (event.action === deathAction) {
                    this.mixer.removeEventListener('finished', listener);
                    if (this.model) {
                        this.scene.remove(this.model); // Remove from scene visually
                        this.model = null; // Clear reference
                    }
                    this.environment.openDoor(); // Signal environment to open the door
                }
            };
             this.mixer.addEventListener('finished', listener);
        } else {
            // If no death animation, just hide immediately and open door
             if (this.model) this.scene.remove(this.model);
             this.model = null;
             this.environment.openDoor();
        }
    }

    // --- Attack Implementations ---

    spawnFire() {
        if (this.state === 'DYING') return;
        console.log("Demon spawning fire across the map");
        this.state = 'ATTACKING_SPAWN';
        Utils.playSound('roar');
        
        // Create multiple random fire hazards across the map (20% coverage)
        const mapWidth = 40; // Approximate map width
        const mapDepth = 40; // Approximate map depth
        const fireRadius = 2.5; // Size of each fire hazard
        const fireArea = Math.PI * fireRadius * fireRadius;
        const totalMapArea = mapWidth * mapDepth;
        
        // Calculate how many fires to create to cover ~20% of the map
        const targetCoverage = 0.2; // 20% coverage
        const targetArea = totalMapArea * targetCoverage;
        const numFires = Math.floor(targetArea / fireArea);
        
        console.log(`Creating ${numFires} fires to cover ~20% of the map`);
        
        for (let i = 0; i < numFires; i++) {
            // Generate random position within map bounds
            const x = (Math.random() * mapWidth) - (mapWidth / 2); // Center map at origin
            const z = (Math.random() * mapDepth) - (mapDepth / 2);
            const position = new THREE.Vector3(x, 0, z);
            
            // Create fire hazard with 10 damage
            this.environment.createFireHazard(position, fireRadius, 10);
        }
        
        this.state = 'WALKING'; // Return to walking state
        this.playAnimation('walk');
    }

    shootFireball() {
        if (this.state === 'DYING') return;
        console.log("Demon shooting fireballs");
        this.state = 'ATTACKING_FIREBALL';
        Utils.playSound('fireball');

        this.playAnimation('fireball');

        // Get direction to player's body (not head)
        const playerPos = this.player.getPosition().clone();
        playerPos.y -= 0.8; // Aim at player's body instead of head
        const baseDirection = playerPos.clone().sub(this.model.position).normalize();
        
        // Adjust start position to be at a good shooting height
        const startPos = this.model.position.clone().add(new THREE.Vector3(0, 1.2, 0)); // Lower spawn height
        startPos.add(baseDirection.clone().multiplyScalar(1.0));

        // Create three bullets with spread
        const spreadAngle = Math.PI / 12; // 15 degrees spread
        
        // Center bullet
        this.environment.createDemonBullet(startPos.clone(), baseDirection.clone());
        
        // Left bullet
        const leftDir = baseDirection.clone();
        leftDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
        this.environment.createDemonBullet(startPos.clone(), leftDir);
        
        // Right bullet
        const rightDir = baseDirection.clone();
        rightDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), -spreadAngle);
        this.environment.createDemonBullet(startPos.clone(), rightDir);
    }

    shootOmniBullets() {
        if (this.state === 'DYING') return;
        console.log("Demon shooting omnidirectional bullets");
        this.state = 'ATTACKING_OMNI';
        Utils.playSound('fireball');

        this.playAnimation('fireball');

        // Adjust start position to be at a good shooting height
        const startPos = this.model.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        
        // Create bullets in all directions
        const numBullets = 8; // 8 directions
        const angleStep = (Math.PI * 2) / numBullets;
        
        for (let i = 0; i < numBullets; i++) {
            const angle = i * angleStep;
            const direction = new THREE.Vector3(
                Math.sin(angle), 
                0,
                Math.cos(angle)
            );
            this.environment.createDemonBullet(startPos.clone(), direction);
        }
    }

    // --- Main Update Logic ---
    update(deltaTime) {
        if (!this.model || this.isDead || this.state === 'DYING') return;

        // Update Animation Mixer
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Check collision between demon and player bullets
        if (this.collisionBox) {
            for (let bullet of this.environment.playerBullets) {
                const bulletPos = bullet.mesh.position;
                const demonPos = this.model.position;
                const dx = bulletPos.x - demonPos.x;
                const dy = bulletPos.y - demonPos.y;
                const dz = bulletPos.z - demonPos.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                if (distance < 1.5) { // Collision radius
                    this.takeDamage(10);
                    this.environment.removeBullet(bullet);
                    break;
                }
            }
        }

        // Check collision with player and push them back strongly
        if (this.collisionBox && this.player) {
            const playerPos = this.player.getPosition();
            const demonPos = this.model.position;
            const dx = playerPos.x - demonPos.x;
            const dz = playerPos.z - demonPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < 5.0) { // Much larger collision radius
                // Calculate push direction and strength
                const pushDir = new THREE.Vector3(dx, 0, dz).normalize();
                const pushStrength = 3.0; // Much stronger push
                
                // Push player away from demon
                this.player.camera.position.add(pushDir.multiplyScalar(pushStrength));
            }
        }

        // State-based behavior
        switch (this.state) {
            case 'IDLE':
            case 'WALKING':
                // Decide next action and look at player
                this.decideNextAction();
                this.lookAtPlayer();
                break;
            case 'ATTACKING_FIREBALL':
            case 'ATTACKING_OMNI':
            case 'ATTACKING_SPAWN':
            case 'HIT':
                // Actions handled by animation completion or initial trigger
                // Ensure demon still looks at player during these short actions
                this.lookAtPlayer();
                break;
        }
    }

    decideNextAction() {
        if (this.state === 'DYING') return;
        
        // Reset state to IDLE before deciding new action
        this.state = 'IDLE';
        
        // Add a minimum delay between actions
        const now = Date.now();
        if (now - this.lastActionTime < 1000) return; // At least 1 second between actions
        
        // Randomly choose between the three attacks
        const attackChoice = Math.random();
        
        if (attackChoice < 0.33) {
            console.log("Demon deciding to spawn fire");
            this.spawnFire();
        } else if (attackChoice < 0.67) {
            console.log("Demon deciding to shoot fireballs");
            this.shootFireball();
        } else {
            console.log("Demon deciding to shoot omni bullets");
            this.shootOmniBullets();
        }
        
        this.lastActionTime = now;
    }

    lookAtPlayer() {
        if (this.model && this.player) {
            const playerPos = this.player.getPosition();
            const targetPos = playerPos.clone();
            targetPos.y = this.model.position.y; // Look at player on the same horizontal plane
            this.model.lookAt(targetPos);
        }
    }

    getPosition() {
        return this.model ? this.model.position : new THREE.Vector3();
    }

    getDistanceToPlayer() {
        const playerPos = this.player.getPosition();
        const demonPos = this.model.position;
        return demonPos.distanceTo(playerPos);
    }
}