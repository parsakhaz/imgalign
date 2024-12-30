<template>
  <div class="camera-capture">
    <div v-if="!showCamera" class="camera-start">
      <slot name="trigger-button"></slot>
    </div>

    <div v-if="showCamera" class="camera-container">
      <div class="camera-preview">
        <video 
          ref="video" 
          autoplay 
          playsinline 
          muted
          class="camera-video"
        ></video>
        <div class="camera-overlay">
          <div class="camera-guide">
            <div class="guide-top"></div>
            <div class="guide-text">Overlap your aisle photo by 30% with the previous photo</div>
            <div class="guide-bottom"></div>
          </div>
        </div>
        <div class="camera-actions">
          <button class="camera-action-btn capture" @click="capture">
            📸 Capture
          </button>
          <button class="camera-action-btn cancel" @click="close">
            ✕ Cancel
          </button>
        </div>
      </div>
      <canvas ref="canvas" style="display: none"></canvas>
    </div>

    <!-- Fallback for devices that don't support getUserMedia -->
    <input 
      v-if="!hasGetUserMedia"
      type="file"
      ref="fileInput"
      accept="image/*"
      capture="environment"
      style="display: none"
      @change="handleFileSelect"
    >
  </div>
</template>

<script>
export default {
  name: 'CameraCapture',
  data() {
    return {
      showCamera: false,
      stream: null,
      hasGetUserMedia: false,
      isMobile: false
    }
  },
  created() {
    // Check for getUserMedia support
    this.hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    // Check if mobile device
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  },
  methods: {
    async start() {
      if (!this.hasGetUserMedia) {
        this.$refs.fileInput.click();
        return;
      }

      try {
        // Get camera stream first
        const constraints = await this.getOptimalConstraints();
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Only show camera after we have the stream
        this.showCamera = true;
        await this.$nextTick();
        
        // Get video element after it's mounted
        const video = this.$refs.video;
        if (!video) {
          throw new Error('Video element not found');
        }
        
        video.srcObject = this.stream;
        video.muted = true;
        
        // Wait for video to be ready and playing
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.play()
              .then(() => {
                // Only try fullscreen after video is successfully playing
                if (this.isMobile) {
                  try {
                    const elem = document.documentElement;
                    if (elem.requestFullscreen) {
                      elem.requestFullscreen().then(resolve).catch(resolve);
                    } else {
                      resolve();
                    }
                  } catch (err) {
                    resolve(); // Continue if fullscreen fails
                  }
                } else {
                  resolve();
                }
              })
              .catch(reject);
          };
          video.onerror = reject;
        });
      } catch (err) {
        this.$emit('error', {
          name: err.name || 'CameraError',
          message: `Camera initialization failed: ${err.message || 'Unknown error'}`
        });
        this.close();
      }
    },
    async getOptimalConstraints() {
      const constraints = {
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1920 }
        },
        audio: false
      };

      if (this.isMobile) {
        // Use environment camera (back camera) on mobile
        constraints.video.facingMode = { exact: 'environment' };
        
        try {
          // Try to get supported capabilities
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter(device => device.kind === 'videoinput');
          
          if (cameras.length > 0) {
            // Try to get the back camera
            const backCamera = cameras.find(camera => 
              camera.label.toLowerCase().includes('back') || 
              camera.label.toLowerCase().includes('environment')
            );
            
            if (backCamera) {
              constraints.video.deviceId = { exact: backCamera.deviceId };
              
              // Try to get the capabilities of the back camera
              try {
                const track = await navigator.mediaDevices.getUserMedia({
                  video: { deviceId: { exact: backCamera.deviceId } }
                }).then(stream => stream.getVideoTracks()[0]);
                
                const capabilities = track.getCapabilities();
                track.stop();
                
                if (capabilities) {
                  // Set optimal resolution for vertical photos on mobile
                  if (capabilities.width && capabilities.height) {
                    constraints.video.width = { ideal: Math.min(capabilities.width.max, 1080) };
                    constraints.video.height = { ideal: Math.min(capabilities.height.max, 1920) };
                  }
                }
              } catch (err) {
                // Fall back to default constraints if capabilities check fails
              }
            }
          }
        } catch (err) {
          // Fall back to facingMode if device enumeration fails
        }
      } else {
        // On desktop, use any available camera
        constraints.video.facingMode = 'user';
      }

      return constraints;
    },
    close() {
      // Only close if we're actually showing the camera
      if (!this.showCamera) return;

      // Exit fullscreen first if we're in it
      try {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        }
      } catch (err) {
        // Ignore fullscreen exit errors
      }

      // Then stop the stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }

      // Finally hide the camera UI
      this.showCamera = false;
    },
    async capture() {
      const video = this.$refs.video;
      const canvas = this.$refs.canvas;
      
      // Set canvas size to match video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      
      // Handle device pixel ratio for better quality
      const ratio = window.devicePixelRatio || 1;
      if (ratio > 1) {
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';
        canvas.width *= ratio;
        canvas.height *= ratio;
        ctx.scale(ratio, ratio);
      }
      
      ctx.drawImage(video, 0, 0);
      
      try {
        // Use higher quality for JPEG encoding
        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/jpeg', 0.95);
        });
        
        const file = new File([blob], `photo_${Date.now()}.jpg`, { 
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        
        this.$emit('capture', file);
        this.close();
      } catch (err) {
        this.$emit('error', err);
      }
    },
    handleFileSelect(event) {
      if (event.target.files && event.target.files.length > 0) {
        const file = event.target.files[0];
        this.$emit('capture', file);
        event.target.value = ''; // Reset for reuse
      }
    }
  },
  beforeDestroy() {
    this.close();
  }
}
</script>

