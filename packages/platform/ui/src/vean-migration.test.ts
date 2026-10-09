// @vitest-environment happy-dom
import type { FlattenedItem, TreeItemData } from '@vean/aria/tree'
import { config, enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import {
  Breadcrumb,
  Button,
  ButtonGroup,
  Collapsible,
  ColorPicker,
  ConfigProvider,
  Dialog,
  DropdownMenu,
  InputNumber,
  Link,
  Menubar,
  PageTabs,
  PalettePicker,
  Popover,
  Progress,
  ProgressCircle,
  Segment,
  Select,
  Separator,
  Slider,
  Switch,
  Tabs,
  Textarea,
  ThemeSettingsPanel,
  Tooltip,
  Tree,
  TreeItem,
  TreeMenu,
} from './index'

vi.mock('@iconify/vue', () => ({ Icon: { name: 'Iconify', render: () => null } }))
enableAutoUnmount(afterEach)
config.global.provide = {
  [Symbol.for('ConfigProvider')]: { dir: 'ltr', locale: 'zh-CN' },
  [Symbol.for('UIConfigProvider')]: { dir: 'ltr', locale: 'zh-CN' },
}

describe('Vean migration control contracts', () => {
  it('forwards labels and errors to the textarea control and emits edits', async () => {
    const wrapper = mount(Textarea, {
      props: { modelValue: '' },
      attrs: { 'aria-label': '备注', 'aria-invalid': 'true' },
    })
    const control = wrapper.get('textarea')
    expect(control.attributes('aria-label')).toBe('备注')
    expect(control.attributes('aria-invalid')).toBe('true')
    await control.setValue('迁移完成')
    expect(wrapper.emitted('update:modelValue')).toEqual([['迁移完成']])
  })

  it('keeps standalone select trigger labels and supports selection', async () => {
    const wrapper = mount(Select, {
      props: {
        items: [
          { value: 'a', label: '甲' },
          { value: 'b', label: '乙' },
        ],
      },
      attrs: { 'aria-label': '配置版本' },
      attachTo: document.body,
    })
    expect(wrapper.get('[role="combobox"]').attributes('aria-label')).toBe('配置版本')
    await wrapper
      .get('[role="combobox"]')
      .trigger('pointerdown', { button: 0, pointerType: 'mouse', ctrlKey: false })
    await flushPromises()
    const option =
      Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find((item) =>
        item.textContent.includes('乙'),
      ) ?? null
    if (option === null) throw new Error('Select option was not mounted')
    option.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' }))
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toEqual([['b']])
  })

  it('keeps switch and number controls editable and disabled switches inert', async () => {
    const toggle = mount(Switch, { props: { defaultValue: false } })
    await toggle.get('[role="switch"]').trigger('click')
    expect(toggle.emitted('update:modelValue')).toEqual([[true]])
    const disabled = mount(Switch, { props: { disabled: true, defaultValue: false } })
    await disabled.get('[role="switch"]').trigger('click')
    expect(disabled.emitted('update:modelValue')).toBeUndefined()
    const number = mount(InputNumber, {
      props: { defaultValue: 2, min: 0, max: 5 },
      attrs: { 'aria-label': '数量' },
    })
    expect(number.get('[role="spinbutton"]').attributes('aria-label')).toBe('数量')
    await number.get('[role="spinbutton"]').setValue('4')
    await number.get('[role="spinbutton"]').trigger('blur')
    expect(number.emitted('update:modelValue')?.at(-1)).toEqual([4])
  })

  it('supports keyboard slider updates and segment/tab selection', async () => {
    const slider = mount(Slider, { props: { defaultValue: [10], min: 0, max: 100 } })
    await slider.get('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(slider.emitted('update:modelValue')?.at(-1)).toEqual([[11]])
    const items = [
      { value: 'a', label: '甲' },
      { value: 'b', label: '乙' },
    ]
    const segment = mount(Segment, { props: { defaultValue: 'a', items } })
    await segment.findAll('[role="tab"]')[1]?.trigger('mousedown', { button: 0, ctrlKey: false })
    expect(segment.emitted('update:modelValue')).toEqual([['b']])
    const tabs = mount(Tabs, { props: { defaultValue: 'a', items } })
    await tabs.findAll('[role="tab"]')[1]?.trigger('mousedown', { button: 0, ctrlKey: false })
    expect(tabs.emitted('update:modelValue')).toEqual([['b']])
    expect(tabs.findAll('[role="tabpanel"][data-selected="true"]')).toHaveLength(1)
  })

  it('inherits disabled button groups and retains semantic links and breadcrumbs', async () => {
    const group = mount(ButtonGroup, {
      props: { disabled: true },
      slots: { default: () => h(Button, null, () => '保存') },
    })
    await group.get('button').trigger('click')
    expect(group.getComponent(Button).emitted('click')).toBeUndefined()
    expect(group.get('button').attributes('aria-disabled')).toBe('true')
    const link = mount(Link, { props: { href: '/account' }, slots: { default: '账号' } })
    expect(link.get('a').attributes('href')).toBe('/account')
    const breadcrumb = mount(Breadcrumb, {
      props: { items: [{ label: '首页', href: '/' }, { label: '账号' }] },
    })
    expect(breadcrumb.findAll('li').length).toBeGreaterThanOrEqual(2)
  })

  it('retains tree item selection and menu link destinations', async () => {
    const tree = mount(Tree, {
      props: { items: [{ value: 'a', label: '甲' }], defaultValue: '' },
      slots: {
        item: ({ item }: { item: FlattenedItem<TreeItemData> }) =>
          h(TreeItem, { value: item.value, level: item.level }, () => item.value),
      },
    })
    await tree.get('[role="treeitem"]').trigger('click')
    expect(tree.emitted('update:modelValue')).toEqual([['a']])
    const menu = mount(TreeMenu, {
      props: { items: [{ value: 'a', label: '账号', href: '/account' }] },
    })
    expect(menu.get('a').attributes('href')).toBe('/account')
    const menubar = mount(Menubar, {
      props: { items: [{ value: 'a', label: '账号', href: '/account' }] },
    })
    expect(menubar.get('a').attributes('href')).toBe('/account')
  })

  it('retains page selection and accessible progress values', async () => {
    const pages = mount(PageTabs, {
      props: {
        modelValue: 'a',
        items: [
          { value: 'a', label: '甲' },
          { value: 'b', label: '乙' },
        ],
      },
    })
    await pages.findAll('[data-vean-page-tabs-item]')[1]?.trigger('click')
    expect(pages.emitted('update:modelValue')).toEqual([['b']])
    for (const component of [Progress, ProgressCircle]) {
      const progress = mount(component, { props: { modelValue: 40, max: 100 } })
      expect(progress.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('40')
    }
    expect(mount(Separator).find('[role="separator"]').exists()).toBe(true)
    expect(mount(Collapsible, { slots: { default: '内容' } }).text()).toBe('内容')
  })

  it('assembles overlay providers, controlled palettes and the complete theme customizer', async () => {
    const wrapper = mount(ConfigProvider, {
      props: { locale: 'zh-CN' },
      slots: {
        default: () => [
          h(Dialog, { title: '编辑' }, { trigger: () => h('button', '编辑') }),
          h(Popover, { title: '预览' }, { trigger: () => h('button', '预览') }),
          h(Tooltip, { content: '帮助' }, { trigger: () => h('button', '帮助') }),
          h(
            DropdownMenu,
            { items: [{ value: 'edit', label: '编辑' }] },
            { trigger: () => h('button', '操作') },
          ),
          h(ColorPicker, { modelValue: '#336699' }),
          h(PalettePicker, { modelValue: 'indigo.500' }),
          h(ThemeSettingsPanel, { persist: false }),
        ],
      },
    })
    await flushPromises()
    expect(wrapper.findComponent(Dialog).exists()).toBe(true)
    expect(wrapper.findComponent(PalettePicker).exists()).toBe(true)
    expect(wrapper.findComponent(ThemeSettingsPanel).exists()).toBe(true)
    expect(document.getElementById('vean-theme')).not.toBeNull()
  })
})
