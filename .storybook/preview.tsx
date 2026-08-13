import { definePreview } from "@storybook/nextjs-vite"
import addonMsw from "msw-storybook-addon"
import type {} from "msw-storybook-addon/types"

import { AppProviders } from "../src/components/providers/app-providers"
import type { Locale } from "../src/i18n/config"
import { getMessagesForLocale } from "../src/i18n/messages"
import "../src/app/globals.css"

const preview = definePreview({
  addons: [addonMsw()],
  globalTypes: {
    locale: {
      description: "Interface locale",
      toolbar: {
        icon: "globe",
        items: [
          { value: "ko", title: "한국어" },
          { value: "en", title: "English" },
        ],
      },
    },
  },
  initialGlobals: {
    locale: "ko",
  },
  decorators: [
    (Story, context) => {
      const locale: Locale = context.globals.locale === "en" ? "en" : "ko"
      return (
        <AppProviders locale={locale} messages={getMessagesForLocale(locale)}>
          <div className="min-h-64 bg-background p-6 text-foreground">
            <Story />
          </div>
        </AppProviders>
      )
    },
  ],
  parameters: {
    a11y: {
      test: "error",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
})

export default preview
