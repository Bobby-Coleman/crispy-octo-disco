// js/player.js

class Player {
    constructor(scene, camera, initialPos, environment, bulletAudio, gruntAudio) {
        this.scene = scene;
        this.camera = camera;
        this.environment = environment; // Reference to environment for bullet handling
        this.bulletAudio = bulletAudio; // Store bullet sound
        this.gruntAudio = gruntAudio; // Store grunt sound

        this.health = 100;
        this.maxHealth = 100;
        this.isDead = false;

        this.moveSpeed = 5; // units per second
        this.turnSpeed = 2; // radians per second (for keyboard/joystick turning)
        this.mouseSensitivity = 0.002;

        // Movement state
        this.moveState = { forward: 0, backward: 0, left: 0, right: 0 }; // 0 or 1
        this.velocity = new THREE.Vector3();
        this.rotation = new THREE.Euler(0, 0, 0, 'YXZ'); // Use YXZ order for FPS controls

        // Shooting state
        this.canShoot = true;
        this.shootCooldown = 0.2; // seconds between shots
        this.shootTimer = 0;

        // Positioning
        this.camera.position.copy(initialPos);
        this.camera.position.y = 1.6; // Eye level height

        // Mobile Controls State
        this.isMobile = false;
        this.moveJoystick = null;
        this.lookJoystick = null;
        this.joystickMoveVector = new THREE.Vector2();
        this.joystickLookVector = new THREE.Vector2();

        // Pointer Lock (Desktop)
        this.isPointerLocked = false;

        // Player representation (optional, for collision)
        // You could add a simple capsule or box mesh here if needed for 3rd person or better collision viz
        // For now, collisions will be checked against camera position or a small sphere around it.
        this.collisionRadius = 0.5; // Radius for collision checks centered on camera base

        this.isInvulnerable = false;
        this.invulnerabilityDuration = 2000; // 2 seconds in milliseconds

        this.updateHealthUI();
    }

    setupDesktopControls() {
        this.isMobile = false;
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mousedown', this.onMouseDown.bind(this));

        // Pointer Lock API
        document.body.addEventListener('click', () => {
            if (!this.isPointerLocked && !this.isMobile) { // Don't lock on mobile
                document.body.requestPointerLock();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === document.body;
            document.getElementById('crosshair').style.display = this.isPointerLocked ? 'block' : 'none';
        }, false);

        // Hide crosshair initially until pointer lock
         document.getElementById('crosshair').style.display = 'none';
    }

    // Placeholder for Point-and-Click - requires UI arrows and different logic
    // setupPointAndClickControls() {
    //     console.warn("Point-and-click controls not fully implemented.");
    //     // Add listeners for on-screen arrow buttons
    //     // Add mouse listener for aiming (similar to onMouseMove)
    //     // Add click listener for shooting
    // }

    setupMobileControls(joystickZoneLeft, joystickZoneRight) {
        this.isMobile = true;
        document.getElementById('crosshair').style.display = 'block'; // Show crosshair on mobile
         joystickZoneLeft.style.display = 'block';
         joystickZoneRight.style.display = 'block';

        const optionsLeft = {
            zone: joystickZoneLeft,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'grey',
            size: 100
        };
         const optionsRight = {
            zone: joystickZoneRight,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'grey',
            size: 100
        };

        this.moveJoystick = nipplejs.create(optionsLeft);
        this.lookJoystick = nipplejs.create(optionsRight);

        this.moveJoystick.on('move', (evt, data) => {
            if (data.vector) {
                this.joystickMoveVector.set(data.vector.x, data.vector.y);
            }
        }).on('end', () => {
            this.joystickMoveVector.set(0, 0);
        });

        this.lookJoystick.on('move', (evt, data) => {
             if (data.vector) {
                 this.joystickLookVector.set(data.vector.x, data.vector.y);
                 // Trigger shoot on right joystick tap/flick? Or require separate button?
                 // Simple tap-to-shoot: Check if distance is small and movement ends quickly
                 if (!this.isShootingOnTap && data.distance > 10) { // Threshold to detect intentional aim vs tap
                      this.isAiming = true;
                 }
            }
        }).on('end', () => {
            // If the joystick moved very little, consider it a tap-to-shoot
             if (!this.isAiming) { // Only shoot if not aiming
                 this.shoot();
             }
             this.joystickLookVector.set(0, 0);
             this.isAiming = false; // Reset aiming flag
        });

        // Alternative: Simple tap anywhere on screen to shoot (might conflict with joysticks)
        // document.body.addEventListener('touchstart', (e) => {
        //     // Avoid triggering shoot if touch is on joysticks
        //     if (e.target !== joystickZoneLeft && e.target !== joystickZoneRight &&
        //         !joystickZoneLeft.contains(e.target) && !joystickZoneRight.contains(e.target)) {
        //         this.shoot();
        //     }
        // });
    }

    onKeyDown(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.moveState.forward = 1; break;
            case 'KeyS': case 'ArrowDown': this.moveState.backward = 1; break;
            case 'KeyA': case 'ArrowLeft': this.moveState.left = 1; break;
            case 'KeyD': case 'ArrowRight': this.moveState.right = 1; break;
        }
    }

