import * as THREE from 'three'

export function createSUV(paintColor: string, plateTexture: THREE.CanvasTexture, isEV = false): THREE.Group {
  const group = new THREE.Group()

  const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.3, metalness: 0.1 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1E242E, roughness: 0.8 })
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xD1D5DB, metalness: 0.6, roughness: 0.3 })
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1A2536, roughness: 0.2, transparent: true, opacity: 0.85 })
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xFFFDE7, emissive: 0xFFF9C4, emissiveIntensity: 0.5 })
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xFF1744, emissive: 0xD50000, emissiveIntensity: 0.5 })
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture })
  const evGreenMat = new THREE.MeshStandardMaterial({ color: 0x1E8E52, roughness: 0.4 })

  // Taller Chassis / Body (SUV stance)
  const lowerGeo = new THREE.BoxGeometry(1.5, 0.65, 2.7)
  const lower = new THREE.Mesh(lowerGeo, paintMat)
  lower.position.set(0, 0.62, 0)
  group.add(lower)

  // Boxier Cabin (Tall SUV roof profile)
  const cabinGeo = new THREE.BoxGeometry(1.36, 0.62, 1.7)
  const cabin = new THREE.Mesh(cabinGeo, paintMat)
  cabin.position.set(0, 1.18, -0.1)
  group.add(cabin)

  // Roof Rails (Black)
  const railLGeo = new THREE.BoxGeometry(0.06, 0.06, 1.5)
  const railL = new THREE.Mesh(railLGeo, darkMat)
  railL.position.set(-0.62, 1.52, -0.1)
  group.add(railL)
  const railR = new THREE.Mesh(railLGeo, darkMat)
  railR.position.set(0.62, 1.52, -0.1)
  group.add(railR)

  // Windows / Glass
  const glassFrontGeo = new THREE.BoxGeometry(1.3, 0.5, 0.4)
  const glassFront = new THREE.Mesh(glassFrontGeo, glassMat)
  glassFront.position.set(0, 1.2, 0.55)
  group.add(glassFront)

  const glassRearGeo = new THREE.BoxGeometry(1.3, 0.5, 0.35)
  const glassRear = new THREE.Mesh(glassRearGeo, glassMat)
  glassRear.position.set(0, 1.2, -0.85)
  group.add(glassRear)

  // Larger SUV Wheels (Higher clearance)
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 16)
  wheelGeo.rotateZ(Math.PI / 2)
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.23, 12)
  rimGeo.rotateZ(Math.PI / 2)

  const wheelPositions = [
    [-0.78, 0.36, 0.88],
    [0.78, 0.36, 0.88],
    [-0.78, 0.36, -0.88],
    [0.78, 0.36, -0.88],
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
  const headGeo = new THREE.BoxGeometry(0.35, 0.16, 0.05)
  const headL = new THREE.Mesh(headGeo, lightMat)
  headL.position.set(-0.52, 0.76, 1.36)
  group.add(headL)
  const headR = new THREE.Mesh(headGeo, lightMat)
  headR.position.set(0.52, 0.76, 1.36)
  group.add(headR)

  // Taillights
  const tailGeo = new THREE.BoxGeometry(0.12, 0.35, 0.05)
  const tailL = new THREE.Mesh(tailGeo, tailMat)
  tailL.position.set(-0.62, 1.05, -1.36)
  group.add(tailL)
  const tailR = new THREE.Mesh(tailGeo, tailMat)
  tailR.position.set(0.62, 1.05, -1.36)
  group.add(tailR)

  // Spare tire / Rear Plate
  const plateGeo = new THREE.BoxGeometry(0.48, 0.15, 0.03)
  const plateMesh = new THREE.Mesh(plateGeo, plateMat)
  plateMesh.position.set(0, 0.62, -1.36)
  group.add(plateMesh)

  // Front Plate
  const frontPlateMesh = new THREE.Mesh(plateGeo, plateMat)
  frontPlateMesh.position.set(0, 0.42, 1.36)
  group.add(frontPlateMesh)

  // EV Charge Port Detail
  if (isEV) {
    const portGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12)
    portGeo.rotateZ(Math.PI / 2)
    const port = new THREE.Mesh(portGeo, evGreenMat)
    port.position.set(0.76, 0.82, 0.6)
    group.add(port)
  }

  return group
}
