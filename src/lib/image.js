// Compress an image File to a small JPEG data URL so photos fit comfortably
// in localStorage. Returns { thumb, full } data URLs.
export async function fileToDataUrls(file, { thumbSize = 96, fullSize = 640 } = {}) {
  const bitmap = await readImage(file)
  return {
    thumb: draw(bitmap, thumbSize, 0.7),
    full: draw(bitmap, fullSize, 0.75),
  }
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (e) => {
      URL.revokeObjectURL(url)
      reject(e)
    }
    img.src = url
  })
}

function draw(img, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.width * scale))
  canvas.height = Math.max(1, Math.round(img.height * scale))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

// Base64 payload (no data: prefix) + media type, for the vision API.
export function dataUrlToBase64(dataUrl) {
  const [head, data] = dataUrl.split(',')
  const mediaType = head.match(/data:(.*?);/)?.[1] ?? 'image/jpeg'
  return { mediaType, data }
}
