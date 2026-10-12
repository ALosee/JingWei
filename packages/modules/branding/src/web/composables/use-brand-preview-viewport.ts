import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/** Fit a stable desktop canvas to the available preview width without changing shell geometry. */
export function useBrandPreviewViewport(width: number, height: number) {
  const container = ref<HTMLElement | null>(null)
  const availableWidth = ref(width)
  const canvasWidth = computed(() => Math.max(width, availableWidth.value))
  const scale = computed(() => Math.min(1, availableWidth.value / width))
  let observer: ResizeObserver | undefined
  function resize(): void {
    const available = container.value?.clientWidth ?? 0
    if (available > 0) availableWidth.value = available
  }
  onMounted(() => {
    resize()
    observer = new ResizeObserver(resize)
    if (container.value) observer.observe(container.value)
  })
  onBeforeUnmount(() => observer?.disconnect())
  return {
    container,
    containerStyle: computed(() => ({ height: `${height * scale.value}px` })),
    canvasStyle: computed(() => ({
      width: `${canvasWidth.value}px`,
      height: `${height}px`,
      transform: `scale(${scale.value})`,
    })),
  }
}
