import { watch } from 'vue'
import type { ItemKey } from '../types'

interface ItemKeyOptions<T> {
  componentName: string
  items: () => readonly T[]
  itemKey: () => ItemKey<T> | undefined
}

function isPropertyKey(value: unknown): value is PropertyKey {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'symbol'
  )
}

function getObjectKey(
  item: object,
  property: PropertyKey,
): PropertyKey | undefined {
  const value = (item as Record<PropertyKey, unknown>)[property]
  return isPropertyKey(value) ? value : undefined
}

function getInferredKey(item: object): PropertyKey | undefined {
  return getObjectKey(item, 'id') ?? getObjectKey(item, 'key')
}

export function useItemKey<T>(options: ItemKeyOptions<T>) {
  let warnedAboutMissingItemKey = false

  function getItemKey(item: T, index: number): PropertyKey {
    const configuredKey = options.itemKey()
    if (typeof configuredKey === 'function') {
      return configuredKey(item, index)
    }

    if (item !== null && typeof item === 'object') {
      if (configuredKey !== undefined) {
        const explicitKey = getObjectKey(item, configuredKey)
        if (explicitKey !== undefined) return explicitKey
      }

      const inferredKey = getInferredKey(item)
      if (inferredKey !== undefined) return inferredKey
    }

    return index
  }

  function warnIfKeysAreUnstable() {
    if (
      !import.meta.env.DEV ||
      warnedAboutMissingItemKey ||
      options.itemKey() !== undefined
    ) {
      return
    }

    const hasObjectWithoutInferredKey = options.items().some(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        getInferredKey(item) === undefined,
    )
    if (!hasObjectWithoutInferredKey) return

    warnedAboutMissingItemKey = true
    console.warn(
      `[${options.componentName}] Missing \`itemKey\` for object items without an \`id\` or \`key\` property. Provide a stable key to preserve item state when data is inserted, removed, or reordered.`,
    )
  }

  watch(
    () => [options.itemKey(), options.items()] as const,
    warnIfKeysAreUnstable,
    { immediate: true },
  )

  return { getItemKey }
}
