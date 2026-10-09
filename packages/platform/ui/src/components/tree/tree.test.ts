// @vitest-environment happy-dom
import type { VirtualItem } from '@tanstack/vue-virtual'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import type { ComponentPublicInstance } from 'vue'

import { Tree, TreeItem, TreeVirtualizer, TreeVirtualizerItem } from '../../index'
import type { FlattenedItem, TreeItemData, TreeVirtualizerProps } from '../../index'

enableAutoUnmount(afterEach)
const global = { provide: { [Symbol.for('ConfigProvider')]: { dir: 'ltr', locale: 'zh-CN' } } }
const items = [{ value: 'parent', children: [{ value: 'child' }] }, { value: 'sibling' }]
const itemSlot = ({ item }: { item: FlattenedItem<TreeItemData> }) =>
  h(
    TreeItem,
    { value: item.value, level: item.level, 'data-vean-tree-value': item.value },
    () => item.value,
  )
const virtualizerOptions: NonNullable<
  TreeVirtualizerProps<TreeItemData, string, false>['options']
> = {
  overscan: 0,
  observeElementRect: (_instance, callback) => {
    callback({ width: 300, height: 112 })
  },
  observeElementOffset: (_instance, callback) => {
    callback(0, false)
  },
}

describe('Vean Tree family', () => {
  it('keeps focus after motion ends and respects moves to another control', async () => {
    const wrapper = mount(Tree, {
      global,
      attachTo: document.body,
      props: { items, expanded: [] },
      slots: { item: itemSlot },
    })
    await wrapper.setProps({ expanded: ['parent'] })
    wrapper.get<HTMLElement>('[data-vean-tree-value="child"]').element.focus()
    wrapper.getComponent<ComponentPublicInstance>({ name: 'STreeMotionBlock' }).vm.$emit('end')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-vean-tree-value="child"]').element)
    await wrapper.setProps({ expanded: [] })
    await wrapper.setProps({ expanded: ['parent'] })
    const child = wrapper.get<HTMLElement>('[data-vean-tree-value="child"]')
    child.element.focus()
    const other = mount({ render: () => h('input') }, { attachTo: document.body })
    other.get<HTMLInputElement>('input').element.focus()
    wrapper.getComponent<ComponentPublicInstance>({ name: 'STreeMotionBlock' }).vm.$emit('end')
    await flushPromises()
    expect(document.activeElement).toBe(other.get('input').element)
  })

  it('keeps keyboard focus when a nested branch moves between motion containers', async () => {
    const wrapper = mount(Tree, {
      global,
      attachTo: document.body,
      props: {
        items: [
          { value: 'parent', children: [{ value: 'child', children: [{ value: 'grandchild' }] }] },
        ],
        expanded: ['parent'],
      },
      slots: { item: itemSlot },
    })
    const child = wrapper.get<HTMLElement>('[data-vean-tree-value="child"]')
    child.element.focus()
    await wrapper.setProps({ expanded: [] })
    await wrapper.setProps({ expanded: ['parent'] })
    wrapper.get<HTMLElement>('[data-vean-tree-value="child"]').element.focus()
    await wrapper.setProps({ expanded: ['parent', 'child'] })
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('[data-vean-tree-value="child"]').element)
  })

  it('keeps controlled selection and expansion with native hierarchy semantics', async () => {
    const wrapper = mount(Tree, {
      global,
      props: { items, modelValue: 'sibling', expanded: [], allowParentSelect: true },
      slots: { item: itemSlot },
    })
    const parent = wrapper.get('[role="treeitem"]')
    expect(parent.attributes('aria-level')).toBe('1')
    expect(parent.attributes('aria-setsize')).toBe('2')
    await parent.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:expanded')).toEqual([[['parent']]])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(parent.attributes('aria-expanded')).toBe('false')
    await wrapper.setProps({ expanded: ['parent'] })
    await flushPromises()
    const child = wrapper.findAll('[role="treeitem"]')[1]
    expect(child?.attributes('aria-level')).toBe('2')
    await child?.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['child']])
    expect(child?.attributes('aria-selected')).toBe('false')
    await wrapper.setProps({ modelValue: 'child' })
    expect(child?.attributes('aria-selected')).toBe('true')
    await parent.trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('update:expanded')?.at(-1)).toEqual([[]])
    await wrapper.setProps({ expanded: [] })
    await flushPromises()
    expect(wrapper.findAll('[role="treeitem"]')).toHaveLength(2)
  })

  it('retains cascading multiple selection and blocks disabled trees', async () => {
    const wrapper = mount(Tree, {
      global,
      props: {
        items,
        multiple: true,
        defaultValue: [],
        allowParentSelect: true,
        propagateSelect: true,
      },
      slots: { item: itemSlot },
    })
    await wrapper.get('[role="treeitem"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['parent', 'child']])
    const disabled = mount(Tree, {
      global,
      props: { items, disabled: true, defaultValue: '', allowParentSelect: true },
      slots: { item: itemSlot },
    })
    await disabled.get('[role="treeitem"]').trigger('click')
    await disabled.get('[role="treeitem"]').trigger('keydown', { key: 'ArrowRight' })
    expect(disabled.emitted('update:modelValue')).toBeUndefined()
    expect(disabled.emitted('update:expanded')).toBeUndefined()
  })

  for (const animated of [false, true]) {
    it(`windows a large tree and preserves item selection (animated: ${animated})`, async () => {
      const wrapper = mount(TreeVirtualizer, {
        global,
        attachTo: document.body,
        props: {
          items: Array.from({ length: 1000 }, (_, index) => ({ value: `item-${index}` })),
          height: 112,
          defaultValue: '',
          animated,
          options: virtualizerOptions,
        },
        slots: {
          item: ({
            item,
            virtualItem,
          }: {
            item: FlattenedItem<TreeItemData>
            virtualItem: VirtualItem
          }) =>
            h(
              TreeVirtualizerItem,
              { value: item.value, level: item.level, data: virtualItem },
              () => item.value,
            ),
        },
      })
      await flushPromises()
      const rendered = wrapper.findAll('[role="treeitem"]')
      expect(rendered.length).toBeGreaterThan(0)
      expect(rendered.length).toBeLessThan(10)
      await rendered[0]?.trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([['item-0']])
    })
  }
})
