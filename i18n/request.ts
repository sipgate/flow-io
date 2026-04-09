import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { locales, type Locale } from './routing'

export default getRequestConfig(async () => {
  const store = await cookies()
  const cookieLocale = store.get('locale')?.value as Locale | undefined

  // Validate locale from cookie, default to 'en'
  const locale =
    cookieLocale && locales.includes(cookieLocale) ? cookieLocale : 'en'

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
