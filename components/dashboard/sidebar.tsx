'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  Layers,
  MessageSquare,
  FlaskConical,
  Phone,
  Cable,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { RunningTestsIndicator } from '@/components/autotest/running-tests-indicator'
import { useState, useSyncExternalStore } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface SidebarProps {
  organization: {
    id: string
    name: string
    slug: string
  }
  userRole: string
  hasPhoneNumbers: boolean
  hasTelephonyAccount: boolean
}

const navigationItems = [
  { key: 'dashboard',      href: '/dashboard',  icon: LayoutDashboard },
  { key: 'assistants',     href: '/assistants', icon: Bot },
  { key: 'flows',          href: '/scenarios',  icon: GitBranch },
  { key: 'knowledgeBase',  href: '/knowledge',  icon: Layers },
  { key: 'autotest',       href: '/autotest',   icon: FlaskConical },
  { key: 'calls',          href: '/calls',      icon: Phone },
  { key: 'analytics',      href: '/analytics',  icon: BarChart3 },
  { key: 'settings',       href: '/settings',   icon: Settings },
]

const chatSimulatorItem = { key: 'chatSimulator', href: '/chat', icon: MessageSquare }

type NavItem = typeof navigationItems[number]

interface NavLinkProps {
  item: NavItem
  isDisabled?: boolean
  organizationSlug: string
  organizationId: string
  pathname: string
  t: ReturnType<typeof useTranslations<'navigation'>>
  collapsed: boolean
}

