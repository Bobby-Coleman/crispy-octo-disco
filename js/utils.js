// js/utils.js

const Utils = {
    // --- Sound Generation ---
    audioContext: null,

    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    },

    playSound(type) {
        const ctx = this.getAudioContext();
        if (!ctx) return;

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        let freq = 440, duration = 0.1, waveType = 'sine';
        let freqEnd = freq; // For sweeps

        switch (type) {
            case 'shoot': // High beep
                freq = 800;
                duration = 0.05; // Shorter
                waveType = 'triangle';
                gainNode.gain.setValueAtTime(0.3, ctx.currentTime); // Quieter
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
                break;
            case 'roar': // Oscillating tone (simulate with frequency ramp)
                freq = 200;
                freqEnd = 300;
                duration = 0.5;
                waveType = 'sawtooth';
                gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
                oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
                oscillator.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration * 0.5);
                oscillator.frequency.linearRampToValueAtTime(freq, ctx.currentTime + duration);
                 gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
                break;
            case 'damage': // Low pulse
                freq = 150;
                duration = 0.2;
                waveType = 'square';
                gainNode.gain.setValueAtTime(0.6, ctx.currentTime);
                 gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
                break;
            case 'fireball': // Rising/falling tone
                freq = 400;
                freqEnd = 600;
                 duration = 0.3;
                 waveType = 'sine';
                 gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
                 oscillator.frequency.setValueAtTime(freq, ctx.currentTime);
                 oscillator.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration * 0.5);
                 oscillator.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + duration);
                 gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
                break;
            default:
                 gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
                 gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
        }

        oscillator.type = waveType;
        oscillator.frequency.setValueAtTime(freq, ctx.currentTime); // Set initial frequency

        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + duration);
    },

    // --- Collision Detection (AABB) ---
    // Assumes objects have a mesh property and computes AABB on the fly.
    // For better performance, cache bounding boxes if geometry doesn't change.
    checkCollision(object1, object2) {
        if (!object1.mesh || !object2.mesh) return false;

        // Ensure matrices are updated
        object1.mesh.updateMatrixWorld();
        object2.mesh.updateMatrixWorld();

        const box1 = new THREE.Box3().setFromObject(object1.mesh);
        const box2 = new THREE.Box3().setFromObject(object2.mesh);

        return box1.intersectsBox(box2);
    },

     // Simplified check for point (e.g., player center) vs AABB object
     checkPointCollision(pointVec3, objectWithMesh) {
        if (!objectWithMesh.mesh) return false;
        objectWithMesh.mesh.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(objectWithMesh.mesh);
        return box.containsPoint(pointVec3);
    },

    // Check collision between a THREE.Object3D and an array of objects with meshes
    checkCollisionWithArray(singleObject, objectArray) {
        if (!singleObject.mesh) return null; // Or handle differently if singleObject isn't mesh-based

        singleObject.mesh.updateMatrixWorld();
        const box1 = new THREE.Box3().setFromObject(singleObject.mesh);

        for (let i = 0; i < objectArray.length; i++) {
            const obj2 = objectArray[i];
            if (obj2 && obj2.mesh) {
                 obj2.mesh.updateMatrixWorld();
                const box2 = new THREE.Box3().setFromObject(obj2.mesh);
                if (box1.intersectsBox(box2)) {
                    return obj2; // Return the object collided with
                }
            }
        }
        return null; // No collision
    },

     // Check collision between a point and an array of objects with meshes
    checkPointCollisionWithArray(pointVec3, objectArray) {
        for (let i = 0; i < objectArray.length; i++) {
            const obj = objectArray[i];
             if (obj && obj.mesh) {
                obj.mesh.updateMatrixWorld();
                const box = new THREE.Box3().setFromObject(obj.mesh);
                if (box.containsPoint(pointVec3)) {
                    return obj; // Return the object collided with
                }
             }
        }
        return null; // No collision
    }
};