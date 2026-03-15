export type AvatarPreset = {
  key: string
  label: string
  style: 'fun-emoji' | 'bottts-neutral' | 'adventurer-neutral'
  seed: string
  query?: string
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'neo', label: 'Neo', style: 'fun-emoji', seed: 'SplitMate-neo' },
  { key: 'luna', label: 'Luna', style: 'fun-emoji', seed: 'SplitMate-luna' },
  { key: 'rex', label: 'Rex', style: 'fun-emoji', seed: 'SplitMate-rex' },
  { key: 'ivy', label: 'Ivy', style: 'fun-emoji', seed: 'SplitMate-ivy' },
  { key: 'volt', label: 'Volt', style: 'fun-emoji', seed: 'SplitMate-volt' },
  { key: 'echo', label: 'Echo', style: 'fun-emoji', seed: 'SplitMate-echo' },
  { key: 'nora', label: 'Nora', style: 'fun-emoji', seed: 'SplitMate-nora' },
  { key: 'max', label: 'Max', style: 'fun-emoji', seed: 'SplitMate-max' },

  { key: 'sky', label: 'Sky', style: 'bottts-neutral', seed: 'SplitMate-sky' },
  { key: 'zara', label: 'Zara', style: 'bottts-neutral', seed: 'SplitMate-zara' },
  { key: 'jin', label: 'Jin', style: 'bottts-neutral', seed: 'SplitMate-jin' },
  { key: 'kai', label: 'Kai', style: 'bottts-neutral', seed: 'SplitMate-kai' },
  { key: 'mila', label: 'Mila', style: 'bottts-neutral', seed: 'SplitMate-mila' },
  { key: 'orion', label: 'Orion', style: 'bottts-neutral', seed: 'SplitMate-orion' },
  { key: 'nova', label: 'Nova', style: 'adventurer-neutral', seed: 'SplitMate-nova' },
  { key: 'atlas', label: 'Atlas', style: 'bottts-neutral', seed: 'SplitMate-atlas' },
  { key: 'riven', label: 'Riven', style: 'bottts-neutral', seed: 'SplitMate-riven' },
  { key: 'pixel', label: 'Pixel', style: 'bottts-neutral', seed: 'SplitMate-pixel' },
  { key: 'ruby', label: 'Ruby', style: 'adventurer-neutral', seed: 'SplitMate-ruby', query: 'backgroundColor=ef4444,f87171' },
  { key: 'emberx', label: 'EmberX', style: 'bottts-neutral', seed: 'SplitMate-emberx', query: 'backgroundColor=b91c1c,dc2626' },

  { key: 'aurora', label: 'Aurora', style: 'adventurer-neutral', seed: 'SplitMate-aurora' },
  { key: 'blaze', label: 'Blaze', style: 'adventurer-neutral', seed: 'SplitMate-blaze' },
  { key: 'cedar', label: 'Cedar', style: 'adventurer-neutral', seed: 'SplitMate-cedar' },
  { key: 'dahlia', label: 'Dahlia', style: 'adventurer-neutral', seed: 'SplitMate-dahlia' },
  { key: 'ember', label: 'Ember', style: 'adventurer-neutral', seed: 'SplitMate-ember' },
  { key: 'flint', label: 'Flint', style: 'adventurer-neutral', seed: 'SplitMate-flint' },
  { key: 'gaia', label: 'Gaia', style: 'adventurer-neutral', seed: 'SplitMate-gaia' },
  { key: 'helix', label: 'Helix', style: 'adventurer-neutral', seed: 'SplitMate-helix' },
]

const LEGACY_KEY_ALIAS: Record<string, string> = {
  cat: 'neo',
  dog: 'max',
  fox: 'jin',
  panda: 'echo',
  koala: 'sky',
  frog: 'rex',
  tiger: 'volt',
  penguin: 'kai',
  rabbit: 'zara',
  owl: 'luna',
  unicorn: 'nora',
  bear: 'jin',
  sun: 'volt',
  moon: 'echo',
  leaf: 'max',
  rocket: 'neo',
  wave: 'sky',
  fire: 'jin',
  coffee: 'rex',
  star: 'luna',
}

function resolveAvatarKey(avatarKey?: string | null): string | null {
  if (!avatarKey) return null
  if (AVATAR_PRESETS.some((item) => item.key === avatarKey)) return avatarKey
  return LEGACY_KEY_ALIAS[avatarKey] || null
}

export function isValidAvatarPresetKey(value: string | null | undefined): value is string {
  if (!value) return false
  return Boolean(resolveAvatarKey(value))
}

export function getAvatarPresetUrl(avatarKey?: string | null): string | null {
  const resolved = resolveAvatarKey(avatarKey)
  if (!resolved) return null
  const preset = AVATAR_PRESETS.find((item) => item.key === resolved)
  if (!preset) return null

  const base = `https://api.dicebear.com/9.x/${preset.style}/svg?seed=${encodeURIComponent(preset.seed)}`
  return preset.query ? `${base}&${preset.query}` : base
}

export function getDefaultAvatarKey(seed: string): string {
  if (!seed) return AVATAR_PRESETS[0].key

  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }

  const index = Math.abs(hash) % AVATAR_PRESETS.length
  return AVATAR_PRESETS[index].key
}

