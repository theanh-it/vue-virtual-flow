import type { SizeIndex } from './sizeIndex'

export interface KeyedSizeEntry {
  key: PropertyKey
  size: number
}

export interface KeyedSizeIndex extends SizeIndex {
  getKey(index: number): PropertyKey | undefined
  getIndex(key: PropertyKey): number | undefined
  getSizeByKey(key: PropertyKey): number | undefined
  hasKey(key: PropertyKey): boolean
  append(entries: readonly KeyedSizeEntry[]): void
  prepend(entries: readonly KeyedSizeEntry[]): void
}

interface Node extends KeyedSizeEntry {
  priority: number
  count: number
  total: number
  left?: Node
  right?: Node
  parent?: Node
}

function count(node?: Node) {
  return node?.count ?? 0
}

function total(node?: Node) {
  return node?.total ?? 0
}

function update(node: Node) {
  node.count = 1 + count(node.left) + count(node.right)
  node.total = node.size + total(node.left) + total(node.right)
  if (node.left) node.left.parent = node
  if (node.right) node.right.parent = node
}

function merge(left?: Node, right?: Node): Node | undefined {
  if (!left) return right
  if (!right) return left
  if (left.priority < right.priority) {
    left.right = merge(left.right, right)
    update(left)
    return left
  }
  right.left = merge(left, right.left)
  update(right)
  return right
}

/**
 * A keyed implicit treap for chat timelines. Appending, prepending, measuring,
 * prefix queries and offset lookup are O(log n), while key lookup is O(1)
 * plus O(log n) to derive the current rank through parent links.
 */
export function createKeyedSizeIndex(
  initialEntries: readonly KeyedSizeEntry[],
): KeyedSizeIndex {
  let root: Node | undefined
  let sequence = 0
  const nodes = new Map<PropertyKey, Node>()

  function validateEntries(entries: readonly KeyedSizeEntry[]) {
    const nextKeys = new Set<PropertyKey>()
    for (const entry of entries) {
      if (nodes.has(entry.key) || nextKeys.has(entry.key)) {
        throw new Error(
          `[vue-virtual-flow] Duplicate item key \`${String(entry.key)}\`. `
          + 'ChatVirtualScroll requires a unique stable key for every message.',
        )
      }
      nextKeys.add(entry.key)
    }
  }

  function createNode(entry: KeyedSizeEntry): Node {
    sequence += 1
    // A deterministic integer hash keeps priorities well distributed without
    // making layout behavior depend on Math.random or test order.
    let priority = Math.imul(sequence ^ 0x9e3779b9, 0x85ebca6b)
    priority ^= priority >>> 13
    priority = Math.imul(priority, 0xc2b2ae35) ^ (priority >>> 16)
    const node: Node = {
      key: entry.key,
      size: entry.size,
      priority: priority >>> 0,
      count: 1,
      total: entry.size,
    }
    nodes.set(entry.key, node)
    return node
  }

  function build(entries: readonly KeyedSizeEntry[]) {
    let tree: Node | undefined
    for (const entry of entries) tree = merge(tree, createNode(entry))
    if (tree) tree.parent = undefined
    return tree
  }

  function getNode(index: number) {
    let node = root
    let cursor = index
    while (node) {
      const leftCount = count(node.left)
      if (cursor < leftCount) node = node.left
      else if (cursor === leftCount) return node
      else {
        cursor -= leftCount + 1
        node = node.right
      }
    }
    return undefined
  }

  validateEntries(initialEntries)
  root = build(initialEntries)

  return {
    get length() {
      return count(root)
    },
    get total() {
      return total(root)
    },
    getSize(index) {
      return getNode(index)?.size ?? 0
    },
    getOffset(index) {
      let node = root
      let cursor = Math.max(0, Math.min(index, count(root)))
      let offset = 0
      while (node && cursor > 0) {
        const leftCount = count(node.left)
        if (cursor <= leftCount) {
          node = node.left
        } else {
          offset += total(node.left) + node.size
          cursor -= leftCount + 1
          node = node.right
        }
      }
      return offset
    },
    setSize(index, size) {
      let node = getNode(index)
      if (!node || node.size === size) return
      node.size = size
      while (node) {
        update(node)
        node = node.parent
      }
    },
    findIndex(offset) {
      if (!root || offset <= 0) return 0
      if (offset >= root.total) return root.count - 1
      let node: Node | undefined = root
      let prefixCount = 0
      let remaining = offset
      while (node) {
        const leftTotal = total(node.left)
        const leftCount = count(node.left)
        if (remaining < leftTotal) {
          node = node.left
        } else if (remaining < leftTotal + node.size) {
          return prefixCount + leftCount
        } else {
          remaining -= leftTotal + node.size
          prefixCount += leftCount + 1
          node = node.right
        }
      }
      return Math.max(0, count(root) - 1)
    },
    getKey(index) {
      return getNode(index)?.key
    },
    getIndex(key) {
      let node = nodes.get(key)
      if (!node) return undefined
      let index = count(node.left)
      while (node.parent) {
        if (node === node.parent.right) {
          index += count(node.parent.left) + 1
        }
        node = node.parent
      }
      return node === root ? index : undefined
    },
    getSizeByKey(key) {
      return nodes.get(key)?.size
    },
    hasKey(key) {
      return nodes.has(key)
    },
    append(entries) {
      if (entries.length === 0) return
      validateEntries(entries)
      root = merge(root, build(entries))
      if (root) root.parent = undefined
    },
    prepend(entries) {
      if (entries.length === 0) return
      validateEntries(entries)
      root = merge(build(entries), root)
      if (root) root.parent = undefined
    },
  }
}
