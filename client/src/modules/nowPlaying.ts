import { ref } from 'vue'

export const nowPlaying = ref({
  id: null,
  title: '',
  duration: 0,
  position: 0
})

export function updateNowPlaying(data: any) {
  nowPlaying.value = data
}
