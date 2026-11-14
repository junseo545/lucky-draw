<script setup>
defineProps({ name: { type: String, required: true } })
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="square" aria-hidden="true">
    <template v-if="name === 'grip'">
      <circle cx="9" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.3" fill="currentColor" stroke="none" />
    </template>
    <path v-else-if="name === 'remove'" d="M6 6 L18 18 M18 6 L6 18" />
    <path v-else-if="name === 'add'" d="M12 5 V19 M5 12 H19" />
    <path v-else-if="name === 'fullscreen'" d="M4 9 V4 H9 M15 4 H20 V9 M20 15 V20 H15 M9 20 H4 V15" />
    <path v-else-if="name === 'fullscreen-exit'" d="M9 4 V9 H4 M20 9 H15 V4 M15 20 V15 H20 M4 15 H9 V20" />
    <template v-else-if="name === 'sound-on'">
      <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" stroke-linejoin="round" />
      <path d="M16.5 9 Q18.5 12 16.5 15 M19 6.5 Q23 12 19 17.5" stroke-linecap="round" />
    </template>
    <template v-else-if="name === 'sound-off'">
      <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" stroke-linejoin="round" />
      <path d="M16.5 9.5 L21.5 14.5 M21.5 9.5 L16.5 14.5" />
    </template>
    <path v-else-if="name === 'chevron'" d="M7 10 L12 15 L17 10" stroke-linejoin="round" />
    <path v-else-if="name === 'undo'" d="M9 6 L4 11 L9 16 M4 11 H14 Q20 11 20 16 Q20 20 15 20 H12" stroke-linejoin="round" />
    <path v-else-if="name === 'download'" d="M12 4 V15 M7 10 L12 15 L17 10 M5 20 H19" stroke-linejoin="round" />
  </svg>
</template>
