// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import type { OrganizationUnit } from '../../shared/index.js'
import OrganizationUnitForm from './organization-unit-form.vue'

vi.mock('../../client/index.js', () => ({
  listOrganizationPositions: vi.fn(() => Promise.resolve({ data: { positions: [] }, error: null })),
  createOrganizationPosition: vi.fn(),
  updateOrganizationPosition: vi.fn(),
  deleteOrganizationPosition: vi.fn(),
  listOrganizationMembers: vi.fn(() => Promise.resolve({ data: { members: [] }, error: null })),
  listOrganizationMemberCandidates: vi.fn(() =>
    Promise.resolve({ data: { users: [] }, error: null }),
  ),
  createOrganizationMember: vi.fn(),
  updateOrganizationMember: vi.fn(),
  deleteOrganizationMember: vi.fn(),
  replaceOrganizationMemberPositions: vi.fn(),
}))

const unit: OrganizationUnit = {
  id: '00000000-0000-7000-8000-000000000001',
  parentId: null,
  code: 'HQ',
  name: '总部',
  type: 'COMPANY',
  status: 'ENABLED',
  sortOrder: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

function mountForm() {
  return mount(OrganizationUnitForm, {
    props: {
      selected: unit,
      creating: false,
      draftParentId: null,
      parentOptions: [{ id: null, label: '根组织', depth: 0 }],
      canManage: true,
      busy: false,
      selectedHasChildren: false,
      parentPath: [],
    },
  })
}

describe('OrganizationUnitForm', () => {
  it('restores the selected unit fields after cancelling create', async () => {
    const wrapper = mountForm()
    try {
      await wrapper.setProps({ creating: true, draftParentId: unit.id })
      const codeInput = wrapper.get('input[placeholder="如 HQ / RD-01"]')
      const nameInput = wrapper.get('input[placeholder="组织名称"]')
      await codeInput.setValue('NEW')
      await nameInput.setValue('新组织')

      await wrapper.setProps({ creating: false, draftParentId: null })

      expect(wrapper.get('h2').text()).toBe('总部')
      expect(
        (wrapper.get('input[placeholder="如 HQ / RD-01"]').element as HTMLInputElement).value,
      ).toBe('HQ')
      expect((wrapper.get('input[placeholder="组织名称"]').element as HTMLInputElement).value).toBe(
        '总部',
      )
    } finally {
      wrapper.unmount()
    }
  })
})
