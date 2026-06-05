const SFX_PREVIEW_BY_CATEGORY_ABBR: Record<string, string> = {
  'atmosphere:Fog':       '/assets/sfx-previews/atmosphere/fog.jpg',
  'atmosphere:Rain':      '/assets/sfx-previews/atmosphere/rain.jpg',
  'atmosphere:God Rays':  '/assets/sfx-previews/atmosphere/god-rays.jpg',
  'atmosphere:Dust':      '/assets/sfx-previews/atmosphere/dust.jpg',
  'atmosphere:Haze':      '/assets/sfx-previews/atmosphere/haze.jpg',
  'atmosphere:Smoke':     '/assets/sfx-previews/atmosphere/smoke.jpg',
  'atmosphere:Snow':      '/assets/sfx-previews/atmosphere/snow.jpg',
  'atmosphere:Heat':      '/assets/sfx-previews/atmosphere/heat.jpg',
  'weather:Heavy Rain':   '/assets/sfx-previews/weather/heavy-rain.jpg',
  'weather:Snowfall':     '/assets/sfx-previews/weather/snowfall.jpg',
  'weather:Thick Fog':    '/assets/sfx-previews/weather/thick-fog.jpg',
  'weather:Sunny Day':    '/assets/sfx-previews/weather/sunny-day.jpg',
  'weather:Thunder':      '/assets/sfx-previews/weather/thunderstorm.jpg',
  'weather:Wind':         '/assets/sfx-previews/weather/wind.jpg',
  'weather:Desert Haze':  '/assets/sfx-previews/weather/desert-haze.jpg',
  'weather:Neon Wet':     '/assets/sfx-previews/weather/neon-wet.jpg',
  'weather:Underwater':   '/assets/sfx-previews/weather/underwater.jpg',
  'particleFx:Embers':       '/assets/sfx-previews/particle/embers.jpg',
  'particleFx:Magic Dust':   '/assets/sfx-previews/particle/magic-dust.jpg',
  'particleFx:Vol Rays':     '/assets/sfx-previews/particle/volumetric-god-rays.jpg',
  'particleFx:Flare':        '/assets/sfx-previews/particle/lens-flare.jpg',
  'particleFx:Holo':         '/assets/sfx-previews/particle/hologram.jpg',
  'particleFx:Steam':        '/assets/sfx-previews/particle/steam.jpg',
  'particleFx:Splash':       '/assets/sfx-previews/particle/splash.jpg',
  'particleFx:Debris':       '/assets/sfx-previews/particle/debris.jpg',
  'particleFx:Energy Aura':  '/assets/sfx-previews/particle/energy-aura.jpg',
  'particleFx:Butterfly':    '/assets/sfx-previews/particle/butterfly-swarm.jpg',
};

export function getSFXPreviewSrc(category: string, abbr: string): string | null {
  return SFX_PREVIEW_BY_CATEGORY_ABBR[`${category}:${abbr}`] ?? null;
}
