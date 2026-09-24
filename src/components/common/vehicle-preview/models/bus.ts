import * as THREE from 'three'

export function createBus(paintColor: string, plateTexture: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group()

  const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.3, metalness: 0.1 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1E242E, roughness: 0.8 })
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xD1D5DB, metalness: 0.6, roughness: 0.3 })
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1A2536, roughness: 0.2, transparent: true, opacity: 0.85 })
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xFFFDE7, emissive: 0xFFF9C4, emissiveIntensity: 0.5 })
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xFF1744, emissive: 0xD50000, emissiveIntensity: 0.5 })
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture })

  // Long Bus Body (Painted)
  const bodyGeo = new THREE.BoxGeometry(1.5, 1.25, 4.2)
  const body = new THREE.Mesh(bodyGeo, paintMat)
  body.position.set(0, 0.95, 0)
  group.add(body)

  // Side Window Bands (Dark glass strips)
  const windowSideGeo = new THREE.BoxGeometry(1.52, 0.45, 3.4)
  const windowSide = new THREE.Mesh(windowSideGeo, glassMat)
  windowSide.position.set(0, 1.15, -0.2)
  group.add(windowSide)

  // Front Windscreen
  const glassFrontGeo = new THREE.BoxGeometry(1.42, 0.55, 0.1)
  const glassFront = new THREE.Mesh(glassFrontGeo, glassMat)
  glassFront.position.set(0, 1.18, 2.11)
  group.add(glassFront)

  // Rear Glass
  const glassRearGeo = new THREE.BoxGeometry(1.35, 0.45, 0.1)
  const glassRear = new THREE.Mesh(glassRearGeo, glassMat)
  glassRear.position.set(0, 1.18, -2.11)
  group.add(glassRear)

  // Bus Wheels (6 Wheels: 2 Front, 4 Rear)
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.22, 16)
  wheelGeo.rotateZ(Math.PI / 2)
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.23, 12)
  rimGeo.rotateZ(Math.PI / 2)

  const wheelPositions = [
    [-0.78, 0.38, 1.4],
    [0.78, 0.38, 1.4],
    [-0.78, 0.38, -1.1],
    [0.78, 0.38, -1.1],
    [-0.78, 0.38, -1.6],
    [0.78, 0.38, -1.6],
  ] as const

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, darkMat)
    wheel.position.set(x, y, z)
    group.add(wheel)

    const rim = new THREE.Mesh(rimGeo, rimMat)
    rim.position.set(x, y, z)
    group.add(rim)
  })

  // Headlights
  const headGeo = new THREE.BoxGeometry(0.32, 0.16, 0.05)
  const headL = new THREE.Mesh(headGeo, lightMat)
  headL.position.set(-0.52, 0.52, 2.11)
  group.add(headL)
  const headR = new THREE.Mesh(headGeo, lightMat)
  headR.position.set(0.52, 0.52, 2.11)
  group.add(headR)

  // Taillights
  const tailGeo = new THREE.BoxGeometry(0.25, 0.16, 0.05)
  const tailL = new THREE.Mesh(tailGeo, tailMat)
  tailL.position.set(-0.52, 0.52, -2.11)
  group.add(tailL)
  const tailR = new THREE.Mesh(tailGeo, tailMat)
  tailR.position.set(0.52, 0.52, -2.11)
  group.add(tailR)

  // Rear Plate
  const plateGeo = new THREE.BoxGeometry(0.5, 0.16, 0.03)
  const plateMesh = new THREE.Mesh(plateGeo, plateMat)
  plateMesh.position.set(0, 0.52, -2.11)
  group.add(plateMesh)

  // Front Plate
  const frontPlateMesh = new THREE.Mesh(plateGeo, plateMat)
  frontPlateMesh.position.set(0, 0.38, 2.11)
  group.add(frontPlateMesh)

  return group
}