    onKeyUp(event) {
        switch (event.code) {
            case 'KeyW': case 'ArrowUp': this.moveState.forward = 0; break;
            case 'KeyS': case 'ArrowDown': this.moveState.backward = 0; break;
            case 'KeyA': case 'ArrowLeft': this.moveState.left = 0; break;
            case 'KeyD': case 'ArrowRight': this.moveState.right = 0; break;
        }
    }

    onMouseMove(event) {
        if (!this.isPointerLocked && !this.isMobile) return; // Only rotate if pointer is locked or on mobile

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.rotation.y -= movementX * this.mouseSensitivity;
        this.rotation.x -= movementY * this.mouseSensitivity;

        // Clamp vertical rotation to prevent camera flipping
        this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));

        this.camera.rotation.copy(this.rotation); // Apply rotation directly
    }

     onMouseDown(event) {
        if (event.button === 0 && (this.isPointerLocked || !this.isMobile)) { // Left mouse button
             this.shoot();
        }
     }

    shoot() {
        if (this.canShoot && !this.isDead) {
            // Play bullet sound
            if (this.bulletAudio) {
                this.bulletAudio.currentTime = 0; // Rewind sound if already playing
                this.bulletAudio.play().catch(error => console.error("Error playing player bullet sound:", error));
            }
            
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);

             // Bullet origin slightly in front of camera
            const startPos = this.camera.position.clone().add(direction.multiplyScalar(0.5));
             startPos.y -= 0.1; // Adjust vertical start slightly

            this.environment.createPlayerBullet(startPos, direction); // Use environment to manage bullets
            this.canShoot = false;
            this.shootTimer = this.shootCooldown;
        }
    }

    takeDamage(amount) {
        if (this.isDead || this.isInvulnerable) return;

        // Play grunt sound
        if (this.gruntAudio) {
            this.gruntAudio.currentTime = 0; // Rewind
            this.gruntAudio.play().catch(error => console.error("Error playing player grunt sound:", error));
        }

        this.health = Math.max(0, this.health - amount);
        this.updateHealthUI();
        console.log(`Player took ${amount} damage. Health: ${this.health}`);

        // Create red flash overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '1000';
        overlay.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(overlay);

        // Remove overlay after animation
        setTimeout(() => {
            overlay.style.opacity = '0';
            setTimeout(() => document.body.removeChild(overlay), 300);
        }, 100);

        if (this.health <= 0) {
            this.die();
            return;
        }

        // Invulnerability period
        this.isInvulnerable = true;
        setTimeout(() => {
            this.isInvulnerable = false;
        }, this.invulnerabilityDuration);
    }

    die() {
        this.isDead = true;
        console.log("Player Died!");
        // Optional: Add game over logic, screen fade, etc.
         // For now, just stops player actions
         if (this.isPointerLocked) {
             document.exitPointerLock();
         }
         // You might want to show a "Game Over" message or restart option
          const victoryMessage = document.getElementById('victory-message');
         if (victoryMessage) {
             victoryMessage.textContent = "GAME OVER";
             victoryMessage.style.color = "red";
             victoryMessage.style.display = 'block';
         }
    }

     updateHealthUI() {
        const healthPercentage = (this.health / this.maxHealth) * 100;
        const healthFill = document.getElementById('player-health-fill');
        const healthValue = document.getElementById('player-health-value');
        if (healthFill) healthFill.style.width = `${healthPercentage}%`;
        if(healthValue) healthValue.textContent = Math.max(0, Math.ceil(this.health)); // Show integer health
    }

    update(deltaTime) {
        if (this.isDead) return;

        // Update shoot timer
        if (this.shootTimer > 0) {
            this.shootTimer -= deltaTime;
            if (this.shootTimer <= 0) {
                this.canShoot = true;
            }
        }

        // Check for demon bullet collisions
        for (let bullet of this.environment.demonBullets) {
            const bulletPos = bullet.mesh.position;
            const dx = bulletPos.x - this.camera.position.x;
            const dy = Math.abs(bulletPos.y - (this.camera.position.y - 0.8)); // Check against body center
            const dz = bulletPos.z - this.camera.position.z;
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            
            // More lenient collision check with larger radius
            if (horizontalDist < 1.5 && dy < 2.0) { // Increased collision radius
                console.log("Player hit by demon bullet! Damage:", bullet.damage);
                this.takeDamage(bullet.damage);
                this.environment.removeBullet(bullet);
                break;
            }
        }

        // Calculate movement direction
        const moveDirection = new THREE.Vector3();
        if (this.isMobile) {
            // Mobile Joystick Movement
             moveDirection.z += this.joystickMoveVector.y; // Forward/Backward from Y-axis
             moveDirection.x += this.joystickMoveVector.x; // Strafe from X-axis
             moveDirection.normalize(); // Ensure consistent speed regardless of angle

             // Mobile Joystick Looking (Rotation)
             const lookSensitivity = this.turnSpeed * 0.5; // Adjust sensitivity for touch
             this.rotation.y -= this.joystickLookVector.x * lookSensitivity * deltaTime;
             this.rotation.x -= this.joystickLookVector.y * lookSensitivity * deltaTime;
             this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.rotation.x));
             this.camera.rotation.copy(this.rotation);

        } else {
            // Desktop WASD Movement - Fixed W/S direction
            // In THREE.js, negative Z is forward (into the screen)
            moveDirection.z = -(this.moveState.forward - this.moveState.backward); 
            moveDirection.x = this.moveState.right - this.moveState.left;
            
            if (moveDirection.lengthSq() > 0) {
                moveDirection.normalize(); // Normalize only if there's input
            }
        }


         // Apply movement relative to camera direction
         if (moveDirection.lengthSq() > 0) { // Only move if there's input
             const moveQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.rotation.y, 0)); // Use only Y rotation for movement direction
             moveDirection.applyQuaternion(moveQuaternion);
             this.velocity.copy(moveDirection).multiplyScalar(this.moveSpeed * deltaTime);
             this.camera.position.add(this.velocity);
         }


        // Basic Collision Check (player vs environment elements) - Check against hazards/bullets
        const playerCenterPos = this.camera.position.clone();
        playerCenterPos.y -= 0.8; // Check collision near the player's feet/center mass

        // Check collision with demon bullets
        const demonBulletCollision = Utils.checkPointCollisionWithArray(playerCenterPos, this.environment.demonBullets);
        if (demonBulletCollision) {
            this.takeDamage(demonBulletCollision.damage);
            this.environment.removeBullet(demonBulletCollision); // Remove bullet on hit
        }

         // Check collision with fire hazards
         const fireHazardCollision = Utils.checkPointCollisionWithArray(playerCenterPos, this.environment.fireHazards);
        if (fireHazardCollision) {
            // Apply flat damage when hitting fire (not scaled by deltaTime)
            // Apply full 10 damage each time
            console.log(`Player in fire! Taking ${fireHazardCollision.damage} damage.`);
            this.takeDamage(fireHazardCollision.damage);
            
            // Visual feedback when in fire
            if (!this.isInvulnerable) {
                // Show fire warning message
                const fireWarning = document.getElementById('fire-warning');
                if (fireWarning) {
                    fireWarning.style.display = 'block';
                    // Hide after a short delay
                    clearTimeout(this.fireWarningTimeout);
                    this.fireWarningTimeout = setTimeout(() => {
                        fireWarning.style.display = 'none';
                    }, 500);
                }
                
                // Flash the screen red briefly for fire damage feedback
                const overlay = document.createElement('div');
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
                overlay.style.pointerEvents = 'none';
                overlay.style.zIndex = '1000';
                document.body.appendChild(overlay);
                
                // Remove after a short time
                setTimeout(() => {
                    document.body.removeChild(overlay);
                }, 100);
            }
        }

        // Keep player within bounds (simple clamp) - Adjust bounds as needed
        const roomBounds = 14.5;
        this.camera.position.x = Math.max(-roomBounds, Math.min(roomBounds, this.camera.position.x));
        this.camera.position.z = Math.max(-roomBounds, Math.min(roomBounds, this.camera.position.z));
        this.camera.position.y = 1.6; // Keep eye height constant
    }

    getPosition() {
        return this.camera.position;
    }
}