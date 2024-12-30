<template>
  <div class="stitcher">
    <h1>Store Aisle Scanner</h1>
    
    <!-- Camera Component (always mounted but hidden until activated) -->
    <app-camera-capture
      ref="camera"
      @capture="handleCameraCapture"
      @error="handleCameraError"
    />

    <div class="instructions">
      <h3>How to capture an aisle:</h3>
      <ol>
        <li>Stand at one end of the aisle</li>
        <li>Click "Take Photo" and capture the first section</li>
        <li>Move a few steps down the aisle (make sure sections overlap)</li>
        <li>Repeat until you reach the end</li>
        <li>Click "Create Panorama" to combine all photos</li>
      </ol>
    </div>

    <div class="main-actions">
      <!-- Primary Action: Take Photo -->
      <button 
        class="primary-btn"
        @click="startCamera"
        :disabled="$store.getters['worker/busyCompute']"
      >
        <span class="btn-icon">📸</span>
        Take Photo
      </button>

      <!-- Secondary Action: Upload -->
      <button 
        class="secondary-btn"
        @click="openFileSelector"
        :disabled="$store.getters['worker/busyCompute']"
      >
        <span class="btn-icon">📁</span>
        Upload from Gallery
      </button>

      <input 
        type="file"
        ref="fileInput"
        accept="image/*"
        multiple
        style="display: none"
        @change="handleFileSelect"
      >
      </div>
      
    <!-- Photo Counter -->
    <div class="photo-status" v-if="$store.getters['multiInput/imageCount'] > 0">
      <span class="photo-count">{{ $store.getters['multiInput/imageCount'] }} photos taken</span>
      <div class="photo-actions">
        <button 
          v-if="$store.getters['multiInput/indicesSelected'].length > 0"
          class="action-btn delete-btn"
          @click="deleteSelectedInputImages"
        >
          <span class="btn-icon">✕</span>
          Delete Selected
        </button>
        <button 
          class="action-btn delete-btn"
          @click="deleteAllOrSelectedInputImages"
          :disabled="$store.getters['multiInput/imageCount'] === 0"
        >
          <span class="btn-icon">🗑️</span>
          Clear All
        </button>
      </div>
    </div>
      
    <!-- Photo Preview Area -->
    <div class="photos-area">
      <div v-if="$store.getters['multiInput/imageCount'] === 0" class="empty-state">
        <p>No photos taken yet</p>
        <p class="tip">Stand in the center of the aisle for best results</p>
      </div>

      <app-multi-input-images
        v-else
        :imageUrlArray="$store.getters['multiInput/imageDataUrlsArray']"
        :imageKeyArray="$store.getters['multiInput/imageDataKeyArray']"
        :fieldOfViewArray="$store.getters['multiInput/imageFieldOfViewArray']"
        :indicesSelected="$store.getters['multiInput/indicesSelected']"
        @imageClicked="index => $store.commit('multiInput/imageClicked', index)"
        @swap="swapImagesInputImages"
      />

      <p class="tip" v-if="$store.getters['multiInput/imageCount'] > 0">
        ✨ Tip: Make sure each photo overlaps with the previous one
      </p>
    </div>

    <!-- Create Panorama Button -->
    <div class="panorama-action" v-if="$store.getters['multiInput/imageCount'] > 1">
      <button 
        class="primary-btn create-btn"
        @click="multiStitch"
        :disabled="$store.getters['worker/busyCompute']"
      >
        <span class="btn-icon">🔄</span>
        Create Panorama
      </button>
    </div>

    <!-- Result Area -->
    <div v-if="resultValid" class="result-container">
      <h3>Your Stitched Panorama:</h3>
      <app-image-result
        :image-url="$store.getters['worker/results/imageDataUrl'](multiStitchName)"
        :image-name="multiStitchName"
        :canDrag="false"
      />
      <div class="result-actions">
        <button 
          class="primary-btn save-btn"
          @click="saveImage"
        >
          <span class="btn-icon">💾</span>
          Save Panorama
        </button>
      </div>
    </div>

    <!-- History Section -->
    <div class="history-section">
      <h3>Previous Panoramas</h3>
      <div v-if="history.length === 0" class="empty-history">
        <p class="tip">No previous panoramas yet</p>
      </div>
      <div v-else class="history-items">
        <div v-for="item in history" :key="item.id" class="history-item">
          <div class="history-timestamp">{{ item.timestamp }}</div>
          <div class="history-images">
            <div class="source-images">
              <img 
                v-for="(src, index) in item.sourceImages" 
                :key="index"
                :src="src"
                class="source-image"
                alt="Source image"
              />
            </div>
            <div class="result-image">
              <img :src="item.imageUrl" alt="Panorama result" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="$store.getters['worker/error']" class="error-container">
      <p>❌ {{ friendlyErrorMessage }}</p>
      <p class="error-tip">Try making sure your photos have enough overlap and are in the correct order.</p>
    </div>
  </div>
