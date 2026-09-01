// Location helpers. Locations form a tree via parentId; items point at any
// node (usually a container or shelf). An item's effective location is the
// chain of ancestors of the node it references.

export function locationById(locations, id) {
  return locations.find((l) => l.id === id) || null
}

export function locationChain(locations, id) {
  const chain = []
  let node = locationById(locations, id)
  let guard = 0
  while (node && guard++ < 50) {
    chain.unshift(node)
    node = node.parentId ? locationById(locations, node.parentId) : null
  }
  return chain
}

export function locationPath(locations, id, sep = ' → ') {
  return locationChain(locations, id).map((l) => l.name).join(sep)
}

export function childrenOf(locations, parentId) {
  return locations.filter((l) => (l.parentId || null) === (parentId || null))
}

export function descendantIds(locations, id) {
  const out = []
  const walk = (pid) => {
    for (const child of childrenOf(locations, pid)) {
      out.push(child.id)
      walk(child.id)
    }
  }
  walk(id)
  return out
}

// Items directly at a node, and items anywhere beneath it.
export function itemsAt(items, locationId) {
  return items.filter((i) => i.locationId === locationId)
}

export function itemsUnder(items, locations, locationId) {
  const ids = new Set([locationId, ...descendantIds(locations, locationId)])
  return items.filter((i) => ids.has(i.locationId))
}

// Root house for an item (for dashboard grouping); null when in a temp status.
export function rootOf(locations, locationId) {
  const chain = locationChain(locations, locationId)
  return chain.length ? chain[0] : null
}

export function isDescendant(locations, maybeChildId, ancestorId) {
  return descendantIds(locations, ancestorId).includes(maybeChildId)
}
