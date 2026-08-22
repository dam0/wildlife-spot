import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './MapComponent.css'
import type { MapClient, SightingRow, SpeciesView } from '../spacetime'

type Sighting = SightingRow

interface UserPin {
  id: string
  lat: number
  lng: number
  species_id: number
  pod_size: number
  description: string
  /** True until the user explicitly picks a species (vs. the seeded assumption). */
  speciesAssumed: boolean
}

/** Category display order — whale first per product decision; others follow alphabetically. */
const CATEGORY_ORDER = ['whale']

function categoryRank(category: string): number {
  const i = CATEGORY_ORDER.indexOf(category)
  return i === -1 ? CATEGORY_ORDER.length : i
}

/** Category → emoji for markers. Unknown categories fall back to a generic paw. */
const CATEGORY_EMOJIS: Record<string, string> = {
  whale: '🐋',
  dolphin: '🐬',
  seal: '🦭',
  seabird: '🐦',
}

function checkIfWaterByTile(lat: number, lng: number, zoom: number = 12): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'Anonymous'

    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
    const y = Math.floor(
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
        Math.pow(2, zoom)
    )

    const tileUrl = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
    console.log(`[Water Check] Checking tile ${zoom}/${x}/${y} for location (${lat.toFixed(4)}, ${lng.toFixed(4)})`)

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.warn('Could not get canvas context')
          resolve(false)
          return
        }

        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const data = imageData.data

        const centerX = Math.floor(img.width / 2)
        const centerY = Math.floor(img.height / 2)

        let waterCount = 0
        let landCount = 0
        const pixelSamples: {r: number; g: number; b: number}[] = []
        
        const sampleRadius = 40
        const sampleStep = 2
        
        for (let i = -sampleRadius; i <= sampleRadius; i += sampleStep) {
          for (let j = -sampleRadius; j <= sampleRadius; j += sampleStep) {
            const px = centerX + i
            const py = centerY + j
            
            if (px >= 0 && px < img.width && py >= 0 && py < img.height) {
              const pixelIndex = (py * img.width + px) * 4
              const r = data[pixelIndex]
              const g = data[pixelIndex + 1]
              const b = data[pixelIndex + 2]
              
              pixelSamples.push({r, g, b})
              
              if (b > 120 && b > g && b > r) {
                waterCount++
              } else {
                landCount++
              }
            }
          }
        }

        const totalSamples = waterCount + landCount
        const waterRatio = totalSamples > 0 ? waterCount / totalSamples : 0
        const avgRGB = pixelSamples.reduce(
          (acc, p) => ({
            r: acc.r + p.r,
            g: acc.g + p.g,
            b: acc.b + p.b,
          }),
          {r: 0, g: 0, b: 0}
        )
        avgRGB.r = Math.round(avgRGB.r / pixelSamples.length)
        avgRGB.g = Math.round(avgRGB.g / pixelSamples.length)
        avgRGB.b = Math.round(avgRGB.b / pixelSamples.length)

        const isWater = waterRatio > 0.3
        console.log(`[Water Analysis] Water: ${waterCount}/${totalSamples} (${(waterRatio * 100).toFixed(0)}%), Avg RGB: (${avgRGB.r}, ${avgRGB.g}, ${avgRGB.b}), Result: ${isWater ? 'WATER ✓' : 'LAND ✗'}`)
        resolve(isWater)
      } catch (err) {
        console.error('Tile analysis error:', err)
        resolve(false)
      }
    }

    img.onerror = () => {
      console.error('Failed to load tile:', tileUrl)
      resolve(false)
    }

    img.src = tileUrl
  })
}

