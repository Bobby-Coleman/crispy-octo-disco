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
        this.chargeSpeed = 6.0; // Fast charge speed (Adjust from 0.8 units/frame)

        this.initialPosition = initialPos.clone();
        this.currentTargetPosition = null; // For charge attack destination

        // AI State Machine
        this.state = 'IDLE'; // IDLE, WALKING, CHARGING, ATTACKING_FIREBALL, ATTACKING_SPAWN, HIT, DYING
        this.attackCooldown = 2.0; // Time between deciding attacks (approx)
        this.attackTimer = Math.random() * this.attackCooldown; // Start with random delay
        this.chargeWaitTimer = 0; // Timer for waiting between charges
        this.isTurning = false; // Flag when turning after charge

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
                const boxMaterial = new THREE.MeshBasicMaterial({ visible: false });
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
            // Play hit animation only if not already doing a major action like charging/dying
            if (this.state !== 'CHARGING' && this.state !== 'HIT' && this.state !== 'ATTACKING_FIREBALL') {
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

    startCharge() {
         if (this.state === 'CHARGING' || this.state === 'DYING' || this.isTurning) return;
        this.state = 'CHARGING';
        this.currentTargetPosition = this.player.getPosition().clone(); // Target player's current position
         // Keep target on the ground plane
         this.currentTargetPosition.y = this.model.position.y;
         this.playAnimation('charge');
         console.log("Demon starting charge towards:", this.currentTargetPosition);
    }

    performCharge(deltaTime) {
        if (!this.currentTargetPosition || !this.model) return;

        const direction = this.currentTargetPosition.clone().sub(this.model.position);
        const distance = direction.length();

        // Check if close enough to target or player
        const playerPos = this.player.getPosition();
        const distanceToPlayer = this.model.position.distanceTo(playerPos);

        // Collision/Stopping Condition
        const stopDistance = 1.5; // How close to get before stopping charge
        if (distance < stopDistance || distanceToPlayer < stopDistance) {
            console.log("Demon reached charge destination or player.");

            // Deal damage if close to player on charge end
            if (distanceToPlayer < stopDistance + 1.5) { // Increased damage radius to 3.0 units total
                this.player.takeDamage(25); // Increased charge damage to 25
                console.log("Charge hit player!");
            }

            // Stop charging, turn to face player, wait, then charge again
            this.state = 'IDLE'; // Temporarily idle while waiting
            this.playAnimation('walk'); // Or an idle animation if available
            this.isTurning = true; // Start turning process
            this.chargeWaitTimer = 1 + Math.random() * 2; // Reduced wait time to 1-3 seconds
            this.currentTargetPosition = null; // Clear target
            return;
        }

        // Move towards target
        direction.normalize();
        this.model.position.add(direction.multiplyScalar(this.chargeSpeed * deltaTime));

        // Make the demon look towards the direction it's moving during charge
        const lookAtPos = this.model.position.clone().add(direction);
        lookAtPos.y = this.model.position.y;
        this.model.lookAt(lookAtPos);
    }

    performTurn(deltaTime) {
        if (!this.model || !this.player) return;

        const playerPos = this.player.getPosition();
        const targetPos = playerPos.clone();
        targetPos.y = this.model.position.y; // Look at player on the same horizontal plane

        const currentQuaternion = this.model.quaternion.clone();
        // Calculate target rotation
         const tempMatrix = new THREE.Matrix4();
         tempMatrix.lookAt(targetPos, this.model.position, this.model.up);
         const targetQuaternion = new THREE.Quaternion().setFromRotationMatrix(tempMatrix);

         // Smoothly interpolate rotation
         const turnSpeed = 2.0; // Radians per second
         this.model.quaternion.slerp(targetQuaternion, turnSpeed * deltaTime);

         // Check if facing player (angle difference is small)
         const angleDiff = currentQuaternion.angleTo(targetQuaternion);
         if (angleDiff < 0.1) { // Threshold for facing player
             this.isTurning = false;
             console.log("Demon finished turning, starting wait timer.");
         }
    }

    spawnFire() {
         if (this.state === 'DYING') return;
        console.log("Demon spawning fire");
        this.state = 'ATTACKING_SPAWN';
        Utils.playSound('roar');
        // Play roar sound
        // Spawn hazard at player's current position
        const playerPos = this.player.getPosition();
        this.environment.createFireHazard(playerPos);
        // No specific animation tied in spec, maybe just walk or a short hit anim?
        // We can reuse 'hit' or just let it stay in 'walk'
        // If using a one-shot anim like 'hit', need to handle state change on finish
        // For simplicity, let's just keep walking/idle after spawning
         this.state = 'WALKING'; // Immediately return to walking state
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

        // Check collision with player and push them back
        if (this.collisionBox && this.player) {
            const playerPos = this.player.getPosition();
            const demonPos = this.model.position;
            const dx = playerPos.x - demonPos.x;
            const dz = playerPos.z - demonPos.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < 3.5) { // Much larger collision radius
                // Calculate push direction and strength
                const pushDir = new THREE.Vector3(dx, 0, dz).normalize();
                const pushStrength = 1.0; // Much stronger push
                
                // Push player away from demon
                this.player.camera.position.add(pushDir.multiplyScalar(pushStrength));
                
                // If this is during a charge attack, apply damage
                if (this.state === 'CHARGING') {
                    this.player.takeDamage(25);
                    console.log("Charge hit player!");
                }
            }
        }

         // State-based behavior
         switch (this.state) {
            case 'IDLE':
                 // If finished turning, wait for timer
                 if (!this.isTurning && this.chargeWaitTimer > 0) {
                    this.chargeWaitTimer -= deltaTime;
                     if (this.chargeWaitTimer <= 0) {
                         this.startCharge(); // Start next charge
                    }
                     // While waiting, look at player
                     this.lookAtPlayer();
                 } else if (this.isTurning) {
                     this.performTurn(deltaTime); // Continue turning
                 } else {
                     // Normal idle behavior (decide next attack)
                     this.decideNextAction(deltaTime);
                     this.lookAtPlayer(); // Look at player while idle/walking
                 }
                break;
            case 'WALKING':
                 // Could add simple wandering logic here if desired
                 // For now, just acts like IDLE for attack decisions
                this.decideNextAction(deltaTime);
                 this.lookAtPlayer();
                break;
            case 'CHARGING':
                this.performCharge(deltaTime);
                // Collision with player during charge is handled inside performCharge
                break;
             case 'ATTACKING_FIREBALL':
             case 'ATTACKING_SPAWN':
             case 'HIT':
                 // Actions handled by animation completion or initial trigger
                 // Ensure demon still looks at player during these short actions
                 this.lookAtPlayer();
                 break;
        }
    }

     decideNextAction(deltaTime) {
         this.attackTimer -= deltaTime;
         if (this.attackTimer <= 0 && !this.isTurning) {
            // Get distance to player to make decisions
            const playerPos = this.player.getPosition();
            const distanceToPlayer = this.model.position.distanceTo(playerPos);
            
            // Different attack patterns based on distance
            if (distanceToPlayer < 5) {
                // Close range: Prefer charging
                const rand = Math.random();
                if (rand < 0.7) { // 70% chance to charge when close
                    if (this.chargeWaitTimer <= 0) {
                        this.startCharge();
                    } else {
                        this.shootFireball(); // Fallback to fireball if can't charge
                    }
                } else {
                    this.spawnFire(); // 30% chance to spawn fire when close
                }
            } else if (distanceToPlayer < 15) {
                // Medium range: Mix of all attacks
                const rand = Math.random();
                if (rand < 0.4) { // 40% chance to shoot fireball
                    this.shootFireball();
                } else if (rand < 0.7) { // 30% chance to charge
                    if (this.chargeWaitTimer <= 0) {
                        this.startCharge();
                    }
                } else { // 30% chance to spawn fire
                    this.spawnFire();
                }
            } else {
                // Long range: Prefer ranged attacks
                const rand = Math.random();
                if (rand < 0.7) { // 70% chance to shoot fireball
                    this.shootFireball();
                } else { // 30% chance to spawn fire
                    this.spawnFire();
                }
            }
            
            // Reset timer after choosing an action (charge handles its own timing)
            if (this.state !== 'CHARGING') {
                this.attackTimer = this.attackCooldown * (0.8 + Math.random() * 0.4); // Reset with slight randomness
            }
         }
     }

    lookAtPlayer() {
        if (this.model && this.player && this.state !== 'CHARGING' && !this.isTurning) { // Don't override charge lookAt or turning logic
            const playerPos = this.player.getPosition();
            const targetPos = playerPos.clone();
            targetPos.y = this.model.position.y; // Look at player on the same horizontal plane
            this.model.lookAt(targetPos);
        }
    }

    getPosition() {
        return this.model ? this.model.position : new THREE.Vector3();
    }
}