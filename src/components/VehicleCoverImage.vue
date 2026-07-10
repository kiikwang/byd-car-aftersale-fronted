<script setup lang="ts">
import { ref, watch } from 'vue'
import { getCatalogImageCandidates } from '@/data/vehicle-catalog'

const props = defineProps<{
  catalogId?: string
  alt?: string
}>()

const src = ref('/vehicles/default.svg')
const candidates = ref<string[]>([])
const candidateIndex = ref(0)

function resetSources() {
  candidates.value = props.catalogId
    ? getCatalogImageCandidates(props.catalogId)
    : ['/vehicles/default.svg']
  candidateIndex.value = 0
  src.value = candidates.value[0] || '/vehicles/default.svg'
}

function onError() {
  if (candidateIndex.value < candidates.value.length - 1) {
    candidateIndex.value += 1
    src.value = candidates.value[candidateIndex.value]
    return
  }
  src.value = '/vehicles/default.svg'
}

watch(() => props.catalogId, resetSources, { immediate: true })
</script>

<template>
  <img :src="src" :alt="alt || '车型图'" class="vehicle-cover-img" @error="onError" />
</template>

<style scoped>
.vehicle-cover-img {
  width: 90%;
  height: 110px;
  object-fit: contain;
}
</style>
