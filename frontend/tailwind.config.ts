import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          dark:    '#4B164F',
          accent:  '#B738F2',
          mid:     '#9839D1',
          ink:     '#270D38',
          bg:      '#F6F5F2',
          muted:   '#7E7E7E',
        },
        clinical: {
          superior:   '#22c55e',
          normal:     '#3b82f6',
          borderline: '#eab308',
          impaired:   '#ef4444',
        },
      },
      fontFamily: {
        sans: ['"Work Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        btn:   '9999px',
        card:  '12px',
        input: '9px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,0.09)',
      },
    },
  },
  plugins: [],
} satisfies Config