<style scoped>
.camera-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.camera-preview {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  max-height: 100vh;
}

.camera-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-guide {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
}

.guide-top, .guide-bottom {
  width: 100%;
  height: 60px;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(2px);
}

.guide-top {
  border-bottom-width: 4px;
  border-top: none;
}

.guide-bottom {
  border-top-width: 4px;
  border-bottom: none;
}

.guide-text {
  color: white;
  font-size: 1.2em;
  text-align: center;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  background: rgba(0, 0, 0, 0.5);
  padding: 15px 25px;
  border-radius: 25px;
  backdrop-filter: blur(5px);
}

.camera-actions {
  position: absolute;
  bottom: 40px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  gap: 20px;
  padding: 0 20px;
  z-index: 1001;
}

.camera-action-btn {
  padding: 15px 30px;
  border-radius: 30px;
  border: none;
  cursor: pointer;
  font-size: 1.2em;
  transition: transform 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.camera-action-btn.capture {
  background: #4CAF50;
  color: white;
  padding: 20px 40px;
}

.camera-action-btn.cancel {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  backdrop-filter: blur(5px);
}

/* Add responsive styles for different devices */
@media (max-width: 768px) {
  .guide-text {
    font-size: 1.1em;
    padding: 12px 20px;
  }

  .camera-action-btn {
    padding: 12px 24px;
    font-size: 1.1em;
  }

  .camera-action-btn.capture {
    padding: 15px 30px;
  }
}

/* Add support for notched devices */
@supports (padding: max(0px)) {
  .camera-container {
    padding-top: max(0px, env(safe-area-inset-top));
    padding-bottom: max(0px, env(safe-area-inset-bottom));
    padding-left: max(0px, env(safe-area-inset-left));
    padding-right: max(0px, env(safe-area-inset-right));
  }
}

/* Mobile-specific styles */
@media (max-width: 768px) {
  .camera-video {
    object-fit: contain;
    max-height: 100vh;
    width: auto;
  }

  .camera-guide {
    width: 80%; /* Narrower guide on mobile */
    max-width: 300px;
    height: 70vh; /* Taller guide for vertical photos */
  }

  .guide-top, .guide-bottom {
    height: 80px; /* Larger overlap guides on mobile */
  }

  .guide-text {
    font-size: 1em;
    padding: 10px 15px;
    max-width: 250px;
  }

  .camera-actions {
    bottom: 20px;
    gap: 15px;
  }

  .camera-action-btn {
    padding: 12px 24px;
    font-size: 1em;
  }

  .camera-action-btn.capture {
    padding: 15px 30px;
  }
}

/* Portrait mode specific styles */
@media (max-width: 768px) and (orientation: portrait) {
  .camera-preview {
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }

  .camera-guide {
    height: 80vh;
  }
}

/* Landscape mode specific styles */
@media (max-width: 768px) and (orientation: landscape) {
  .camera-guide {
    width: 70%;
    height: 60vh;
  }

  .camera-actions {
    bottom: 10px;
  }
}
</style> 