export default function MapComponent({ client, username, sightings, species }: { client: MapClient; username: string; sightings: Sighting[]; species: SpeciesView[] }) {
  // Catalogue helpers — everything derives from the live DB table now.
  const speciesById = useMemo(
    () => new Map(species.map((s) => [s.id, s])),
    [species],
  )
  const speciesName = (id: number) => speciesById.get(id)?.name ?? 'Unknown Species'
  const categoryOf = (id: number) => speciesById.get(id)?.category ?? ''
  const emojiFor = (id: number) => CATEGORY_EMOJIS[categoryOf(id)] ?? '🐾'
  /** Grouped options: category rank first, then catalogue id order. */
  const groupedSpecies = useMemo(() => {
    const groups = new Map<string, SpeciesView[]>()
    for (const s of species) {
      const list = groups.get(s.category) ?? []
      list.push(s)
      groups.set(s.category, list)
    }
    return [...groups.entries()].sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]))
  }, [species])
  const defaultSpeciesId = useMemo(() => {
    const humpback = species.find((s) => /humpback/i.test(s.name))
    return humpback?.id ?? species[0]?.id ?? 1
  }, [species])

  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<number, L.Marker>>(new Map())
  const userPinMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const eventListenersRef = useRef<Map<string, (e: Event) => void>>(new Map())
  const [userPins, setUserPins] = useState<UserPin[]>([])
  const [message, setMessage] = useState<string>('Click on the map to place a sighting pin')

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map').setView([20, 0], 2)

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current)

      // Dev/test hook: lets Playwright drive the map deterministically.
      if (import.meta.env.DEV) {
        ;(window as unknown as Record<string, unknown>).__leafletMap = mapRef.current
      }
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 12)
        }
      },
      (error) => {
        console.error('Geolocation error:', error)
      }
    )

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current) return

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat
      const lng = e.latlng.lng

      setMessage('Checking if location is water...')

      const isWater = await checkIfWaterByTile(lat, lng, mapRef.current!.getZoom())

      if (!isWater) {
        setMessage('This location is on land. Please click on water (ocean).')
        return
      }

      const newPin: UserPin = {
        id: `pin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        lat,
        lng,
        species_id: defaultSpeciesId,
        pod_size: 2,
        description: '',
        speciesAssumed: true,
      }

      setUserPins((prev) => [...prev, newPin])
      setMessage(`Pin added (${userPins.length + 1} total). Click more to add or report.`)
    }

    mapRef.current.on('click', handleMapClick)

    return () => {
      mapRef.current?.off('click', handleMapClick)
    }
  }, [userPins.length, defaultSpeciesId])

  useEffect(() => {
    if (!mapRef.current) return

     const currentMarkers = new Set(userPinMarkersRef.current.keys())
     const newPinIds = new Set(userPins.map((p) => p.id))

     currentMarkers.forEach((id) => {
       if (!newPinIds.has(id)) {
         const marker = userPinMarkersRef.current.get(id)
         if (marker) {
           mapRef.current?.removeLayer(marker)
           userPinMarkersRef.current.delete(id)
         }
       }
     })

    userPins.forEach((pin) => {
      const existingMarker = userPinMarkersRef.current.get(pin.id)
      
      if (existingMarker) {
        const customIcon = L.divIcon({
          html: `<div class="user-marker" style="font-size: 32px; display: flex; align-items: center; gap: 4px;">
            ${emojiFor(pin.species_id)}
            <span style="font-weight: bold; color: #4CAF50; background: white; padding: 2px 6px; border-radius: 12px; font-size: 14px;">${pin.pod_size}</span>
          </div>`,
          iconSize: [60, 40],
          className: 'custom-user-marker',
        })
        existingMarker.setIcon(customIcon)

        // Keep the open popup's Assumed badge in sync when the flag changes
        // (e.g. the user just picked a species explicitly).
        const badge = document.getElementById(`assumed-badge-${pin.id}`)
        if (badge) {
          if (pin.speciesAssumed) badge.style.display = ''
          else badge.remove()
        }
        return
      }

      if (!userPinMarkersRef.current.has(pin.id)) {
        const createMarker = () => {
          const emoji = emojiFor(pin.species_id)
          const customIcon = L.divIcon({
            html: `<div class="user-marker" style="font-size: 32px; display: flex; align-items: center; gap: 4px;">
              ${emoji}
              <span style="font-weight: bold; color: #4CAF50; background: white; padding: 2px 6px; border-radius: 12px; font-size: 14px;">${pin.pod_size}</span>
            </div>`,
            iconSize: [60, 40],
            className: 'custom-user-marker',
          })
          return customIcon
        }

        const marker = L.marker([pin.lat, pin.lng], {
          icon: createMarker(),
          draggable: true,
        }).addTo(mapRef.current!)

        const optionsHTML = groupedSpecies
          .map(
            ([category, list]) =>
              `<optgroup label="${category}">` +
              list.map((s) => `<option value="${s.id}">${s.name}</option>`).join('') +
              `</optgroup>`,
          )
          .join('')

        const assumedBadge = pin.speciesAssumed
          ? `<span id="assumed-badge-${pin.id}" title="Pre-filled because Humpbacks are the most common sighting — pick a species if you identified one" style="font-size: 0.7rem; background: #FFF3CD; color: #856404; padding: 2px 6px; border-radius: 10px; margin-left: 6px;">Assumed</span>`
          : ''

        const formHTML = `
          <div class="user-location-form">
            <h3>${emojiFor(pin.species_id)} ${username}${assumedBadge}</h3>
            <p style="font-size: 0.75rem; color: #999; margin-bottom: 0.5rem;">Lat: ${pin.lat.toFixed(4)} | Lng: ${pin.lng.toFixed(4)}</p>
            <p style="font-size: 0.85rem; color: #666; margin-bottom: 1rem;">Drag the pin to update coordinates</p>
            <div class="form-group">
              <label>Species:</label>
              <select id="species-select-${pin.id}" class="species-select">
                ${optionsHTML}
              </select>
            </div>
            <div class="form-group">
              <label>Pod Size:</label>
              <input type="number" id="pod-size-${pin.id}" class="pod-size-input" value="${pin.pod_size}" min="1" max="50" />
            </div>
            <div class="form-group">
              <label>Description:</label>
              <textarea id="description-${pin.id}" class="description-input" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; resize: vertical;" rows="2" placeholder="Additional details..."></textarea>
            </div>
            <div style="display: flex; gap: 8px;">
              <button id="report-btn-${pin.id}" class="report-btn" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Report
              </button>
              <button id="delete-btn-${pin.id}" class="delete-btn" style="padding: 8px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Delete
              </button>
            </div>
          </div>
        `

        marker.bindPopup(formHTML, { maxWidth: 250 })

         marker.on('popupopen', () => {
            const speciesSelect = document.getElementById(`species-select-${pin.id}`) as HTMLSelectElement
            const podSizeInput = document.getElementById(`pod-size-${pin.id}`) as HTMLInputElement
            const descriptionInput = document.getElementById(`description-${pin.id}`) as HTMLTextAreaElement
            const reportBtn = document.getElementById(`report-btn-${pin.id}`) as HTMLButtonElement
            const deleteBtn = document.getElementById(`delete-btn-${pin.id}`) as HTMLButtonElement

            const currentPin = userPins.find(p => p.id === pin.id)
            if (!currentPin) return

            if (speciesSelect) {
              speciesSelect.value = String(currentPin.species_id)
              const handleSpeciesChange = (e: Event) => {
                const newSpecies = parseInt((e.target as HTMLSelectElement).value)
                // An explicit pick always wins over the seeded assumption.
                setUserPins((prev) =>
                  prev.map((p) =>
                    p.id === pin.id ? { ...p, species_id: newSpecies, speciesAssumed: false } : p,
                  ),
                )
              }
              speciesSelect.removeEventListener('change', handleSpeciesChange as EventListener)
              speciesSelect.addEventListener('change', handleSpeciesChange)
            }

            if (podSizeInput) {
              podSizeInput.value = String(currentPin.pod_size)
              const handlePodSizeChange = (e: Event) => {
                const newSize = Math.max(1, parseInt((e.target as HTMLInputElement).value))
                setUserPins((prev) =>
                  prev.map((p) => (p.id === pin.id ? { ...p, pod_size: newSize } : p))
                )
              }
              podSizeInput.removeEventListener('change', handlePodSizeChange as EventListener)
              podSizeInput.addEventListener('change', handlePodSizeChange)
            }

            if (descriptionInput) {
              descriptionInput.value = currentPin.description
              const handleDescChange = (e: Event) => {
                const newDesc = (e.target as HTMLTextAreaElement).value
                setUserPins((prev) =>
                  prev.map((p) => (p.id === pin.id ? { ...p, description: newDesc } : p))
                )
              }
              descriptionInput.removeEventListener('change', handleDescChange as EventListener)
              descriptionInput.addEventListener('change', handleDescChange)
            }

            if (reportBtn) {
              const handleReport = async () => {
                try {
                  if (!client) {
                    alert('Error: Not connected to backend')
                    return
                  }
                  
                  const markerPos = marker.getLatLng()
                  const selectedSpecies = parseInt((speciesSelect?.value || String(currentPin.species_id)).toString())
                  const selectedPodSize = parseInt((podSizeInput?.value || String(currentPin.pod_size)).toString())
                  const selectedDesc = descriptionInput?.value || currentPin.description || `${speciesName(selectedSpecies)} pod of ${selectedPodSize}`
                 
                 console.log('[Report] Sending sighting with args:', [
                   selectedSpecies,
                   markerPos.lat,
                   markerPos.lng,
                   selectedDesc,
                   selectedPodSize,
                 ])
                 await client.reportSighting(
                   selectedSpecies,
                   markerPos.lat,
                   markerPos.lng,
                   selectedDesc,
                   selectedPodSize,
                 )
                 console.log('[Report] Sighting sent successfully')
                 
                 setMessage('Sighting reported successfully!')
                 
                 marker.closePopup()
                 setUserPins((prev) => prev.filter((p) => p.id !== pin.id))
               } catch (err) {
                 console.error('Failed to report sighting:', err)
                 alert(`Failed to report sighting: ${err instanceof Error ? err.message : 'Unknown error'}`)
               }
             }
              reportBtn.removeEventListener('click', handleReport)
              reportBtn.addEventListener('click', handleReport)
            }

            if (deleteBtn) {
              const handleDelete = () => {
                marker.closePopup()
                mapRef.current?.removeLayer(marker)
                setUserPins((prev) => prev.filter((p) => p.id !== pin.id))
                setMessage(`Pin deleted. ${userPins.length - 1} pins remaining.`)
              }
              deleteBtn.removeEventListener('click', handleDelete)
              deleteBtn.addEventListener('click', handleDelete)
            }
         })

         marker.on('dragend', async () => {
           const newPos = marker.getLatLng()
           const waterCheck = await checkIfWaterByTile(newPos.lat, newPos.lng, mapRef.current!.getZoom())
           if (waterCheck) {
             setUserPins((prev) =>
               prev.map((p) => (p.id === pin.id ? { ...p, lat: newPos.lat, lng: newPos.lng } : p))
             )
           } else {
             setMessage('Please place pins only on water (ocean).')
             marker.setLatLng([pin.lat, pin.lng])
           }
         })

         userPinMarkersRef.current.set(pin.id, marker)
       }
     })
   }, [userPins, groupedSpecies])

  // Live updates arrive via SpacetimeDB subscriptions; no polling needed.

  useEffect(() => {
    if (!mapRef.current) return

    const currentMarkers = new Set(markersRef.current.keys())
    const newSightingIds = new Set(sightings.map((s) => s.id))

    currentMarkers.forEach((id) => {
      if (!newSightingIds.has(id)) {
        const marker = markersRef.current.get(id)
        if (marker) {
          mapRef.current?.removeLayer(marker)
          markersRef.current.delete(id)
        }
      }
    })

     sightings.forEach((sighting) => {
        const name = speciesName(sighting.species_id)
        const emoji = emojiFor(sighting.species_id)
        const isOwner = sighting.username === username

        if (!markersRef.current.has(sighting.id)) {

         const customIcon = L.divIcon({
           html: `<div style="font-size: 32px; display: flex; align-items: center; justify-content: center;">
             ${emoji}
           </div>`,
           iconSize: [40, 40],
           className: 'sighting-marker',
         })

          const optionsHTML = groupedSpecies
            .map(
              ([category, list]) =>
                `<optgroup label="${category}">` +
                list.map((s) => `<option value="${s.id}">${s.name}</option>`).join('') +
                `</optgroup>`,
            )
            .join('')

          const popupHTML = `
            <div class="popup">
              <h4 id="sighting-species-${sighting.id}">${name}</h4>
              <p><strong>By:</strong> ${sighting.username}</p>
              <p id="sighting-location-${sighting.id}" style="font-size: 0.75rem; color: #999;">
                <strong>Location:</strong> ${sighting.latitude.toFixed(4)}, ${sighting.longitude.toFixed(4)}
              </p>
              <p id="sighting-time-${sighting.id}"><strong>Time:</strong> ${new Date(sighting.timestamp).toLocaleString()}</p>
              ${isOwner ? `
                <div class="form-group">
                  <label>Species:</label>
                  <select id="edit-species-${sighting.id}" class="species-select">
                    ${optionsHTML}
                  </select>
                </div>
                    <div class="form-group">
                      <label>Pod Size:</label>
                      <input type="number" id="edit-pod-size-${sighting.id}" class="pod-size-input" min="1" max="50" />
                    </div>
                    <div class="form-group">
                      <label>Description:</label>
                      <textarea id="edit-description-${sighting.id}" class="description-input" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; resize: vertical;" rows="2"></textarea>
                    </div>
                <p style="font-size: 0.85rem; color: #666; margin: 0.5rem 0;">Drag the marker to update location</p>
                    <div style="display: flex; gap: 8px; margin-top: 8px;">
                      <button id="save-edit-${sighting.id}" class="report-btn" style="flex: 1; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Save Changes
                      </button>
                      <button id="delete-sighting-${sighting.id}" class="delete-btn" style="padding: 8px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Delete
                      </button>
                    </div>
              ` : `
                <p><strong>Pod Size:</strong> ${sighting.pod_size || 1}</p>
                <p><strong>Details:</strong> ${sighting.description}</p>
              `}
            </div>
          `

         const marker = L.marker([sighting.latitude, sighting.longitude], {
           icon: customIcon,
           draggable: isOwner,
         })
           .bindPopup(popupHTML, { maxWidth: 250 })
           .addTo(mapRef.current!)

           marker.on('popupopen', () => {
             if (isOwner) {
               const setupFormHandlers = () => {
                 const speciesSelect = document.getElementById(`edit-species-${sighting.id}`) as HTMLSelectElement
                 const podSizeInput = document.getElementById(`edit-pod-size-${sighting.id}`) as HTMLInputElement
                 const descriptionInput = document.getElementById(`edit-description-${sighting.id}`) as HTMLTextAreaElement
                 const saveBtn = document.getElementById(`save-edit-${sighting.id}`) as HTMLButtonElement

                 if (!speciesSelect || !podSizeInput || !descriptionInput || !saveBtn) {
                   setTimeout(setupFormHandlers, 50)
                   return
                 }

                 const currentSighting = sightings.find(s => s.id === sighting.id)
                 if (!currentSighting) return

                 speciesSelect.value = String(currentSighting.species_id)
                 podSizeInput.value = String(currentSighting.pod_size || 1)
                 descriptionInput.value = currentSighting.description

                 console.log('[Form Setup] Elements found and populated for sighting', sighting.id)

                 const listenerKey = `save-click-${sighting.id}`
                 const oldListener = eventListenersRef.current.get(listenerKey)
                 if (oldListener && saveBtn) {
                   saveBtn.removeEventListener('click', oldListener)
                 }

                 const handleSaveClick = async () => {
                   console.log('[Save Click] Clicked save button for sighting', sighting.id)
                   
                   const speciesValue = (document.getElementById(`edit-species-${sighting.id}`) as HTMLSelectElement)?.value
                   const podSizeValue = (document.getElementById(`edit-pod-size-${sighting.id}`) as HTMLInputElement)?.value
                   const descValue = (document.getElementById(`edit-description-${sighting.id}`) as HTMLTextAreaElement)?.value

                   console.log('[Save Click] Form values:', {
                     species: speciesValue,
                     podSize: podSizeValue,
                     description: descValue,
                   })
                   
                   try {
                     if (!client) {
                       alert('Error: Not connected to backend')
                       return
                     }

                     const latestSighting = sightings.find(s => s.id === sighting.id)
                     if (!latestSighting) {
                       console.error('[Save] Could not find latest sighting')
                       return
                     }

                     const markerPos = marker.getLatLng()
                     const newSpecies = parseInt(speciesValue || String(latestSighting.species_id))
                     const newPodSize = parseInt(podSizeValue || String(latestSighting.pod_size || 1))
                     const newDesc = descValue || latestSighting.description

                     console.log('[Save] Sending update with:', {
                       sightingId: sighting.id,
                       newSpecies,
                       newPodSize,
                       newDesc,
                       lat: markerPos.lat,
                       lng: markerPos.lng,
                     })

                     await client.updateSighting(
                       sighting.id,
                       newSpecies,
                       markerPos.lat,
                       markerPos.lng,
                       newDesc,
                       newPodSize,
                     )

                     console.log('[Update] Sighting updated successfully')
                     setMessage('Sighting updated successfully!')
                     marker.closePopup()
                   } catch (err) {
                     console.error('Failed to update sighting:', err)
                     alert(`Failed to update sighting: ${err instanceof Error ? err.message : 'Unknown error'}`)
                   }
                 }
                 
                    eventListenersRef.current.set(listenerKey, handleSaveClick)
                    saveBtn.addEventListener('click', handleSaveClick)

                    const deleteBtn = document.getElementById(`delete-sighting-${sighting.id}`) as HTMLButtonElement
                    if (deleteBtn) {
                      const handleDeleteClick = async () => {
                        if (!confirm('Are you sure you want to delete this sighting? This action cannot be undone.')) {
                          return
                        }

                        console.log('[Delete] Deleting sighting', sighting.id)

                        try {
                          if (!client) {
                            alert('Error: Not connected to backend')
                            return
                          }

                          await client.deleteSighting(sighting.id)

                          console.log('[Delete] Sighting deleted successfully')
                          setMessage('Sighting deleted successfully!')

                          // Remove marker from map
                          const markerToRemove = markersRef.current.get(sighting.id)
                          if (markerToRemove) {
                            mapRef.current?.removeLayer(markerToRemove)
                            markersRef.current.delete(sighting.id)
                          }
                        } catch (err) {
                          console.error('Failed to delete sighting:', err)
                          alert(`Failed to delete sighting: ${err instanceof Error ? err.message : 'Unknown error'}`)
                        }
                      }

                      const deleteListenerKey = `delete-click-${sighting.id}`
                      const oldDeleteListener = eventListenersRef.current.get(deleteListenerKey)
                      if (oldDeleteListener && deleteBtn) {
                        deleteBtn.removeEventListener('click', oldDeleteListener)
                      }

                      eventListenersRef.current.set(deleteListenerKey, handleDeleteClick)
                      deleteBtn.addEventListener('click', handleDeleteClick)
                    }
               }

               setupFormHandlers()
             }
           })

          if (isOwner) {
            marker.on('dragend', async () => {
              const newPos = marker.getLatLng()
              const waterCheck = await checkIfWaterByTile(newPos.lat, newPos.lng, mapRef.current!.getZoom())
              if (waterCheck) {
                const locationDisplay = document.getElementById(`sighting-location-${sighting.id}`)
                if (locationDisplay && marker.isPopupOpen()) {
                  locationDisplay.innerHTML = `<strong>Location:</strong> ${newPos.lat.toFixed(4)}, ${newPos.lng.toFixed(4)}`
                }
                
                  try {
                    const currentSighting = sightings.find(s => s.id === sighting.id)
                    if (currentSighting) {
                      await client.updateSighting(
                        sighting.id,
                        currentSighting.species_id,
                        newPos.lat,
                        newPos.lng,
                        currentSighting.description,
                        currentSighting.pod_size || 1,
                      )
                    }
                  } catch (err) {
                  console.error('Failed to update sighting location:', err)
                }
              } else {
                setMessage('Sightings can only be on water. Snapping back...')
                marker.setLatLng([sighting.latitude, sighting.longitude])
              }
            })
          }

          markersRef.current.set(sighting.id, marker)
        } else {
           const existingMarker = markersRef.current.get(sighting.id)
           if (existingMarker) {
            const name = speciesName(sighting.species_id)
            const emoji = emojiFor(sighting.species_id)

            const prevPos = existingMarker.getLatLng()
            if (prevPos.lat !== sighting.latitude || prevPos.lng !== sighting.longitude) {
              existingMarker.setLatLng([sighting.latitude, sighting.longitude])
            }

            const newIcon = L.divIcon({
              html: `<div style="font-size: 32px; display: flex; align-items: center; justify-content: center;">
                ${emoji}
              </div>`,
              iconSize: [40, 40],
              className: 'sighting-marker',
            })
            existingMarker.setIcon(newIcon)

            const optionsHTML = groupedSpecies
              .map(
                ([category, list]) =>
                  `<optgroup label="${category}">` +
                  list.map((s) => `<option value="${s.id}">${s.name}</option>`).join('') +
                  `</optgroup>`,
              )
              .join('')

            const popupHTML = `
              <div class="popup">
                <h4 id="sighting-species-${sighting.id}">${name}</h4>
                <p><strong>By:</strong> ${sighting.username}</p>
                <p id="sighting-location-${sighting.id}" style="font-size: 0.75rem; color: #999;">
                  <strong>Location:</strong> ${sighting.latitude.toFixed(4)}, ${sighting.longitude.toFixed(4)}
                </p>
                <p id="sighting-time-${sighting.id}"><strong>Time:</strong> ${new Date(sighting.timestamp).toLocaleString()}</p>
                ${isOwner ? `
                  <div class="form-group">
                    <label>Species:</label>
                    <select id="edit-species-${sighting.id}" class="species-select">
                      ${optionsHTML}
                    </select>
                  </div>
                  <div class="form-group">
                    <label>Pod Size:</label>
                    <input type="number" id="edit-pod-size-${sighting.id}" class="pod-size-input" value="${sighting.pod_size || 1}" min="1" max="50" />
                  </div>
                  <div class="form-group">
                    <label>Description:</label>
                    <textarea id="edit-description-${sighting.id}" class="description-input" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; resize: vertical;" rows="2"></textarea>
                  </div>
                  <p style="font-size: 0.85rem; color: #666; margin: 0.5rem 0;">Drag the marker to update location</p>
                  <button id="save-edit-${sighting.id}" class="report-btn" style="width: 100%; padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 8px;">
                    Save Changes
                  </button>
                ` : `
                   <p><strong>Pod Size:</strong> ${sighting.pod_size || 1}</p>
                   <p><strong>Details:</strong> ${sighting.description}</p>
                 `}
               </div>
             `
             
             existingMarker.setPopupContent(popupHTML)
             
             if (isOwner) {
               existingMarker.off('popupopen')
               existingMarker.on('popupopen', () => {
                 const setupFormHandlers = () => {
                   const speciesSelect = document.getElementById(`edit-species-${sighting.id}`) as HTMLSelectElement
                   const podSizeInput = document.getElementById(`edit-pod-size-${sighting.id}`) as HTMLInputElement
                   const descriptionInput = document.getElementById(`edit-description-${sighting.id}`) as HTMLTextAreaElement
                   const saveBtn = document.getElementById(`save-edit-${sighting.id}`) as HTMLButtonElement

                   if (!speciesSelect || !podSizeInput || !descriptionInput || !saveBtn) {
                     console.log('[Form Setup] Retrying - elements not found yet', {
                       speciesSelect: !!speciesSelect,
                       podSizeInput: !!podSizeInput,
                       descriptionInput: !!descriptionInput,
                       saveBtn: !!saveBtn,
                     })
                     setTimeout(setupFormHandlers, 50)
                     return
                   }

                   if (speciesSelect.options.length === 0) {
                     console.log('[Form Setup] Retrying - dropdown options not ready')
                     setTimeout(setupFormHandlers, 50)
                     return
                   }

                   const currentSighting = sightings.find(s => s.id === sighting.id)
                   if (!currentSighting) {
                     console.error('[Form Setup] Could not find current sighting', sighting.id, 'available IDs:', sightings.map(s => s.id))
                     return
                   }

                   console.log('[Form Setup] Current sighting data:', {
                     id: currentSighting.id,
                     species_id: currentSighting.species_id,
                     pod_size: currentSighting.pod_size,
                     description: currentSighting.description,
                   })

                   let speciesValue = String(currentSighting.species_id)
                   const validSpeciesIds = ['1', '2', '3', '4', '5', '6']
                   if (!validSpeciesIds.includes(speciesValue)) {
                     console.warn('[Form Setup] Invalid species ID:', speciesValue, '- using default')
                     speciesValue = '2'
                   }
                   
                   console.log('[Form Setup] Setting form values:', {
                     species: speciesValue,
                     podSize: String(currentSighting.pod_size || 1),
                     description: currentSighting.description || '',
                     dropdownCurrentValue: speciesSelect.value,
                   })
                   
                   speciesSelect.value = speciesValue
                   podSizeInput.value = String(currentSighting.pod_size || 1)
                   descriptionInput.value = currentSighting.description || ''
                   
                   console.log('[Form Setup] Form values after setting:', {
                     species: speciesSelect.value,
                     podSize: podSizeInput.value,
                     description: descriptionInput.value,
                   })
                   
                   if (speciesSelect.value !== speciesValue) {
                     console.error('[Form Setup] MISMATCH - Expected species', speciesValue, 'but dropdown shows', speciesSelect.value)
                   }
                   
                   console.log('[Form Setup] Form populated successfully')

                   console.log('[Form Setup] Elements found and populated for sighting', sighting.id)

                   const listenerKey = `save-click-${sighting.id}`
                   const oldListener = eventListenersRef.current.get(listenerKey)
                   if (oldListener && saveBtn) {
                     saveBtn.removeEventListener('click', oldListener)
                   }

                   const handleSaveClick = async () => {
                     console.log('[Save Click] Clicked save button for sighting', sighting.id)
                     
                     const speciesValue = (document.getElementById(`edit-species-${sighting.id}`) as HTMLSelectElement)?.value
                     const podSizeValue = (document.getElementById(`edit-pod-size-${sighting.id}`) as HTMLInputElement)?.value
                     const descValue = (document.getElementById(`edit-description-${sighting.id}`) as HTMLTextAreaElement)?.value

                     console.log('[Save Click] Form values:', {
                       species: speciesValue,
                       podSize: podSizeValue,
                       description: descValue,
                     })
                     
                     try {
                       if (!client) {
                         alert('Error: Not connected to backend')
                         return
                       }

                       const latestSighting = sightings.find(s => s.id === sighting.id)
                       if (!latestSighting) {
                         console.error('[Save] Could not find latest sighting')
                         return
                       }

                       const markerPos = existingMarker.getLatLng()
                       const newSpecies = parseInt(speciesValue || String(latestSighting.species_id))
                       const newPodSize = parseInt(podSizeValue || String(latestSighting.pod_size || 1))
                       const newDesc = descValue || latestSighting.description

                       console.log('[Save] Sending update with:', {
                         sightingId: sighting.id,
                         newSpecies,
                         newPodSize,
                         newDesc,
                         lat: markerPos.lat,
                         lng: markerPos.lng,
                       })

                       await client.updateSighting(
                         sighting.id,
                         newSpecies,
                         markerPos.lat,
                         markerPos.lng,
                         newDesc,
                         newPodSize,
                       )

                     console.log('[Update] Sighting updated successfully')
                     setMessage('Sighting updated successfully!')
                     
                     existingMarker.closePopup()
                     } catch (err) {
                       console.error('Failed to update sighting:', err)
                       alert(`Failed to update sighting: ${err instanceof Error ? err.message : 'Unknown error'}`)
                     }
                   }
                   
                   eventListenersRef.current.set(listenerKey, handleSaveClick)
                   saveBtn.addEventListener('click', handleSaveClick)
                 }

                 setupFormHandlers()
               })
             }
           }
         }
      })
   }, [sightings, username, client, species])

  // Sidebar row → map: fly to the pin and open its (editable) details popup.
  const focusSighting = (id: number) => {
    const marker = markersRef.current.get(id)
    if (!marker || !mapRef.current) return
    mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 6), {
      duration: 0.8,
    })
    marker.openPopup()
  }

  return (
    <div className="map-container">
      <div id="map" className="map"></div>
      <div className="sighting-list">
        <h3>Recent Sightings ({sightings.length})</h3>
        <p style={{ fontSize: '0.8rem', color: '#666', margin: '0 0 1rem 0' }}>{message}</p>
        <div className="sightings-scroll">
          {sightings.length === 0 ? (
            <p className="no-sightings">No sightings yet. Be the first to report!</p>
          ) : (
            sightings.map((sighting) => (
              <div
                key={sighting.id}
                className="sighting-item"
                role="button"
                tabIndex={0}
                onClick={() => focusSighting(sighting.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    focusSighting(sighting.id)
                  }
                }}
                title="Show on map"
                style={{ cursor: 'pointer' }}
              >
                <h4>{speciesName(sighting.species_id)}</h4>
                <p className="sighting-user">by {sighting.username}</p>
                <p className="sighting-time">
                  {new Date(sighting.timestamp).toLocaleDateString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
