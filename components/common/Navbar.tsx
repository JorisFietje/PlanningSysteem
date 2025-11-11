'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReactNode } from 'react'

interface NavbarProps {
  rightContent?: ReactNode
  variant?: 'light' | 'primary'
}

export default function Navbar({ rightContent, variant = 'light' }: NavbarProps) {
  const pathname = usePathname()
  const navItems = [
    {
      href: '/dagplanning/planning',
      label: 'Dagplanning',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      href: '/weekplanning/rooster',
      label: 'Weekplanning',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    }
  ]

  const wrapperClasses = variant === 'primary'
    ? 'bg-transparent border-b border-white/20'
    : 'bg-white border-b border-slate-200 shadow-sm'

  return (
    <nav className={wrapperClasses}>
      <div className="max-w-[1800px] mx-auto px-6">
        <div className="flex items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              // Special handling for dagplanning and weekplanning: active on all subtabs
              let isActive = false
              if (item.href === '/dagplanning/planning') {
                isActive = pathname?.startsWith('/dagplanning') ?? false
              } else if (item.href === '/weekplanning/rooster') {
                isActive = pathname?.startsWith('/weekplanning') ?? false
              } else {
                isActive = pathname?.startsWith(item.href) ?? false
              }
              const baseClasses = 'flex items-center gap-2 px-6 py-3 font-semibold transition-colors border-b-2'
              const activeClasses = variant === 'primary'
                ? 'text-white border-white'
                : 'text-blue-600 border-blue-600'
              const inactiveClasses = variant === 'primary'
                ? 'text-white/70 border-transparent hover:text-white hover:border-white/40'
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>

          {rightContent && (
            <div className="flex items-center gap-4">
              {rightContent}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