</template>

<script>
import MultiInputImages from '@/components/common/MultiInputImages';
import ImageResult from '@/components/common/ImageResult';
import CameraCapture from '@/components/common/CameraCapture';
import { multiStitchName } from '@/models/constants/images';
import { paramTypes, ParamUtils } from '@/models/constants/params';

export default {
  name: 'MultiStitcher',
  components: {
    'AppImageResult': ImageResult,
    'AppMultiInputImages': MultiInputImages,
    'AppCameraCapture': CameraCapture,
  },
  created() {
    this.$store.dispatch('multiInput/init');
    this.$store.dispatch('worker/load');
    this.loadHistoryFromStorage();
  },
  computed: {
    multiStitchName() {
      return multiStitchName;
    },
    selectedIndices() {
      return this.$store.getters['multiInput/indicesSelected'];
    },
    fieldOfView() {
      return this.selectedIndices.length > 0
        ? this.$store.getters['multiInput/imageFieldOfView'](this.selectedIndices[0]) + ''
        : '';
    },
    fieldOfViewDefaultValue() {
      return this.selectedIndices.length > 0
        ? this.$store.getters['multiInput/imageFieldOfViewInitial'](this.selectedIndices[0]) + ''
        : '';
    },
    resultValid() {
      return this.$store.getters['worker/results/imageDataValid'](multiStitchName);
    },
    errorText() {
      const e = this.$store.getters['worker/error'];
      if(e && e.message) return e.message;
      return 'No match found!';
    },
    detTypeName() {
      return ParamUtils.getParamName(this.$store.getters['settings/param'](paramTypes.detType.id));
    },
    camEstimationOn() {
      return this.$store.getters['settings/param'](paramTypes.multiStitch_camEstimate.id);
    },
    friendlyErrorMessage() {
      const e = this.$store.getters['worker/error'];
      if(e && e.message) {
        if(e.message.includes('No match found')) {
          return 'Could not connect the photos together. Try taking photos with more overlap between them.';
        }
        return e.message;
      }
      return 'Something went wrong. Please try again.';
    }
  },
  data() {
    return {
      history: []
    }
  },
  methods: {
    async multiStitch() {
      await this.$store.dispatch('multiInput/reloadFilesFromDiscIf');
      await this.$store.dispatch(
        'worker/computeMultiStitchImageInSteps', {
          images: this.$store.getters['multiInput/imageDataArray'],
          fieldsOfView: this.$store.getters['multiInput/imageFieldOfViewArray'],
          settings: this.$store.getters['settings/settings']
        }
      );
      
      // After successful stitch, save to history
      if (this.$store.getters['worker/results/imageDataValid'](multiStitchName)) {
        const panorama = {
          id: Date.now(),
          imageUrl: this.$store.getters['worker/results/imageDataUrl'](multiStitchName),
          sourceImages: [...this.$store.getters['multiInput/imageDataUrlsArray']],
          timestamp: new Date().toLocaleString()
        };
        
        // Add to start of array and keep only last 2
        this.history.unshift(panorama);
        if (this.history.length > 2) {
          this.history.pop();
        }
        
        // Save to localStorage
        this.saveHistoryToStorage();
      }
    },
    deleteWorkerData() {
      this.$store.dispatch('worker/multiStitchResetWorkerData');
    },
    deleteResult() {
      this.$store.commit('worker/results/imageData', { name: multiStitchName, imageData: null });
    },
    loadDefaultImages() {
      this.$store.dispatch('multiInput/loadDefaultImages');
      this.deleteWorkerData();
    },
    deleteAllOrSelectedInputImages() {
      this.$store.dispatch('multiInput/removeAllOrSelected');
      this.deleteWorkerData();
    },
    swapImagesInputImages({ indexFrom, indexTo }) {
      this.$store.commit('multiInput/swap', { indexFrom, indexTo });
      this.deleteWorkerData();
    },
    saveImage() {
      this.$store.dispatch('worker/saveResultImage', { name: multiStitchName, imageFileName: "MultiStitcherImage.png" });
    },
    async multiInputFilesChanged(files) {
      this.deleteWorkerData();
      await this.$store.dispatch('multiInput/imageFiles', files);
    },
    setFieldOfView(value) {
      this.selectedIndices.forEach(index => {
        if(!value) {
          this.$store.commit(
            'multiInput/imageFieldOfViewUpdate', {
              index,
              fieldOfView: this.$store.getters['multiInput/imageFieldOfViewInitial'](index)
          });
        }
        else {
          this.$store.commit(
            'multiInput/imageFieldOfViewUpdate', {
              index,
              fieldOfView: +value
          });
        }
      });
    },
    openFileSelector() {
      this.$refs.fileInput.click();
    },
    handleFileSelect(event) {
      if (event.target.files && event.target.files.length > 0) {
        this.multiInputFilesChanged(Array.from(event.target.files));
        event.target.value = '';
      }
    },
    async handleCameraCapture(file) {
      await this.multiInputFilesChanged([file]);
    },
    handleCameraError(err) {
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError') {
        this.$store.commit('logs/addErrorMessage', 'Could not access camera. Please check permissions.');
      } else {
        this.$store.commit('logs/addErrorMessage', `Camera error: ${err.name}`);
      }
    },
    startCamera() {
      if (this.$refs.camera) {
        this.$refs.camera.start();
      } else {
        this.$store.commit('logs/addErrorMessage', 'Camera initialization failed. Please try again.');
      }
    },
    loadHistoryFromStorage() {
      try {
        const stored = localStorage.getItem('panoramaHistory');
        if (stored) {
          this.history = JSON.parse(stored);
        }
      } catch (err) {
        this.$store.commit('logs/addErrorMessage', 'Failed to load panorama history');
      }
    },
    saveHistoryToStorage() {
      try {
        localStorage.setItem('panoramaHistory', JSON.stringify(this.history));
      } catch (err) {
        this.$store.commit('logs/addErrorMessage', 'Failed to save panorama history');
      }
    },
    deleteSelectedInputImages() {
      this.$store.dispatch('multiInput/removeAllOrSelected');
      this.deleteWorkerData();
    }
  }
}
</script>

