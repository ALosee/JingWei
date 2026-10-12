import { describe, expect, it } from 'vitest'

import { findMenuTrail, toMenuOptions } from './shared'

describe('AppShell navigation projection', () => {
  const items = [
    {
      value: 'organization',
      label: '组织管理',
      to: '/organizations',
      children: [
        { value: 'detail', label: '组织详情', hidden: true },
        { value: 'account', label: '个人账号', to: '/account/me?tab=profile' },
        {
          value: 'help',
          label: '帮助中心',
          href: 'https://example.com/help',
          external: true,
          target: '_blank' as const,
        },
      ],
    },
  ]

  it('keeps hidden pages in the breadcrumb trail and out of ancestor dropdowns', () => {
    expect(findMenuTrail(items, 'detail').map((item) => item.label)).toEqual([
      '组织管理',
      '组织详情',
    ])
    expect(toMenuOptions(items[0]?.children).map((item) => item.value)).toEqual(['account', 'help'])
  })

  it('preserves internal and safe external destinations in ancestor dropdowns', () => {
    expect(toMenuOptions(items[0]?.children)).toEqual([
      expect.objectContaining({ value: 'account', to: '/account/me?tab=profile' }),
      expect.objectContaining({
        value: 'help',
        href: 'https://example.com/help',
        external: true,
        target: '_blank',
      }),
    ])
  })
})
