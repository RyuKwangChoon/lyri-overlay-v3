// ========================================
// 🎵 Now Playing Module
// ========================================
// Manages current playing track state and updates

import { ref, computed } from 'vue'

export interface Track {
  id: string
  title: string
  artist: string
  duration: number
  order: number
}

export const currentTrack = ref<Track | null>(null)
export const elapsed = ref(0)
export const isPlaying = ref(false)
export const repeatMode = ref<'none' | 'one' | 'all'>('none')

// Computed progress percentage
export const progress = computed(() => {
  if (!currentTrack.value) return 0
  return Math.floor((elapsed.value / currentTrack.value.duration) * 100)
})

// Update current playing track
export function setCurrentTrack(track: Track) {
  currentTrack.value = track
  elapsed.value = 0
}

// Update elapsed time
export function updateProgress(newElapsed: number) {
  elapsed.value = newElapsed
}

// Play/Pause controls
export function play() {
  isPlaying.value = true
}

export function pause() {
  isPlaying.value = false
}

export function togglePlayPause() {
  isPlaying.value = !isPlaying.value
}

// Repeat mode control
export function setRepeatMode(mode: 'none' | 'one' | 'all') {
  repeatMode.value = mode
}

export default {
  currentTrack,
  elapsed,
  isPlaying,
  repeatMode,
  progress,
  setCurrentTrack,
  updateProgress,
  play,
  pause,
  togglePlayPause,
  setRepeatMode,
}
