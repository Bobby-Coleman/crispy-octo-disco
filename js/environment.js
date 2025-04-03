// js/environment.js

class Environment {
    constructor(scene, finalDialogAudio, flamesAudio) {
        this.scene = scene;
        this.playerBullets = [];
        this.demonBullets = [];
        this.fireHazards = [];
        this.player = null; // Add player reference
        this.finalDialog = finalDialogAudio; // Store final dialog audio
        this.flamesAudio = flamesAudio; // Store flames audio

        this.bulletSpeed = 15; // units per second
        this.bulletLifetime = 3; // seconds
        this.fireHazardLifetime = 10; // Increased from 3 to 10 seconds
        this.fireHazardDamage = 10;

        this.setupDungeon();
        this.setupDoor();
        
        // Load car crash models but keep them hidden initially
        this.loadCarCrashModels();
    }

    // Add method to set player reference
    setPlayer(player) {
        this.player = player;
    }

    setupDungeon() {
        const roomSize = 30;
        const wallHeight = 5;

        // Floor - dark red to match walls and ceiling
        const floorGeometry = new THREE.PlaneGeometry(roomSize, roomSize);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B0000, // Dark red color (matching walls)
            side: THREE.DoubleSide,
            roughness: 0.8 // Make it slightly less reflective than walls
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2; // Rotate to lay flat
        floor.position.y = 0; // Place at ground level
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Walls (medium-dark red color)
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B0000 }); // Dark red color
        const wallThickness = 0.5;

        // Wall geometries
        const wallNSGeometry = new THREE.BoxGeometry(roomSize, wallHeight, wallThickness);
        const wallEWGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, roomSize);

        // Wall positions
        const wallsData = [
            { geometry: wallNSGeometry, position: [0, wallHeight / 2, -roomSize / 2] }, // Back
            { geometry: wallNSGeometry, position: [0, wallHeight / 2, roomSize / 2] },  // Front
            { geometry: wallEWGeometry, position: [-roomSize / 2, wallHeight / 2, 0] }, // Left
            { geometry: wallEWGeometry, position: [roomSize / 2, wallHeight / 2, 0] }   // Right
        ];

        wallsData.forEach(data => {
            const wall = new THREE.Mesh(data.geometry, wallMaterial);
            wall.position.set(...data.position);
            wall.castShadow = true;
            wall.receiveShadow = true;
            this.scene.add(wall);
        });

        // Ceiling (medium-dark red color, matching walls)
        const ceilingGeometry = new THREE.PlaneGeometry(roomSize, roomSize);
        const ceilingMaterial = new THREE.MeshStandardMaterial({ color: 0x8B0000, side: THREE.DoubleSide }); // Dark red color
        const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
        ceiling.rotation.x = Math.PI / 2; // Rotate to lay flat as ceiling
        ceiling.position.y = wallHeight; // Place at top of walls
        ceiling.receiveShadow = true;
        this.scene.add(ceiling);

        // Basic Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        // Configure shadow map size for better quality
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        directionalLight.shadow.bias = -0.0001;
        this.scene.add(directionalLight);
    }

    setupDoor() {
        // Create a larger, more portal-like door
        const doorGeometry = new THREE.BoxGeometry(3, 4, 0.2);
        const doorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x00ff00,
            transparent: true,
            opacity: 0.7,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });
        this.door = {
            mesh: new THREE.Mesh(doorGeometry, doorMaterial)
        };
        // Position the portal in the back area of the red room
        this.door.mesh.position.set(0, 2, -10); // Centered, floating, back area
        this.door.mesh.visible = false;
        
        // Add a pulsing animation to make it more portal-like
        const animate = () => {
            if (this.door.mesh && this.door.mesh.visible) {
                const pulseScale = 1 + 0.1 * Math.sin(Date.now() * 0.003);
                this.door.mesh.scale.set(pulseScale, pulseScale, 1);
                this.door.mesh.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(Date.now() * 0.002);
                requestAnimationFrame(animate);
            }
        };
        animate();

        this.scene.add(this.door.mesh);
    }

    createPlayerBullet(startPosition, direction) {
        const geometry = new THREE.SphereGeometry(0.1, 8, 8); // Smaller radius as per spec update
        const material = new THREE.MeshBasicMaterial({ color: 0xffffff }); // White
        const bullet = {
            mesh: new THREE.Mesh(geometry, material),
            velocity: direction.clone().multiplyScalar(this.bulletSpeed),
            lifetime: this.bulletLifetime,
            isPlayerBullet: true
        };
        bullet.mesh.position.copy(startPosition);
        this.scene.add(bullet.mesh);
        this.playerBullets.push(bullet);
    }

    createDemonBullet(startPosition, direction) {
        const geometry = new THREE.SphereGeometry(0.3, 8, 8); // Red sphere
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 }); // Red
        const bullet = {
            mesh: new THREE.Mesh(geometry, material),
            velocity: direction.clone().multiplyScalar(this.bulletSpeed * 1.2), // 20% faster than player bullets
            lifetime: this.bulletLifetime,
            damage: 10, // Set damage to 10
            isDemonBullet: true
        };
        bullet.mesh.position.copy(startPosition);
        this.scene.add(bullet.mesh);
        this.demonBullets.push(bullet);
    }

    createFireHazard(position, size = 1.0, damage = 10) {
        // Play flames sound
        if (this.flamesAudio) {
            this.flamesAudio.currentTime = 0;
            this.flamesAudio.play();
        }

        // Size parameter controls the width/depth of the fire hazard
        const geometry = new THREE.BoxGeometry(size, 1.0, size); // Increased height for better visibility
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff4500, // Brighter orange/red
            emissive: 0xff2000,
            emissiveIntensity: 1.0, // Increased intensity
            transparent: true,
            opacity: 0.8 // Increased opacity
        });
        
        const hazard = {
             mesh: new THREE.Mesh(geometry, material),
             lifetime: this.fireHazardLifetime,
             damage: damage, // Use the provided damage value
             isFireHazard: true,
             size: size // Store size for potential collision optimization
        };
        
        hazard.mesh.position.copy(position);
        hazard.mesh.position.y = 0.5; // Raised slightly higher
        hazard.mesh.castShadow = true;
        
        // Add particle effect for fire (simple animation)
        const animate = () => {
            if (hazard.mesh && hazard.mesh.parent) {
                // Pulsate the fire
                const scale = 0.9 + 0.2 * Math.sin(Date.now() * 0.01);
                hazard.mesh.scale.y = scale;
                requestAnimationFrame(animate);
            }
        };
        animate();
        
        this.scene.add(hazard.mesh);
        this.fireHazards.push(hazard);
    }

    openDoor() {
        console.log("Opening portal..."); // Debug log
        if (this.door && this.door.mesh) {
            this.door.mesh.visible = true;
            // Portal effect is handled by the animation in setupDoor
        }
    }

    update(deltaTime) {
        // Update and remove bullets
        this.updateProjectiles(this.playerBullets, deltaTime);
        this.updateProjectiles(this.demonBullets, deltaTime);

        // Update and remove fire hazards
        this.updateHazards(this.fireHazards, deltaTime);

        // Check if player is touching the portal
        if (this.door && this.door.mesh && this.door.mesh.visible && this.player) {
            const playerPos = this.player.getPosition();
            if (playerPos) {  // Make sure we have a valid position
                const portalPos = this.door.mesh.position;
                const dx = playerPos.x - portalPos.x;
                const dy = playerPos.y - portalPos.y;
                const dz = playerPos.z - portalPos.z;
                const distanceToPortal = Math.sqrt(dx * dx + dy * dy + dz * dz);

                // If player is close enough to the portal, transition to level 2
                if (distanceToPortal < 2) {
                    this.transitionToLevel2();
                }
            }
        }
    }

    updateProjectiles(bulletArray, deltaTime) {
        for (let i = bulletArray.length - 1; i >= 0; i--) {
            const bullet = bulletArray[i];
            bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(deltaTime));
            bullet.lifetime -= deltaTime;

            if (bullet.lifetime <= 0) {
                this.scene.remove(bullet.mesh);
                bullet.mesh.geometry.dispose();
                bullet.mesh.material.dispose();
                bulletArray.splice(i, 1);
            }
        }
    }

     updateHazards(hazardArray, deltaTime) {
        for (let i = hazardArray.length - 1; i >= 0; i--) {
            const hazard = hazardArray[i];
            hazard.lifetime -= deltaTime;

            if (hazard.lifetime <= 0) {
                this.scene.remove(hazard.mesh);
                 hazard.mesh.geometry.dispose();
                 hazard.mesh.material.dispose();
                hazardArray.splice(i, 1);
            }
        }
    }

     removeBullet(bullet) {
        const arrays = [this.playerBullets, this.demonBullets];
        for (const arr of arrays) {
            const index = arr.indexOf(bullet);
            if (index > -1) {
                this.scene.remove(bullet.mesh);
                bullet.mesh.geometry.dispose();
                bullet.mesh.material.dispose();
                arr.splice(index, 1);
                return; // Found and removed
            }
        }
    }

     removeHazard(hazard) {
         const index = this.fireHazards.indexOf(hazard);
         if (index > -1) {
             this.scene.remove(hazard.mesh);
             hazard.mesh.geometry.dispose();
             hazard.mesh.material.dispose();
             this.fireHazards.splice(index, 1);
         }
     }

    loadCarCrashModels() {
        const loader = new THREE.GLTFLoader();
        
        // Load first car crash model
        loader.load(
            'models/car_crash.glb',
            (gltf) => {
                console.log('Car crash 1 loaded successfully');
                this.carCrash1 = gltf.scene;
                this.carCrash1.position.set(-2, 0, 0); // Slightly left of center
                this.carCrash1.scale.set(1, 1, 1);
                this.carCrash1.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });
                this.carCrash1.visible = false; // Start hidden
                this.scene.add(this.carCrash1);
            },
            undefined,
            (error) => console.error('Error loading car crash 1:', error)
        );

        // Load second car crash model
        loader.load(
            'models/car_crash_02.glb',
            (gltf) => {
                console.log('Car crash 2 loaded successfully');
                this.carCrash2 = gltf.scene;
                this.carCrash2.position.set(2, 0, 0); // Slightly right of center
                this.carCrash2.scale.set(1, 1, 1);
                this.carCrash2.traverse((node) => {
                    if (node.isMesh) {
                        node.castShadow = true;
                        node.receiveShadow = true;
                    }
                });
                this.carCrash2.visible = false; // Start hidden
                this.scene.add(this.carCrash2);
            },
            undefined,
            (error) => console.error('Error loading car crash 2:', error)
        );
    }

    transitionToLevel2() {
        // Hide the portal
        this.door.mesh.visible = false;

        // Reset player position to start of room
        this.player.camera.position.set(0, 1.6, 12);
        this.player.camera.lookAt(0, 1.6, 0);

        // Show car crash models
        if (this.carCrash1) this.carCrash1.visible = true;
        if (this.carCrash2) this.carCrash2.visible = true;

        // Play final dialog after 3 seconds
        if (this.finalDialog) {
            setTimeout(() => {
                this.finalDialog.play();
            }, 3000); // 3000 milliseconds = 3 seconds
        }
    }
}