function NavLink({ item, isDisabled = false, organizationSlug, organizationId, pathname, t, collapsed }: NavLinkProps) {
  const href = `/${organizationSlug}${item.href}`
  const isActive = pathname === href || pathname.startsWith(href + '/')
  const Icon = item.icon
  const label = t(item.key)

  const link = (
    <Link
      href={isDisabled ? '#' : href}
      onClick={isDisabled ? (e) => e.preventDefault() : undefined}
      aria-disabled={isDisabled}
      className={cn(
        'flex items-center h-10 w-full rounded-lg text-sm font-medium',
        'transition-all duration-200 ease-in-out',
        collapsed ? 'pl-[14px] pr-2' : 'pl-3 pr-3',
        isDisabled
          ? 'text-neutral-600 cursor-not-allowed pointer-events-none'
          : isActive
            ? 'bg-white/15 text-white'
            : 'text-neutral-400 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span className={cn(
        'overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out',
        collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[160px] opacity-100 ml-3'
      )}>
        {label}
      </span>
      {item.key === 'autotest' && !collapsed && (
        <RunningTestsIndicator organizationId={organizationId} />
      )}
    </Link>
  )

  return (
    <Tooltip key={item.key} open={collapsed ? undefined : false}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

export function DashboardSidebar({ organization, userRole, hasPhoneNumbers, hasTelephonyAccount }: SidebarProps) {
  const pathname = usePathname()
  const t = useTranslations('navigation')
  const collapsed = useSyncExternalStore(
    (callback) => {
      window.addEventListener('storage', callback)
      return () => window.removeEventListener('storage', callback)
    },
    () => localStorage.getItem('sidebar-collapsed') === 'true',
    () => false
  )

  const toggleCollapsed = () => {
    localStorage.setItem('sidebar-collapsed', String(!collapsed))
    // Manuell ein storage-Event feuern, damit useSyncExternalStore im gleichen Tab reagiert
    window.dispatchEvent(new Event('storage'))
  }

  const needsSetup = !hasPhoneNumbers

  // Status für den Connect-Eintrag
  const connectStatus: 'connected' | 'partial' | 'disconnected' =
    hasTelephonyAccount && hasPhoneNumbers
      ? 'connected'
      : hasTelephonyAccount
        ? 'partial'
        : 'disconnected'

  const connectStatusDot = {
    connected:    'bg-emerald-400',
    partial:      'bg-amber-400',
    disconnected: 'bg-neutral-500',
  }[connectStatus]

  const connectStatusLabel = {
    connected:    t('connectStatusConnected'),
    partial:      t('connectStatusPartial'),
    disconnected: t('connectStatusDisconnected'),
  }[connectStatus]

  const navLinkProps = { organizationSlug: organization.slug, organizationId: organization.id, pathname, t, collapsed }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Äußeres Div: Breiten-Transition + group für Hover, kein overflow-hidden */}
      <div
        className={cn(
          'relative group shrink-0 h-full transition-all duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Inneres Div: sichtbare Sidebar mit rounded corners + shadow */}
        <div className="bg-neutral-900 rounded-xl shadow-xl overflow-hidden h-full flex flex-col">

          {/* Header */}
          <div className={cn(
            'flex items-center h-16 transition-all duration-200 ease-in-out',
            collapsed ? 'px-[18px]' : 'px-4'
          )}>
            <Link
              href={`/${organization.slug}/dashboard`}
              className="flex items-center min-w-0 flex-1"
            >
              <Image
                src="/flow-io-logomark-white.svg"
                alt="Flow-IO"
                width={28}
                height={28}
                className="w-7 h-7 shrink-0"
              />
              <span className={cn(
                'text-white text-lg font-semibold overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out',
                collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[140px] opacity-100 ml-2'
              )}>
                {t('brandName')}
              </span>
            </Link>
            <button
              onClick={toggleCollapsed}
              aria-label="Sidebar zuklappen"
              className={cn(
                'text-neutral-400 hover:text-white transition-all duration-200 ease-in-out p-1 rounded shrink-0 overflow-hidden',
                collapsed ? 'max-w-0 opacity-0 p-0' : 'max-w-[32px] opacity-100'
              )}
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation – Hauptbereich */}
          <nav className="flex-1 px-2 space-y-0.5 py-2 overflow-y-auto">
            {navigationItems.map((item) => (
              <NavLink key={item.key} item={item} isDisabled={needsSetup} {...navLinkProps} />
            ))}
          </nav>

          {/* Chat-Simulator + Connect – unten fixiert */}
          <div className="px-2 pb-3 pt-1 border-t border-white/5 space-y-0.5">
            <NavLink item={chatSimulatorItem} {...navLinkProps} />
            {(() => {
              const href = `/${organization.slug}/connect`
              const isActive = pathname === href || pathname.startsWith(href + '/')
              const isSetupHint = needsSetup

              const link = (
                <Link
                  href={href}
                  className={cn(
                    'flex items-center h-10 w-full rounded-lg text-sm font-medium',
                    'transition-all duration-200 ease-in-out',
                    collapsed ? 'pl-[14px] pr-2' : 'pl-3 pr-3',
                    isActive
                      ? 'bg-white/15 text-white'
                      : isSetupHint
                        ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                        : 'text-neutral-400 hover:bg-white/10 hover:text-white'
                  )}
                >
                  {/* Icon + Status-Dot */}
                  <span className="relative shrink-0">
                    <Cable className="h-5 w-5" />
                    <span className={cn(
                      'absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-neutral-900',
                      connectStatusDot
                    )} />
                  </span>
                  <span className={cn(
                    'overflow-hidden whitespace-nowrap transition-all duration-200 ease-in-out',
                    collapsed ? 'max-w-0 opacity-0 ml-0' : 'max-w-[160px] opacity-100 ml-3'
                  )}>
                    {t('connect')}
                  </span>
                  {!collapsed && (
                    <span className={cn(
                      'ml-auto text-xs font-normal transition-all duration-200 ease-in-out',
                      connectStatus === 'connected' ? 'text-emerald-400' :
                      connectStatus === 'partial'    ? 'text-amber-400' :
                                                       'text-neutral-500'
                    )}>
                      {connectStatusLabel}
                    </span>
                  )}
                </Link>
              )

              return (
                <Tooltip open={collapsed ? undefined : false}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">
                    {t('connect')} · {connectStatusLabel}
                  </TooltipContent>
                </Tooltip>
              )
            })()}
          </div>

        </div>

        {/* Schwebender Expand-Button – erscheint on hover wenn collapsed */}
        {collapsed && (
          <button
            onClick={toggleCollapsed}
            aria-label="Sidebar aufklappen"
            className={cn(
              'absolute top-3 -right-[18px] z-10',
              'w-9 h-9 rounded-lg flex items-center justify-center',
              'bg-neutral-800 text-neutral-400 hover:text-white',
              'shadow-lg border border-white/5',
              'opacity-0 group-hover:opacity-100',
              'translate-x-1 group-hover:translate-x-0',
              'transition-all duration-150',
            )}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}
      </div>
    </TooltipProvider>
  )
}