<style scoped>
.stitcher {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

h1 {
  text-align: center;
  margin-bottom: 20px;
  color: #2c3e50;
}

.instructions {
  background: #f8f9fa;
  padding: 25px;
  border-radius: 12px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.instructions h3 {
  color: #2c3e50;
  margin-bottom: 15px;
}

.instructions ol {
  margin: 0;
  padding-left: 20px;
}

.instructions li {
  margin-bottom: 12px;
  line-height: 1.5;
}

.main-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin: 30px 0;
}

.btn-icon {
  font-size: 1.2em;
  margin-right: 8px;
}

.primary-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 15px 30px;
  font-size: 1.2em;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  display: inline-flex;
  align-items: center;
}

.primary-btn:hover {
  background: #45a049;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(0,0,0,0.15);
}

.primary-btn:disabled {
  background: #cccccc;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.secondary-btn {
  background: #f8f9fa;
  color: #666;
  border: 1px solid #ddd;
  padding: 15px 30px;
  font-size: 1.2em;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
}

.secondary-btn:hover {
  background: #e9ecef;
}

.photo-status {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin: 20px 0;
}

.photo-count {
  font-size: 1.1em;
  color: #666;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  transition: all 0.3s ease;
}

.delete-btn {
  color: #dc3545;
}

.delete-btn:hover {
  background: #fff5f5;
}

.photos-area {
  margin: 30px 0;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px;
}

.tip {
  font-size: 0.9em;
  color: #666;
  text-align: center;
  margin: 15px 0;
  font-style: italic;
}

.panorama-action {
  text-align: center;
  margin: 30px 0;
}

.create-btn {
  font-size: 1.3em;
  padding: 20px 40px;
}

.result-container {
  margin: 30px 0;
  padding: 25px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background: white;
}

.result-container h3 {
  color: #2c3e50;
  margin-bottom: 20px;
  text-align: center;
}

.result-actions {
  text-align: center;
  margin-top: 20px;
}

.save-btn {
  background: #007bff;
}

.save-btn:hover {
  background: #0056b3;
}

.error-container {
  background: #fff3f3;
  padding: 20px;
  border-radius: 8px;
  margin: 20px 0;
  text-align: center;
}

.error-container p {
  color: #dc3545;
  margin: 5px 0;
}

.error-tip {
  font-size: 0.9em;
  color: #666;
  margin-top: 10px;
}

.history-section {
  margin: 40px 0;
  padding: 25px;
  border: 1px solid #ddd;
  border-radius: 12px;
  background: white;
}

.history-section h3 {
  color: #2c3e50;
  margin-bottom: 20px;
  text-align: center;
}

.history-items {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.history-item {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.history-timestamp {
  color: #666;
  font-size: 0.9em;
  margin-bottom: 15px;
}

.history-images {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.source-images {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding: 10px 0;
}

.source-image {
  height: 100px;
  width: auto;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.result-image {
  width: 100%;
  overflow: hidden;
  border-radius: 4px;
}

.result-image img {
  width: 100%;
  height: auto;
  display: block;
}

.empty-history {
  text-align: center;
  padding: 30px;
  background: #f8f9fa;
  border-radius: 8px;
}

.photo-actions {
  display: flex;
  gap: 10px;
}
</style>