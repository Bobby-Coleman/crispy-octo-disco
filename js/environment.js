// js/environment.js

class Environment {
    constructor(scene) {
        this.scene = scene;
        this.playerBullets = [];
        this.demonBullets = [];
        this.fireHazards = [];

        this.bulletSpeed = 15; // units per second
        this.bulletLifetime = 3; // seconds
        this.fireHazardLifetime = 10; // Increased from 3 to 10 seconds
        this.fireHazardDamage = 10;

        this.setupDungeon();
        this.setupDoor();
    }

    setupDungeon() {
        const roomSize = 30;
        const wallHeight = 5;

        // Floor
        const floorGeometry = new THREE.PlaneGeometry(roomSize, roomSize);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x808080, side: THREE.DoubleSide });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2; // Rotate to lay flat
        floor.position.y = 0; // Place at ground level
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Walls (simple boxes)
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x606060 });
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
        const doorGeometry = new THREE.BoxGeometry(2, 3, 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Green
        this.door = {
            mesh: new THREE.Mesh(doorGeometry, doorMaterial)
        };
        this.door.mesh.position.set(0, 1.5, -14.9); // Positioned at the back wall, initially hidden/closed
        this.door.mesh.visible = false; // Start hidden
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
        if (this.door && this.door.mesh) {
            this.door.mesh.visible = true;
            // Optional: Add animation later (e.g., sliding)
        }
         const victoryMessage = document.getElementById('victory-message');
        if(victoryMessage) victoryMessage.style.display = 'block';
    }

    update(deltaTime) {
        // Update and remove bullets
        this.updateProjectiles(this.playerBullets, deltaTime);
        this.updateProjectiles(this.demonBullets, deltaTime);

        // Update and remove fire hazards
        this.updateHazards(this.fireHazards, deltaTime);
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
}