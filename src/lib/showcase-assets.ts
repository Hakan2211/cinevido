// Showcase assets hosted on Bunny CDN
const CDN_BASE = 'https://vidcin.b-cdn.net'

// Hero images - featured prominently
export const heroImages = [
  `${CDN_BASE}/landingpage/images/pantherandwoman.jpg`,
  `${CDN_BASE}/landingpage/images/robotgirl.jpg`,
  `${CDN_BASE}/landingpage/images/moonlitlandscape.jpg`,
  `${CDN_BASE}/landingpage/images/dancetango.jpg`,
  `${CDN_BASE}/landingpage/images/humanhanddigitalahndreaching.jpg`,
]

// All gallery images with metadata
export const galleryImages = [
  // Portraits/People
  {
    src: `${CDN_BASE}/landingpage/images/blondewoman.jpg`,
    category: 'portraits',
    alt: 'AI Generated Blonde Woman Portrait',
  },
  {
    src: `${CDN_BASE}/landingpage/images/humandistancelooking.jpg`,
    category: 'portraits',
    alt: 'Human Looking into Distance',
  },
  {
    src: `${CDN_BASE}/landingpage/images/humanclothes.jpg`,
    category: 'portraits',
    alt: 'Human with Stylized Clothes',
  },
  {
    src: `${CDN_BASE}/landingpage/images/profilephoto.jpg`,
    category: 'portraits',
    alt: 'Professional Profile Photo',
  },
  {
    src: `${CDN_BASE}/landingpage/images/realisticportraitasian.jpg`,
    category: 'portraits',
    alt: 'Realistic Asian Portrait',
  },
  {
    src: `${CDN_BASE}/landingpage/images/pantherandwoman.jpg`,
    category: 'portraits',
    alt: 'Woman with Panther',
  },

  // Abstract/Surreal
  {
    src: `${CDN_BASE}/landingpage/images/abstractheart.jpg`,
    category: 'abstract',
    alt: 'Abstract Heart Art',
  },
  {
    src: `${CDN_BASE}/landingpage/images/brainwithflowers.jpg`,
    category: 'abstract',
    alt: 'Brain with Flowers',
  },
  {
    src: `${CDN_BASE}/landingpage/images/ethernaliamge.jpg`,
    category: 'abstract',
    alt: 'Ethereal Abstract Image',
  },
  {
    src: `${CDN_BASE}/landingpage/images/humanenergyabstract.jpg`,
    category: 'abstract',
    alt: 'Human Energy Abstract',
  },
  {
    src: `${CDN_BASE}/landingpage/images/humanfetusinsidetheworld.jpg`,
    category: 'abstract',
    alt: 'Human Fetus Concept Art',
  },
  {
    src: `${CDN_BASE}/landingpage/images/humanhanddigitalahndreaching.jpg`,
    category: 'abstract',
    alt: 'Digital Hand Reaching',
  },
  {
    src: `${CDN_BASE}/landingpage/images/surrealhumannature.jpg`,
    category: 'abstract',
    alt: 'Surreal Human Nature',
  },

  // Hybrid Creatures
  {
    src: `${CDN_BASE}/landingpage/images/hybridcreature.jpg`,
    category: 'creatures',
    alt: 'Hybrid Creature',
  },
  {
    src: `${CDN_BASE}/landingpage/images/hybridparrothorse.jpg`,
    category: 'creatures',
    alt: 'Parrot Horse Hybrid',
  },
  {
    src: `${CDN_BASE}/landingpage/images/rhinohybridmerged.jpg`,
    category: 'creatures',
    alt: 'Rhino Hybrid',
  },
  {
    src: `${CDN_BASE}/landingpage/images/robotcat.jpg`,
    category: 'creatures',
    alt: 'Robot Cat',
  },
  {
    src: `${CDN_BASE}/landingpage/images/robotgirl.jpg`,
    category: 'creatures',
    alt: 'Robot Girl',
  },
  {
    src: `${CDN_BASE}/landingpage/images/whitetigermodel.jpg`,
    category: 'creatures',
    alt: 'White Tiger Model',
  },

  // Nature/Landscapes
  {
    src: `${CDN_BASE}/landingpage/images/ancientoaktree.jpg`,
    category: 'nature',
    alt: 'Ancient Oak Tree',
  },
  {
    src: `${CDN_BASE}/landingpage/images/bonsai.jpg`,
    category: 'nature',
    alt: 'Bonsai Tree',
  },
  {
    src: `${CDN_BASE}/landingpage/images/moonlitlandscape.jpg`,
    category: 'nature',
    alt: 'Moonlit Landscape',
  },

  // Artistic/Illustration
  {
    src: `${CDN_BASE}/landingpage/images/dancetango.jpg`,
    category: 'artistic',
    alt: 'Tango Dance',
  },
  {
    src: `${CDN_BASE}/landingpage/images/dnastring.jpg`,
    category: 'artistic',
    alt: 'DNA String Visualization',
  },
  {
    src: `${CDN_BASE}/landingpage/images/lionillustration.jpg`,
    category: 'artistic',
    alt: 'Lion Illustration',
  },
  {
    src: `${CDN_BASE}/landingpage/images/michaeljacksondancing.jpg`,
    category: 'artistic',
    alt: 'Dancing Figure',
  },
  {
    src: `${CDN_BASE}/landingpage/images/venuscity.jpg`,
    category: 'artistic',
    alt: 'Venus City',
  },

  // 3D Style
  {
    src: `${CDN_BASE}/landingpage/images/lebronjames3d.jpg`,
    category: '3d',
    alt: '3D Character Render',
  },
]

