import * as THREE from 'three'

export function createAutoRickshaw(paintColor: string, plateTexture: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group()

  const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.3, metalness: 0.1 })
  const yellowHoodMat = new THREE.MeshStandardMaterial({ color: 0xFBC02D, roughness: 0.4 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1E242E, roughness: 0.8 })
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1A2536, roughness: 0.2, transparent: true, opacity: 0.85 })
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xFFFDE7, emissive: 0xFFF9C4, emissiveIntensity: 0.5 })
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xFF1744, emissive: 0xD50000, emissiveIntensity: 0.5 })
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture })

  // Lower Cabin / Floor (Black/Dark)
  const floorGeo = new THREE.BoxGeometry(1.05, 0.45, 1.85)
  const floor = new THREE.Mesh(floorGeo, darkMat)
  floor.position.set(0, 0.42, 0)
  group.add(floor)

  // Front Nose Cowl (Painted)
  const noseGeo = new THREE.BoxGeometry(0.72, 0.45, 0.55)
  const nose = new THREE.Mesh(noseGeo, paintMat)
  nose.position.set(0, 0.52, 0.78)
  group.add(nose)

  // Roof Hood Canvas (Classic Auto yellow or paint color)
  const hoodGeo = new THREE.BoxGeometry(1.08, 0.48, 1.35)
  const hood = new THREE.Mesh(hoodGeo, yellowHoodMat)
  hood.position.set(0, 0.98, -0.2)
  group.add(hood)

  // Windscreen
  const glassGeo = new THREE.BoxGeometry(0.72, 0.38, 0.08)
  const glass = new THREE.Mesh(glassGeo, glassMat)
  glass.position.set(0, 0.88, 0.82)
  group.add(glass)

  // Driver / Passenger Seats (Dark)
  const seatGeo = new THREE.BoxGeometry(0.9, 0.1, 0.45)
  const seat = new THREE.Mesh(seatGeo, darkMat)
  seat.position.set(0, 0.68, -0.45)
  group.add(seat)

  // 3 Wheels (1 Front Center, 2 Rear Side)
  const wheelGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.12, 16)
  wheelGeo.rotateZ(Math.PI / 2)

  const frontWheel = new THREE.Mesh(wheelGeo, darkMat)
  frontWheel.position.set(0, 0.24, 0.85)
  group.add(frontWheel)

  const rearWheelL = new THREE.Mesh(wheelGeo, darkMat)
  rearWheelL.position.set(-0.55, 0.24, -0.65)
  group.add(rearWheelL)

  const rearWheelR = new THREE.Mesh(wheelGeo, darkMat)
  rearWheelR.position.set(0.55, 0.24, -0.65)
  group.add(rearWheelR)

  // Single Headlight
  const headGeo = new THREE.SphereGeometry(0.12, 12, 12)
  const headlight = new THREE.Mesh(headGeo, lightMat)
  headlight.position.set(0, 0.52, 1.06)
  group.add(headlight)

  // Taillights
  const tailGeo = new THREE.BoxGeometry(0.15, 0.08, 0.05)
  const tailL = new THREE.Mesh(tailGeo, tailMat)
  tailL.position.set(-0.42, 0.45, -0.93)
  group.add(tailL)
  const tailR = new THREE.Mesh(tailGeo, tailMat)
  tailR.position.set(0.42, 0.45, -0.93)
  group.add(tailR)

  // Rear Plate
  const plateGeo = new THREE.BoxGeometry(0.35, 0.12, 0.02)
  const plateMesh = new THREE.Mesh(plateGeo, plateMat)
  plateMesh.position.set(0, 0.38, -0.93)
  group.add(plateMesh)

  return group
}
