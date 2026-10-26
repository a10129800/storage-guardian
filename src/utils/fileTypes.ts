import { FileCategory } from '../types/index.ts';

const EXTENSION_MAP: Record<string, FileCategory> = {
  // Documents
  pdf: 'document',
  doc: 'document',
  docx: 'document',
  xls: 'document',
  xlsx: 'document',
  ppt: 'document',
  pptx: 'document',
  txt: 'document',
  md: 'document',
  csv: 'document',
  rtf: 'document',
  odt: 'document',
  ods: 'document',

  // Images
  jpg: 'image',
  jpeg: 'image',
  png: 'image',
  gif: 'image',
  webp: 'image',
  bmp: 'image',
  svg: 'image',
  tiff: 'image',
  ico: 'image',
  psd: 'image',
  ai: 'image',
  raw: 'image',

  // Videos
  mp4: 'video',
  mkv: 'video',
  avi: 'video',
  mov: 'video',
  wmv: 'video',
  flv: 'video',
  webm: 'video',
  m4v: 'video',
  ts: 'video',

  // Audio
  mp3: 'audio',
  wav: 'audio',
  flac: 'audio',
  aac: 'audio',
  ogg: 'audio',
  m4a: 'audio',
  wma: 'audio',
  mid: 'audio',

  // Archives
  zip: 'archive',
  rar: 'archive',
  '7z': 'archive',
  tar: 'archive',
  gz: 'archive',
  bz2: 'archive',
  xz: 'archive',
  iso: 'archive',
  cab: 'archive',

  // Installers
  exe: 'installer',
  msi: 'installer',
  bat: 'installer',
  cmd: 'installer',
  apk: 'installer',
  dmg: 'installer',
  pkg: 'installer',

  // 3D Models
  obj: 'model3d',
  fbx: 'model3d',
  stl: 'model3d',
  blend: 'model3d',
  gltf: 'model3d',
  glb: 'model3d',
  dae: 'model3d',
  max: 'model3d',

  // Code & Development
  js: 'code',
  jsx: 'code',
  tsx: 'code',
  html: 'code',
  css: 'code',
  scss: 'code',
  json: 'code',
  py: 'code',
  java: 'code',
  cpp: 'code',
  c: 'code',
  cs: 'code',
  go: 'code',
  rs: 'code',
  php: 'code',
  rb: 'code',
  sql: 'code',
  sh: 'code',
  xml: 'code',
  yaml: 'code',
  yml: 'code',

  // AI & Large Data
  safetensors: 'ai_data',
  ckpt: 'ai_data',
  bin: 'ai_data',
  onnx: 'ai_data',
  pth: 'ai_data',
  pt: 'ai_data',
  h5: 'ai_data',
  parquet: 'ai_data',
  arrow: 'ai_data',
  db: 'ai_data',
  sqlite: 'ai_data',
};

export function getFileCategory(extensionOrFileName: string): FileCategory {
  let ext = extensionOrFileName.toLowerCase();
  if (ext.includes('.')) {
    ext = ext.split('.').pop() || '';
  }
  return EXTENSION_MAP[ext] || 'other';
}

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  document: '文件',
  image: '圖片',
  video: '影片',
  audio: '音訊',
  archive: '壓縮檔',
  installer: '安裝程式',
  model3d: '3D 模型',
  code: '程式與開發',
  ai_data: 'AI 模型與大型資料',
  other: '其他',
};

export const CATEGORY_COLORS: Record<FileCategory, string> = {
  document: '#3b82f6', // blue
  image: '#10b981',    // emerald
  video: '#f59e0b',    // amber
  audio: '#8b5cf6',    // purple
  archive: '#ec4899',  // pink
  installer: '#ef4444',// red
  model3d: '#06b6d4',  // cyan
  code: '#14b8a6',     // teal
  ai_data: '#6366f1',  // indigo
  other: '#64748b',    // slate
};