// Before/After comparison demos
export const beforeAfterDemos = {
  aging: {
    before: `${CDN_BASE}/images/cml3kjr9w0000e4uc6oymgh4i/trump-1769955506635.jpg`,
    after: `${CDN_BASE}/images/cml3kjr9w0000e4uc6oymgh4i/aging-single-baby-1769955551200-0.jpeg`,
    label: 'Baby Prediction',
    description: 'Predict what a baby would look like from a parent photo',
  },
  edit: {
    before: `${CDN_BASE}/images/kEfpAGeXEISFdl55hRbdV6oEFH5zWJis/generated-1769082201172-0.webp`,
    after: `${CDN_BASE}/images/kEfpAGeXEISFdl55hRbdV6oEFH5zWJis/edit-1769184929468.png`,
    label: 'AI Enhancement',
    description: 'Transform and enhance images with AI editing',
  },
}

// Video showcase
export const showcaseVideos = [
  {
    src: `${CDN_BASE}/videos/cml3kjr9w0000e4uc6oymgh4i/generated-1769956469918.mp4`,
    title: 'AI Generated Scene',
    model: 'Kling 2.6',
  },
  {
    src: `${CDN_BASE}/videos/cml3kjr9w0000e4uc6oymgh4i/video-1769956790001.mp4`,
    title: 'Motion Animation',
    model: 'Veo 3.1',
  },
  {
    src: `${CDN_BASE}/videos/cml3kjr9w0000e4uc6oymgh4i/video-1769956821703.mp4`,
    title: 'Creative Video',
    model: 'Wan 2.6',
  },
]

// 3D model showcase
export const showcase3DModel = {
  src: `${CDN_BASE}/3d-models/kEfpAGeXEISFdl55hRbdV6oEFH5zWJis/model-cmkqpqac2000070ucfpcyqgh5.glb`,
  title: '3D Model from Text',
  model: 'Meshy',
}

// Category metadata for filtering
export const imageCategories = [
  { id: 'all', label: 'All' },
  { id: 'portraits', label: 'Portraits' },
  { id: 'abstract', label: 'Abstract' },
  { id: 'creatures', label: 'Creatures' },
  { id: 'nature', label: 'Nature' },
  { id: 'artistic', label: 'Artistic' },
  { id: '3d', label: '3D Style' },
] as const

export type ImageCategory = (typeof imageCategories)[number]['id']
