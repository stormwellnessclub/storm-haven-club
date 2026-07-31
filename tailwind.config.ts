import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: {
  			DEFAULT: '1rem',
  			sm: '1.5rem',
  			lg: '2rem'
  		},
  		screens: {
  			sm: '640px',
  			md: '768px',
  			lg: '1024px',
  			xl: '1280px',
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			serif: [
  				'Cormorant Garamond',
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  			sans: [
  				'Montserrat',
  				'ui-sans-serif',
  				'system-ui',
  				'sans-serif',
  				'Apple Color Emoji',
  				'Segoe UI Emoji',
  				'Segoe UI Symbol',
  				'Noto Color Emoji'
  			],
  			mono: [
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'Liberation Mono',
  				'Courier New',
  				'monospace'
  			],
  			'cafe-serif': ['Bodoni Moda', 'Cormorant Garamond', 'Georgia', 'serif'],
  			'cafe-mono': ['Space Mono', 'ui-monospace', 'Menlo', 'monospace']
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			gold: 'hsl(var(--gold))',
  			'gold-light': 'hsl(var(--gold-light))',
  			'gold-contrast': 'hsl(var(--gold-contrast))',
  			charcoal: 'hsl(var(--charcoal))',
  			cream: 'hsl(var(--cream))',
  			'cream-dark': 'hsl(var(--cream-dark))',
  			'warm-gray': 'hsl(var(--warm-gray))',
  			'cafe-cream': 'hsl(var(--cafe-cream))',
  			'cafe-stone': 'hsl(var(--cafe-stone))',
  			'cafe-stone-soft': 'hsl(var(--cafe-stone-soft))',
  			'cafe-terracotta': 'hsl(var(--cafe-terracotta))',
  			'cafe-terracotta-deep': 'hsl(var(--cafe-terracotta-deep))',
  			'cafe-burgundy': 'hsl(var(--cafe-burgundy))',
  			'cafe-line': 'hsl(var(--cafe-line))',
  			'pt-noir': 'hsl(var(--pt-noir))',
  			'pt-noir-soft': 'hsl(var(--pt-noir-soft))',
  			'pt-cream': 'hsl(var(--pt-cream))',
  			'pt-beige': 'hsl(var(--pt-beige))',
  			'pt-line': 'hsl(var(--pt-line))',
  			'pt-muted': 'hsl(var(--pt-muted))',
  			'pt-ink': 'hsl(var(--pt-ink))',
  			'pt-gold': 'hsl(var(--pt-gold))',
  			'pt-green': 'hsl(var(--pt-green))',
  			'pt-amber': 'hsl(var(--pt-amber))',
  			'pt-red': 'hsl(var(--pt-red))'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			soft: 'var(--shadow-soft)',
  			card: 'var(--shadow-card)',
  			'card-hover': 'var(--shadow-card-hover)',
  			gold: 'var(--shadow-gold)',
  			'gold-hover': 'var(--shadow-gold-hover)',
  			elevated: 'var(--shadow-elevated)'
  		},
  		backgroundImage: {
  			'gradient-gold': 'var(--gradient-gold)',
  			'gradient-dark': 'var(--gradient-dark)',
  			'gradient-cream': 'var(--gradient-cream)',
  			'gradient-hero': 'var(--gradient-hero)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'slide-in': {
  				from: {
  					opacity: '0',
  					transform: 'translateY(10px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'slide-in': 'slide-in 0.4s ease-out forwards'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
