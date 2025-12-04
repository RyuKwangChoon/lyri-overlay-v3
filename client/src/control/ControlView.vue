<template>
  <div class="control-view">
    <div class="control-panel">
      <!-- Message Input -->
      <div class="section">
        <h3>💬 Send Message</h3>
        <div class="input-group">
          <input 
            v-model="messageText" 
            type="text" 
            placeholder="Enter message..."
            @keyup.enter="sendMessage"
          />
          <select v-model="messageRole">
            <option value="brian">Brian</option>
            <option value="assistant">Assistant</option>
          </select>
          <button @click="sendMessage" class="btn-send">Send</button>
        </div>
      </div>

      <!-- Notice/Ticker Input -->
      <div class="section">
        <h3>📢 Update Notice</h3>
        <div class="input-group">
          <input 
            v-model="noticeText" 
            type="text" 
            placeholder="Enter notice text..."
            @keyup.enter="updateNotice"
          />
          <button @click="updateNotice" class="btn-send">Update</button>
        </div>
      </div>

      <!-- Track Control -->
      <div class="section">
        <h3>🎵 Track Control</h3>
        <div class="track-buttons">
          <button @click="playTrack" class="btn-control">Play</button>
          <button @click="pauseTrack" class="btn-control">Pause</button>
          <button @click="nextTrack" class="btn-control">Next</button>
          <button @click="prevTrack" class="btn-control">Previous</button>
        </div>
        <div class="repeat-control">
          <label>Repeat Mode:</label>
          <select v-model="repeatMode" @change="setRepeatMode">
            <option value="none">None</option>
            <option value="one">One</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <!-- Status -->
      <div class="section status">
        <h3>📊 Status</h3>
        <p>Connected: <span :class="isConnected ? 'ok' : 'error'">{{ isConnected ? '✅' : '❌' }}</span></p>
        <p>Now Playing: {{ currentTrack?.title || 'None' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { currentTrack, play, pause, setRepeatMode as setRM, repeatMode } from '@modules/nowPlaying'
import WSManager from '@modules/ws'
import APIClient from '@modules/api'

const messageText = ref('')
const messageRole = ref('brian')
const noticeText = ref('')
const isConnected = ref(false)

const wsManager = new WSManager(__WS_URL__)
const apiClient = new APIClient(__RELAY_URL__)

onMounted(() => {
  wsManager.connect()
  // Handle connection status
})

const sendMessage = async () => {
  if (!messageText.value.trim()) return
  
  try {
    await apiClient.post('/message/save', {
      text: messageText.value,
      role: messageRole.value,
    })
    messageText.value = ''
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

const updateNotice = async () => {
  if (!noticeText.value.trim()) return
  
  try {
    await apiClient.post('/notice/update', {
      notice: noticeText.value,
      priority: 0,
    })
    noticeText.value = ''
  } catch (error) {
    console.error('Failed to update notice:', error)
  }
}

const playTrack = () => play()
const pauseTrack = () => pause()
const nextTrack = () => console.log('Next track')
const prevTrack = () => console.log('Previous track')

const setRepeatMode = () => setRM(repeatMode.value as any)
</script>

<style scoped>
.control-view {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  color: white;
  overflow-y: auto;
  padding: 20px;
}

.control-panel {
  max-width: 600px;
}

.section {
  background: #2a2a2a;
  padding: 15px;
  margin-bottom: 15px;
  border-radius: 5px;
  border-left: 4px solid #6496ff;
}

.section h3 {
  margin-top: 0;
  font-size: 16px;
}

.input-group {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.input-group input,
.input-group select {
  flex: 1;
  padding: 8px;
  background: #1a1a1a;
  border: 1px solid #444;
  color: white;
  border-radius: 3px;
}

.btn-send,
.btn-control {
  padding: 8px 16px;
  background: #6496ff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-send:hover,
.btn-control:hover {
  background: #5285ee;
}

.track-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}

.repeat-control {
  display: flex;
  gap: 10px;
  align-items: center;
}

.repeat-control select {
  flex: 1;
}

.status {
  border-left-color: #64ff96;
}

.status p {
  margin: 5px 0;
}

.ok {
  color: #64ff96;
  font-weight: bold;
}

.error {
  color: #ff6464;
  font-weight: bold;
}
</style>
