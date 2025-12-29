const palette = {
  primary: {
    DEFAULT: '#22f2b2',
    light: '#6af8d1',
    dark: '#18b38a',
  },
  secondary: {
    DEFAULT: '#0f141d',
    light: '#151c2b',
    dark: '#0a0e16',
  },
  accent: {
    DEFAULT: '#ff7a59',
    light: '#ff9a7a',
    dark: '#d35a3b',
  },
  surface: {
    DEFAULT: '#141c2b',
    raised: '#1b2435',
  },
  ink: {
    DEFAULT: '#eef3fb',
    muted: '#c2cddd',
    soft: '#95a3ba',
  },
};

const hexToRgb = (value) => {
  const hex = value.replace('#', '');
  const normalized =
    hex.length === 3
      ? hex
          .split('')
          .map((char) => char + char)
          .join('')
      : hex;
  const intValue = Number.parseInt(normalized, 16);
  const red = (intValue >> 16) & 255;
  const green = (intValue >> 8) & 255;
  const blue = intValue & 255;

  return `${red}, ${green}, ${blue}`;
};

const withAlphaVar = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

const semanticColors = {
  primary: {
    DEFAULT: withAlphaVar('primary'),
    light: withAlphaVar('primary-light'),
    dark: withAlphaVar('primary-dark'),
  },
  secondary: {
    DEFAULT: withAlphaVar('secondary'),
    light: withAlphaVar('secondary-light'),
    dark: withAlphaVar('secondary-dark'),
  },
  accent: {
    DEFAULT: withAlphaVar('accent'),
    light: withAlphaVar('accent-light'),
    dark: withAlphaVar('accent-dark'),
  },
  surface: {
    DEFAULT: withAlphaVar('surface'),
    raised: withAlphaVar('surface-raised'),
  },
  ink: {
    DEFAULT: withAlphaVar('ink'),
    muted: withAlphaVar('ink-muted'),
    soft: withAlphaVar('ink-soft'),
  },
};

/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['var(--font-body)'],
        heading: ['var(--font-heading)'],
      },
      colors: semanticColors,
      backgroundImage: {
        'auth-shell': `radial-gradient(620px 420px at 18% -10%, rgba(var(--color-primary-light), 0.16) 0%, transparent 60%), radial-gradient(520px 420px at 88% 8%, rgba(var(--color-accent), 0.14) 0%, transparent 65%), linear-gradient(180deg, rgb(var(--color-secondary-light)) 0%, rgb(var(--color-secondary)) 55%, rgb(var(--color-secondary-dark)) 100%)`,
        'dot-grid': `radial-gradient(rgba(var(--color-ink), 0.05) 1px, transparent 1px)`,
      },
      boxShadow: {
        panel: `0 0 0 1px rgba(var(--color-ink), 0.08), 0 20px 40px rgba(var(--color-secondary-dark), 0.45)`,
        brand: `0 8px 20px rgba(var(--color-primary), 0.35)`,
      },
    },
  },
  plugins: [
    ({ addBase }) => {
      addBase({
        ':root': {
          '--color-primary': hexToRgb(palette.primary.DEFAULT),
          '--color-primary-light': hexToRgb(palette.primary.light),
          '--color-primary-dark': hexToRgb(palette.primary.dark),
          '--color-secondary': hexToRgb(palette.secondary.DEFAULT),
          '--color-secondary-light': hexToRgb(palette.secondary.light),
          '--color-secondary-dark': hexToRgb(palette.secondary.dark),
          '--color-accent': hexToRgb(palette.accent.DEFAULT),
          '--color-accent-light': hexToRgb(palette.accent.light),
          '--color-accent-dark': hexToRgb(palette.accent.dark),
          '--color-surface': hexToRgb(palette.surface.DEFAULT),
          '--color-surface-raised': hexToRgb(palette.surface.raised),
          '--color-ink': hexToRgb(palette.ink.DEFAULT),
          '--color-ink-muted': hexToRgb(palette.ink.muted),
          '--color-ink-soft': hexToRgb(palette.ink.soft),
        },
      });
    },
  ],
};
