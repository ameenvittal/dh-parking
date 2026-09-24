export type BodyStyle =
  | 'motorcycle'
  | 'scooter'
  | 'hatchback'
  | 'sedan'
  | 'suv'
  | 'bus'
  | 'autorickshaw'

const SCOOTERS = [
  'activa',
  'jupiter',
  'access',
  'dio',
  'pleasure',
  'ntorq',
  'fascino',
  'vespa',
  'chetak',
  'burgman',
  'ray',
  'destini',
  'avator',
  's1',
  'ola',
  'iqube',
  'chetek',
  'pep',
]

const SEDANS = [
  'city',
  'verna',
  'dzire',
  'ciaz',
  'slavia',
  'virtus',
  'amaze',
  'tigor',
  'aura',
  'octavia',
  'camry',
  'accord',
  'civic',
  'corolla',
  'superb',
  'caz',
  'sunny',
  'passat',
  'jetta',
  'elantra',
]

const SUVS = [
  'creta',
  'seltos',
  'thar',
  'fortuner',
  'harrier',
  'safari',
  'nexon',
  'scorpio',
  'bolero',
  'brezza',
  'venue',
  'punch',
  'xuv',
  'compass',
  'duster',
  'kwid',
  'magnite',
  'triber',
  'kiger',
  'alcazar',
  'hector',
  'gloster',
  'endeavour',
  'innova',
  'ertiga',
  'carens',
  'hycross',
  'taigun',
  'kushaq',
  'fronx',
  'exter',
  'jimny',
  'curvv',
  'ev6',
  'ioniq',
]

export function bodyStyleFor(make?: string | null, type?: string | null): BodyStyle {
  const normType = (type || '').toLowerCase().trim()
  const normMake = (make || '').toLowerCase().trim()

  if (normType === 'bike') {
    if (SCOOTERS.some((s) => normMake.includes(s))) {
      return 'scooter'
    }
    return 'motorcycle'
  }

  if (normType === 'car' || normType === 'ev') {
    if (SEDANS.some((s) => normMake.includes(s))) {
      return 'sedan'
    }
    if (SUVS.some((s) => normMake.includes(s))) {
      return 'suv'
    }
    return 'hatchback'
  }

  if (normType === 'bus') {
    return 'bus'
  }

  if (normType === 'other') {
    return 'autorickshaw'
  }

  return 'hatchback'
}
