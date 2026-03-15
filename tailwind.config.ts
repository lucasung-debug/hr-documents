import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        apple: {
          blue: '#0071e3',
          'blue-hover': '#0077ed',
          'blue-light': '#e8f0fe',
          'gray-50': '#f5f5f7',
          'gray-100': '#e8e8ed',
          'gray-200': '#d2d2d7',
          'gray-500': '#86868b',
          'gray-700': '#515154',
          'gray-900': '#1d1d1f',
        },
      },
      boxShadow: {
        'apple-sm': '0 2px 8px rgba(0,0,0,0.08)',
        'apple-md': '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
        'apple-card': '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.08)',
      },
      borderRadius: {
        apple: '12px',
        'apple-lg': '18px',
        'apple-xl': '24px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
