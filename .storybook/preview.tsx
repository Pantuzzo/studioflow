import { useEffect, type ReactNode } from 'react'
import type { Decorator, Preview } from '@storybook/react-vite'
import '@fontsource-variable/roboto'
import '../src/styles/tokens.css'
import '../src/styles/global.css'

function ThemedStory({
  theme,
  children,
}: {
  theme: string
  children: ReactNode
}) {
  useEffect(() => {
    const el = document.documentElement
    if (theme === 'system') el.removeAttribute('data-theme')
    else el.setAttribute('data-theme', theme)
  }, [theme])
  return <>{children}</>
}

const withTheme: Decorator = (Story, context) => (
  <ThemedStory theme={context.globals.theme as string}>
    <Story />
  </ThemedStory>
)

const preview: Preview = {
  decorators: [withTheme],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
  globalTypes: {
    theme: {
      description: 'Theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'system', title: 'System' },
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'system' },
}

export default preview
