<script setup lang="ts">
/**
 * Interrupteur façon Apple (design system §5.8).
 *
 * - Off : piste `--bg-inset` bordée `--border-strong`, pouce `--text-faint`.
 * - On  : piste `--primary-500` + glow violet, pouce blanc cassé.
 * - Le violet = interaction (principe §1.2) ; jamais de vert/rouge ici,
 *   ces couleurs restent réservées aux états de supervision.
 */
defineProps<{
  modelValue: boolean
  disabled?: boolean
  /** Libellé optionnel affiché à droite de l'interrupteur. */
  label?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <label class="toggle" :class="{ 'is-disabled': disabled }">
    <input
      type="checkbox"
      role="switch"
      :checked="modelValue"
      :disabled="disabled"
      :aria-checked="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="toggle__track" aria-hidden="true">
      <span class="toggle__thumb" />
    </span>
    <span v-if="label" class="toggle__label">{{ label }}</span>
  </label>
</template>

<style scoped>
.toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  cursor: pointer;
  user-select: none;
}

.toggle.is-disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle__track {
  position: relative;
  flex: none;
  width: 34px;
  height: 20px;
  border-radius: 999px;
  background: var(--bg-inset);
  border: 1px solid var(--border-strong);
  transition:
    background 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-faint);
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.2s ease;
}

.toggle input:checked + .toggle__track {
  background: var(--primary-500);
  border-color: var(--primary-500);
  box-shadow: 0 0 8px var(--primary-glow);
}

.toggle input:checked + .toggle__track .toggle__thumb {
  transform: translateX(14px);
  background: var(--s404-light);
}

.toggle input:focus-visible + .toggle__track {
  outline: 2px solid var(--primary-300);
  outline-offset: 2px;
}

.toggle__label {
  font-size: 12px;
  color: var(--text-dim);
}
</style>
