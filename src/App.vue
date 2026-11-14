<script setup>
import { phase, session } from './store.js'
import DrawScreen from './components/DrawScreen.vue'
import ResultScreen from './components/ResultScreen.vue'
import SetupScreen from './components/SetupScreen.vue'
</script>

<template>
  <DrawScreen v-if="phase === 'draw' && session" />
  <ResultScreen v-else-if="phase === 'result' && session" />
  <SetupScreen v-else />
</template>
