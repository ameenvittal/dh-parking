import * as THREE from 'three'

export function createScooter(paintColor: string, plateTexture: THREE.CanvasTexture): THREE.Group {
  const group = new THREE.Group()

  const paintMat = new THREE.MeshStandardMaterial({ color: paintColor, roughness: 0.3, metalness: 0.1 })
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1E242E, roughness: 0.8 })
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xC0C4CC, metalness: 0.6, roughness: 0.3 })
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xFFFDE7, emissive: 0xFFF9C4, emissiveIntensity: 0.5 })
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xFF1744, emissive: 0xD50000, emissiveIntensity: 0.5 })
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture })

  // Wheels (Small scooter wheels)
  const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.12, 16)
  wheelGeo.rotateZ(Math.PI / 2)

  const frontWheel = new THREE.Mesh(wheelGeo, darkMat)
  frontWheel.position.set(0, 0.25, 0.95)
  group.add(frontWheel)

  const rearWheel = new THREE.Mesh(wheelGeo, darkMat)
  rearWheel.position.set(0, 0.25, -0.85)
  group.add(rearWheel)

  // Floorboard (Black)
  const floorGeo = new THREE.BoxGeometry(0.48, 0.08, 0.65)
  const floor = new THREE.Mesh(floorGeo, darkMat)
  floor.position.set(0, 0.28, 0.05)
  group.add(floor)

  // Front Apron (Painted Shield)
  const apronGeo = new THREE.BoxGeometry(0.46, 0.65, 0.25)
  const apron = new THREE.Mesh(apronGeo, paintMat)
  apron.position.set(0, 0.65, 0.75)
  group.add(apron)

  // Handlebar Cowl (Painted)
  const cowlGeo = new THREE.BoxGeometry(0.55, 0.22, 0.25)
  const cowl = new THREE.Mesh(cowlGeo, paintMat)
  cowl.position.set(0, 1.05, 0.72)
  group.add(cowl)

  // Headlight in Cowl
  const headGeo = new THREE.BoxGeometry(0.25, 0.12, 0.05)
  const headlight = new THREE.Mesh(headGeo, lightMat)
  headlight.position.set(0, 1.05, 0.85)
  group.add(headlight)

  // Rear Body Pod (Painted)
  const bodyGeo = new THREE.BoxGeometry(0.52, 0.48, 0.95)
  const body = new THREE.Mesh(bodyGeo, paintMat)
  body.position.set(0, 0.55, -0.42)
  group.add(body)

  // Seat (Black)
  const seatGeo = new THREE.BoxGeometry(0.44, 0.12, 0.85)
  const seat = new THREE.Mesh(seatGeo, darkMat)
  seat.position.set(0, 0.82, -0.38)
  group.add(seat)

  // Grab Rail (Metal)
  const railGeo = new THREE.BoxGeometry(0.38, 0.05, 0.1)
  const rail = new THREE.Mesh(railGeo, metalMat)
  rail.position.set(0, 0.88, -0.86)
  group.add(rail)

  // Taillight
  const tailGeo = new THREE.BoxGeometry(0.3, 0.1, 0.05)
  const taillight = new THREE.Mesh(tailGeo, tailMat)
  taillight.position.set(0, 0.62, -0.91)
  group.add(taillight)

  // Rear Plate
  const plateGeo = new THREE.BoxGeometry(0.3, 0.12, 0.02)
  const plateMesh = new THREE.Mesh(plateGeo, plateMat)
  plateMesh.position.set(0, 0.45, -0.91)
  group.add(plateMesh)

  return group
}
