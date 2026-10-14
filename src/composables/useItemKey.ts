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
  let warnedAboutDuplicateKey = false
  const objectKeys = new WeakMap<object, symbol>()
  const primitiveKeys = new Map<unknown, symbol>()

  function getFallbackKey(item: T): PropertyKey {
    if (isPropertyKey(item)) return item
    if (item !== null && typeof item === 'object') {
      let key = objectKeys.get(item)
      if (!key) {
        key = Symbol(`${options.componentName} item`)
        objectKeys.set(item, key)
      }
      return key
    }

    let key = primitiveKeys.get(item)
    if (!key) {
      key = Symbol(`${options.componentName} primitive`)
      primitiveKeys.set(item, key)
    }
    return key
  }

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

    // Object identity and primitive value are stable across append/prepend.
    // Falling back to the array index would silently attach measurements and
    // local DOM state to the wrong message after history is inserted.
    return getFallbackKey(item)
  }

  function warnIfKeysAreUnstable() {
    if (!import.meta.env.DEV) return

    if (!warnedAboutMissingItemKey && options.itemKey() === undefined) {
      const hasObjectWithoutInferredKey = options.items().some(
        (item) =>
          item !== null &&
          typeof item === 'object' &&
          getInferredKey(item) === undefined,
      )
      if (hasObjectWithoutInferredKey) {
        warnedAboutMissingItemKey = true
        console.warn(
          `[${options.componentName}] Missing \`itemKey\` for object items without an \`id\` or \`key\` property. Provide a stable key to preserve item state when data is inserted, removed, or reordered.`,
        )
      }
    }

    if (!warnedAboutDuplicateKey) {
      const keys = new Set<PropertyKey>()
      for (let index = 0; index < options.items().length; index += 1) {
        const key = getItemKey(options.items()[index], index)
        if (!keys.has(key)) {
          keys.add(key)
          continue
        }
        warnedAboutDuplicateKey = true
        console.warn(
          `[${options.componentName}] Duplicate item key \`${String(key)}\`. Keys must be unique to preserve measurements, DOM state, and scroll anchors.`,
        )
        break
      }
    }
  }

  watch(
    () => [options.itemKey(), options.items(), options.items().length] as const,
    warnIfKeysAreUnstable,
    { immediate: true },
  )

  return { getItemKey }
}
