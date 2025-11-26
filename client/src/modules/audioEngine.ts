export const audio = new Audio()

export function playUrl(url: string) {
  audio.src = url
  audio.play()
}

export function pause() {
  audio.pause()
}

export function stop() {
  audio.pause()
  audio.currentTime = 0
}
