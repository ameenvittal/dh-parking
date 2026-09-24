import * as THREE from 'three'

export function createMotorcycle(paintColor: string, plateTexture: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group()

  const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.3, metalness: 0.1 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1E242E, roughness: 0.8 })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xC0C4CC, metalness: 0.8, roughness: 0.2 })
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1A2536, roughness: 0.2, transparent: true, opacity: 0.85 })
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xFFFDE7, emissive: 0xFFF9C4, emissiveIntensity: 0.5 })
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xFF1744, emissive: 0xD50000, emissiveIntensity: 0.5 })
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture })

  // Wheels (Front & Back)
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16)
  wheelGeo.rotateZ(Math.PI / 2)

  const frontWheel = new THREE.Mesh(wheelGeo, darkMat)
  frontWheel.position.set(0, 0.35, 1.1)
  group.add(frontWheel)

  const rearWheel = new THREE.Mesh(wheelGeo, darkMat)
  rearWheel.position.set(0, 0.35, -1.0)
  group.add(rearWheel)

  // Spokes / Rims
  const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.13, 12)
  rimGeo.rotateZ(Math.PI / 2)
  const frontRim = new THREE.Mesh(rimGeo, metalMat)
  frontRim.position.copy(frontWheel.position)
  group.add(frontRim)
  const rearRim = new THREE.Mesh(rimGeo, metalMat)
  rearRim.position.copy(rearWheel.position)
  group.add(rearRim)

  // Frame / Engine block
  const engineGeo = new THREE.BoxGeometry(0.35, 0.4, 0.6)
  const engine = new THREE.Mesh(engineGeo, metalMat)
  engine.position.set(0, 0.55, 0.1)
  group.add(engine)

  // Fuel Tank (Painted)
  const tankGeo = new THREE.BoxGeometry(0.42, 0.35, 0.75)
  const tank = new THREE.Mesh(tankGeo, paintMat)
  tank.position.set(0, 0.85, 0.3)
  group.add(tank)

  // Seat (Black)
  const seatGeo = new THREE.BoxGeometry(0.38, 0.15, 0.8)
  const seat = new THREE.Mesh(seatGeo, darkMat)
  seat.position.set(0, 0.82, -0.45)
  group.add(seat)

  // Handlebars
  const barGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8)
  barGeo.rotateZ(Math.PI / 2)
  const bar = new THREE.Mesh(barGeo, metalMat)
  bar.position.set(0, 1.05, 0.75)
  group.add(bar)

  // Headlight
  const headGeo = new THREE.SphereGeometry(0.12, 12, 12)
  const headlight = new THREE.Mesh(headGeo, lightMat)
  headlight.position.set(0, 0.95, 0.95)
  group.add(headlight)

  // Windscreen / Cowl
  const cowlGeo = new THREE.BoxGeometry(0.3, 0.25, 0.1)
  const cowl = new THREE.Mesh(cowlGeo, glassMat)
  cowl.position.set(0, 1.12, 0.82)
  group.add(cowl)

  // Rear Fender & Taillight
  const fenderGeo = new THREE.BoxGeometry(0.25, 0.08, 0.4)
  const fender = new THREE.Mesh(fenderGeo, paintMat)
  fender.position.set(0, 0.72, -1.05)
  group.add(fender)

  const tailGeo = new THREE.BoxGeometry(0.15, 0.08, 0.05)
  const taillight = new THREE.Mesh(tailGeo, tailMat)
  taillight.position.set(0, 0.75, -1.26)
  group.add(taillight)

  // Rear Plate
  const plateGeo = new THREE.BoxGeometry(0.32, 0.12, 0.02)
  const plateMesh = new THREE.Mesh(plateGeo, plateMat)
  plateMesh.position.set(0, 0.58, -1.26)
  group.add(plateMesh)

  return group
}
