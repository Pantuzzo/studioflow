import type { Meta, StoryObj } from '@storybook/react-vite'

const COLORS = [
  'bg',
  'surface',
  'surface-subtle',
  'surface-disabled',
  'border',
  'text',
  'text-muted',
  'primary',
  'primary-hover',
  'primary-active',
  'primary-contrast',
  'danger',
  'success',
]

const TYPE: [string, string][] = [
  ['2xl', '2rem'],
  ['xl', '1.5rem'],
  ['lg', '1.125rem'],
  ['base', '1rem'],
  ['sm', '0.875rem'],
]

const SPACE = ['1', '2', '3', '4', '5', '6', '8']
const RADIUS = ['sm', 'md', 'lg']

const mutedCode: React.CSSProperties = {
  fontSize: 'var(--sf-text-sm)',
  color: 'var(--sf-text-muted)',
}

function Swatch({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div
        style={{
          height: 56,
          borderRadius: 'var(--sf-radius-md)',
          border: '1px solid var(--sf-border)',
          background: `var(--sf-${name})`,
        }}
      />
      <code style={mutedCode}>--sf-{name}</code>
    </div>
  )
}

function Foundations() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sf-space-8)',
        color: 'var(--sf-text)',
        fontFamily: 'var(--sf-font-sans)',
      }}
    >
      <section>
        <h2>Colors</h2>
        <p style={mutedCode}>
          Switch the toolbar theme to see light/dark values.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 'var(--sf-space-4)',
            marginTop: 'var(--sf-space-4)',
          }}
        >
          {COLORS.map((c) => (
            <Swatch key={c} name={c} />
          ))}
        </div>
      </section>

      <section>
        <h2>Type scale</h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sf-space-3)',
            marginTop: 'var(--sf-space-4)',
          }}
        >
          {TYPE.map(([name, val]) => (
            <div key={name} style={{ fontSize: `var(--sf-text-${name})` }}>
              The quick brown fox{' '}
              <code style={mutedCode}>
                --sf-text-{name} · {val}
              </code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Spacing</h2>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sf-space-2)',
            marginTop: 'var(--sf-space-4)',
          }}
        >
          {SPACE.map((s) => (
            <div
              key={s}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sf-space-3)',
              }}
            >
              <div
                style={{
                  height: 16,
                  width: `var(--sf-space-${s})`,
                  background: 'var(--sf-primary)',
                  borderRadius: 2,
                }}
              />
              <code style={mutedCode}>--sf-space-{s}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>Radius</h2>
        <div
          style={{
            display: 'flex',
            gap: 'var(--sf-space-4)',
            marginTop: 'var(--sf-space-4)',
          }}
        >
          {RADIUS.map((r) => (
            <div
              key={r}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: 'var(--sf-surface-subtle)',
                  border: '1px solid var(--sf-border)',
                  borderRadius: `var(--sf-radius-${r})`,
                }}
              />
              <code style={mutedCode}>--sf-radius-{r}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const meta = {
  title: 'Foundations/Tokens',
  component: Foundations,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Foundations>

export default meta
type Story = StoryObj<typeof meta>

export const Tokens: Story = {}
