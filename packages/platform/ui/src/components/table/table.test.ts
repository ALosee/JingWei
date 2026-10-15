// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'

import { Table } from '../../index'
import type { TableColumn } from '../../index'

enableAutoUnmount(afterEach)
interface Item {
  id: string
  name: string
  status: string
}
const data: Item[] = [
  { id: 'alice', name: 'Alice', status: 'ACTIVE' },
  { id: 'bob', name: 'Bob', status: 'DISABLED' },
]
const rowKey = (row: Item) => row.id
const columns: TableColumn<Item>[] = [
  { id: 'selection', type: 'selection' },
  { accessorKey: 'name', header: '用户', enableSorting: true },
  { accessorKey: 'status', header: '状态' },
]
const global = {
  stubs: { SIcon: true },
  provide: { [Symbol.for('ConfigProvider')]: { dir: 'ltr', locale: 'zh-CN' } },
}

describe('source-owned Vean Table', () => {
  it('renders semantic headers, typed row slots and a custom empty state', async () => {
    const wrapper = mount(Table<Item, string, true>, {
      global,
      props: {
        columns,
        data,
        rowKey,
        multiple: true,
        selected: [],
        contentProps: { 'aria-label': '成员列表' },
      },
      slots: { name: ({ row }: { row: Item }) => h('strong', row.name), empty: () => '尚无成员' },
    })
    expect(wrapper.get('table').attributes('aria-label')).toBe('成员列表')
    expect(wrapper.findAll('thead th')).toHaveLength(3)
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    expect(wrapper.get('tbody strong').text()).toBe('Alice')
    await wrapper.setProps({ data: [] })
    expect(wrapper.get('tbody').text()).toBe('尚无成员')
    expect(wrapper.get('tbody td').attributes('colspan')).toBe('3')
  })

  it('preserves controlled selection, mixed header state and keyboard activation', async () => {
    const wrapper = mount(Table<Item, string, true>, {
      global,
      attachTo: document.body,
      props: { columns, data, rowKey, selected: [] },
    })
    await wrapper.get('thead [role="checkbox"]').trigger('click')
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['alice', 'bob']])
    // The controlled value remains unchanged until the owner accepts it.
    expect(wrapper.get('thead [role="checkbox"]').attributes('aria-checked')).toBe('false')
    await wrapper.setProps({ selected: ['alice'] })
    expect(wrapper.get('thead [role="checkbox"]').attributes('aria-checked')).toBe('mixed')
    const bob = wrapper.findAll('[role="checkbox"]')[2]
    await bob?.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual([['alice', 'bob']])
  })

  it('keeps explicit single selection when the headless default is multiple', async () => {
    const wrapper = mount(Table<Item, string, false>, {
      global,
      props: { columns, data, rowKey, multiple: false, selected: 'bob' },
    })
    expect(wrapper.find('thead [role="checkbox"]').exists()).toBe(false)
    const radios = wrapper.findAll('tbody button[aria-pressed]')
    expect(radios).toHaveLength(2)
    expect(radios[1]?.attributes('aria-pressed')).toBe('true')
    await radios[0]?.trigger('click')
    expect(wrapper.emitted('update:selected')?.at(-1)).toEqual(['alice'])
  })

  it('delegates sorting and its aria-sort state to the headless engine', async () => {
    const wrapper = mount(Table<Item, string, true>, {
      global,
      props: { columns, data, rowKey, multiple: true },
    })
    const nameHeader = wrapper.findAll('th')[1]
    await nameHeader?.get('button').trigger('click')
    await flushPromises()
    expect(nameHeader?.attributes('aria-sort')).toBe('ascending')
    expect(wrapper.emitted('update:sorting')?.at(-1)).toEqual([[{ id: 'name', desc: false }]])
    await nameHeader?.get('button').trigger('click')
    await flushPromises()
    expect(nameHeader?.attributes('aria-sort')).toBe('descending')
    expect(wrapper.findAll('tbody tr')[0]?.text()).toContain('Bob')
  })
})
