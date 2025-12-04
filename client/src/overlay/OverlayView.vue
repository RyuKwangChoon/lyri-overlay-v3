<template>
  <div class="overlay-view">
    <!-- Main Display Area -->
    <div class="overlay-content">
      <!-- Chat Messages -->
      <div class="chat-area">
        <div v-for="msg in messages" :key="msg.id" :class="['message', `role-${msg.role}`]">
          <span class="text">{{ msg.text }}</span>
        </div>
      </div>

      <!-- Now Playing -->
      <div v-if="currentTrack" class="now-playing">
        <div class="track-info">
          <h3>{{ currentTrack.title }}</h3>
          <p>{{ currentTrack.artist }}</p>
        </div>
        <div class="progress-bar">
          <div class="progress" :style="{ width: progress + '%' }"></div>
        </div>
      </div>

      <!-- Ticker/Notice -->
      <div v-if="ticker" class="ticker">
        {{ ticker }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { currentTrack, progress } from '@modules/nowPlaying'
import WSManager from '@modules/ws'

const messages = ref<any[]>([])
const ticker = ref<string>('')

const wsManager = new WSManager(__WS_URL__)

onMounted(() => {
  wsManager.connect()
  
  wsManager.on('overlay_message', (data) => {
    messages.value.push({
      id: Date.now(),
      text: data.text,
      role: data.role,
      timestamp: data.timestamp,
    })
  })

  wsManager.on('ticker_update', (data) => {
    ticker.value = data.notice
  })

  wsManager.on('now_playing_update', (data) => {
    // Handle now playing updates
  })
})
</script>

<style scoped>
.overlay-view {
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  font-family: 'Arial', sans-serif;
  overflow: hidden;
}

.overlay-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
}

.chat-area {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 20px;
}

.message {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 5px;
  animation: slideIn 0.3s ease-in-out;
}

.message.role-brian {
  background: rgba(100, 150, 255, 0.3);
  border-left: 4px solid #6496ff;
}

.message.role-assistant {
  background: rgba(100, 255, 150, 0.3);
  border-left: 4px solid #64ff96;
}

.now-playing {
  background: rgba(50, 50, 50, 0.8);
  padding: 15px;
  border-radius: 5px;
  margin-bottom: 20px;
}

.track-info h3 {
  margin: 0 0 5px 0;
  font-size: 18px;
}

.track-info p {
  margin: 0;
  font-size: 14px;
  opacity: 0.8;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
  margin-top: 10px;
}

.progress {
  height: 100%;
  background: linear-gradient(90deg, #64ff96, #6496ff);
  width: 0%;
  transition: width 0.1s linear;
}

.ticker {
  background: rgba(255, 200, 0, 0.3);
  padding: 10px;
  border-radius: 5px;
  text-align: center;
  font-weight: bold;
  animation: scroll 10s linear infinite;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scroll {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(-100%);
  }
}
</style>
