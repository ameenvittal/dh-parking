import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { bodyStyleFor } from './bodyStyle'
import { createAutoRickshaw } from './models/autorickshaw'
import { createBus } from './models/bus'
import { createHatchback } from './models/hatchback'
import { createMotorcycle } from './models/motorcycle'
import { createScooter } from './models/scooter'
import { createSedan } from './models/sedan'
import { createSUV } from './models/suv'
import { paintFor } from './paint'
import { createPlateTexture } from './plateTexture'

interface VehicleSceneProps {
  vehicleType: string
  color?: string | null
  make?: string | null
  plate?: string | null
  onLoaded?: () => void
  onRotationChange?: (angle: number) => void
}

export const VehicleScene: React.FC<VehicleSceneProps> = ({
  vehicleType,
  color,
  make,
  plate,
  onLoaded,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const previousXRef = useRef(0)
  const velocityRef = useRef(0)
  const turntableGroupRef = useRef<THREE.Group | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const width = container.clientWidth || 300
    const height = container.clientHeight || 176

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      // If WebGL fails, component caller handles fallback silhouette
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = false
    container.replaceChildren(renderer.domElement)

    const scene = new THREE.Scene()

    // Camera
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50)
    camera.position.set(3.8, 2.2, 4.5)
    camera.lookAt(0, 0.5, 0)

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95)
    scene.add(ambientLight)

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight1.position.set(5, 10, 6)
    scene.add(dirLight1)

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
    dirLight2.position.set(-5, 4, -4)
    scene.add(dirLight2)

    // Soft ground shadow disk
    const shadowGeo = new THREE.CircleGeometry(2.4, 24)
    shadowGeo.rotateX(-Math.PI / 2)
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x162033, opacity: 0.12, transparent: true })
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat)
    shadowMesh.position.y = 0.01
    scene.add(shadowMesh)

    // Turntable Group
    const turntableGroup = new THREE.Group()
    turntableGroupRef.current = turntableGroup
    scene.add(turntableGroup)

    // Build Model
    const bodyStyle = bodyStyleFor(make, vehicleType)
    const paintColor = paintFor(color)
    const isEV = (vehicleType || '').toLowerCase() === 'ev'
    const plateTex = createPlateTexture(plate, isEV)

    let modelGroup: THREE.Group
    switch (bodyStyle) {
      case 'motorcycle':
        modelGroup = createMotorcycle(paintColor, plateTex)
        break
      case 'scooter':
        modelGroup = createScooter(paintColor, plateTex)
        break
      case 'sedan':
        modelGroup = createSedan(paintColor, plateTex, isEV)
        break
      case 'suv':
        modelGroup = createSUV(paintColor, plateTex, isEV)
        break
      case 'bus':
        modelGroup = createBus(paintColor, plateTex)
        break
      case 'autorickshaw':
        modelGroup = createAutoRickshaw(paintColor, plateTex)
        break
      case 'hatchback':
      default:
        modelGroup = createHatchback(paintColor, plateTex, isEV)
        break
    }

    turntableGroup.add(modelGroup)

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Initial positioning & Entrance Animation
    const targetAngle = Math.PI / 6
    let animationFrameId: number
    let isVisible = true
    let startTime: number | null = null
    const entranceDuration = 400

    if (prefersReducedMotion) {
      turntableGroup.rotation.y = targetAngle
      turntableGroup.position.set(0, 0, 0)
    } else {
      turntableGroup.rotation.y = targetAngle - Math.PI / 3
      turntableGroup.position.x = 2.5
    }

    // Pointer events for swipe/drag rotation
    const handlePointerDown = (e: PointerEvent) => {
      isDraggingRef.current = true
      previousXRef.current = e.clientX
      velocityRef.current = 0
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return
      const deltaX = e.clientX - previousXRef.current
      previousXRef.current = e.clientX
      velocityRef.current = deltaX * 0.008
      turntableGroup.rotation.y += velocityRef.current
    }

    const handlePointerUp = () => {
      isDraggingRef.current = false
    }

    const domElem = renderer.domElement
    domElem.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    const parent = container.parentElement ?? container
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        turntableGroup.rotation.y -= 0.15
        e.preventDefault()
      } else if (e.key === 'ArrowRight') {
        turntableGroup.rotation.y += 0.15
        e.preventDefault()
      }
    }
    parent.addEventListener('keydown', handleKeyDown)

    // Render loop
    const animate = (timestamp: number) => {
      if (!isVisible) return

      if (!prefersReducedMotion) {
        if (!startTime) startTime = timestamp
        const elapsed = timestamp - startTime
        if (elapsed < entranceDuration) {
          const progress = elapsed / entranceDuration
          const easeOut = 1 - Math.pow(1 - progress, 3)
          turntableGroup.position.x = 2.5 * (1 - easeOut)
          turntableGroup.rotation.y = (targetAngle - Math.PI / 3) + (Math.PI / 3) * easeOut
        } else {
          turntableGroup.position.x = 0
          if (!isDraggingRef.current) {
            if (Math.abs(velocityRef.current) > 0.0001) {
              turntableGroup.rotation.y += velocityRef.current
              velocityRef.current *= 0.92
            } else {
              turntableGroup.rotation.y += 0.004
            }
          }
        }
      } else {
        if (Math.abs(velocityRef.current) > 0.0001) {
          turntableGroup.rotation.y += velocityRef.current
          velocityRef.current *= 0.92
        }
      }

      renderer.render(scene, camera)
      animationFrameId = requestAnimationFrame(animate)
    }

    // IntersectionObserver to pause rendering when offscreen
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        isVisible = entry?.isIntersecting ?? true
        if (isVisible) {
          animationFrameId = requestAnimationFrame(animate)
        } else {
          cancelAnimationFrame(animationFrameId)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(container)

    // Visibility API
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisible = false
        cancelAnimationFrame(animationFrameId)
      } else {
        isVisible = true
        animationFrameId = requestAnimationFrame(animate)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // ResizeObserver
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return
      const w = container.clientWidth || 300
      const h = container.clientHeight || 176
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(container)

    // Start loop
    animationFrameId = requestAnimationFrame(animate)
    if (onLoaded) onLoaded()

    return () => {
      cancelAnimationFrame(animationFrameId)
      observer.disconnect()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      domElem.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      parent.removeEventListener('keydown', handleKeyDown)

      plateTex.dispose()

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose()
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((m) => m.dispose())
            } else {
              obj.material.dispose()
            }
          }
        }
      })

      renderer.dispose()
      if (domElem.parentNode) {
        domElem.parentNode.removeChild(domElem)
      }
    }
  }, [vehicleType, color, make, plate, onLoaded])

  return <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
}

export default VehicleScene
