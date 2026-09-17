import { ApplicationError, type AuthContext } from '@jingwei/kernel'
import type {
  AuthorizationEvaluator,
  IamAccess,
  IamUserDirectory,
} from '@jingwei/module-iam/server/public'

import {
  isOrgUnitInDataScope,
  type CreateOrganizationMember,
  type OrganizationMember,
  type OrganizationMemberPosition,
  type ReplaceOrganizationMemberPositions,
  type UpdateOrganizationMember,
} from '../../shared/index.js'
import { organizationPermissionRequirements } from '../public/permission-requirements.js'
import type {
  MembershipStore,
  MembershipUnitOfWork,
  OrganizationMemberRecord,
} from './membership-store.js'

function fail(code: string, message: string, status = 409): never {
  throw new ApplicationError({ code, message, status })
}

/** Tenant-scoped org membership; positions are restricted to the same org unit. */
export class ManageOrganizationMembers {
  constructor(
    private readonly store: MembershipStore,
    private readonly work: MembershipUnitOfWork,
    private readonly access: IamAccess,
    private readonly users: IamUserDirectory,
    private readonly evaluator: AuthorizationEvaluator,
  ) {}

  private authorizeManage(context: AuthContext) {
    return this.access.requireUnscopedPermission(context, organizationPermissionRequirements.manage)
  }

  /** organization.view supports data scope, so view goes through the evaluator. */
  private async authorizeViewInScope(context: AuthContext, orgUnitId: string) {
    const dataScope = await this.evaluator.requireScopedPermission({
      context,
      requirement: organizationPermissionRequirements.view,
    })
    if (!isOrgUnitInDataScope(orgUnitId, dataScope))
      fail('PERMISSION_DENIED', '没有该组织的数据访问范围', 403)
  }

  async listByUnit(context: AuthContext, orgUnitId: string) {
    await this.authorizeViewInScope(context, orgUnitId)
    if (!(await this.store.unitExists(context.tenantId, orgUnitId)))
      fail('ORGANIZATION_UNIT_NOT_FOUND', '组织不存在', 404)
    const members = await this.store.listMembers(context.tenantId, orgUnitId)
    const assignments = await this.store.listMemberPositionsInUnit(context.tenantId, orgUnitId)
    const profiles = await this.users.findSafeProfiles(
      context.tenantId,
      members.map((member) => member.userId),
    )
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
    const positionsByUser = new Map<string, OrganizationMemberPosition[]>()
    for (const assignment of assignments) {
      const bucket = positionsByUser.get(assignment.userId)
      const item: OrganizationMemberPosition = {
        positionId: assignment.positionId,
        code: assignment.code,
        name: assignment.name,
        isPrimary: assignment.isPrimary,
      }
      if (bucket === undefined) positionsByUser.set(assignment.userId, [item])
      else bucket.push(item)
    }
    return {
      members: members.map((member) => this.toMemberDto(member, profileById, positionsByUser)),
    }
  }

  /** Active users eligible to join an org; requires manage, not iam.user.view. */
  async listMemberCandidates(context: AuthContext) {
    await this.authorizeManage(context)
    const profiles = await this.users.listSafeProfiles(context.tenantId, { status: 'ACTIVE' })
    return {
      users: profiles.map((profile) => ({
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        status: profile.status,
        avatar: profile.avatar,
      })),
    }
  }

  async add(context: AuthContext, orgUnitId: string, input: CreateOrganizationMember) {
    await this.authorizeManage(context)
    const created = await this.work.run(async (tx) => {
      const status = await tx.store.unitStatus(context.tenantId, orgUnitId)
      if (status === null) fail('ORGANIZATION_UNIT_NOT_FOUND', '组织不存在', 404)
      if (status === 'DISABLED') fail('ORGANIZATION_UNIT_DISABLED', '组织已禁用，不能新增成员')
      const existing = await this.users.usersExist(context.tenantId, [input.userId])
      if (!existing.has(input.userId)) fail('ORGANIZATION_USER_NOT_FOUND', '用户不存在', 404)
      if (await tx.store.memberExists(context.tenantId, orgUnitId, input.userId))
        fail('ORGANIZATION_MEMBER_EXISTS', '用户已在该组织中')

      const isPrimary = input.isPrimary ?? false
      const record: OrganizationMemberRecord = {
        userId: input.userId,
        orgUnitId,
        isPrimary,
        joinedAt: input.joinedAt ?? null,
      }
      const demotedOrgs = isPrimary
        ? await tx.store.clearOtherPrimaryOrgs(context, input.userId, orgUnitId)
        : []
      await tx.store.insertMember(context, record)

      const positionIds = input.positionIds ?? []
      let demotedPositions: readonly { positionId: string; orgUnitId: string }[] = []
      if (positionIds.length > 0)
        demotedPositions = await this.replacePositionsInTx(
          tx.store,
          context,
          orgUnitId,
          input.userId,
          positionIds.map((positionId) => ({ positionId })),
        )

      const member = await tx.store.getMember(context.tenantId, orgUnitId, input.userId)
      if (member === null) fail('ORGANIZATION_MEMBER_NOT_FOUND', '成员不存在', 404)
      const demotedOrgUnitIds = demotedOrgs.map((item) => item.orgUnitId)
      await tx.record(context, 'member_added', `${orgUnitId}:${input.userId}`, null, {
        orgUnitId,
        userId: input.userId,
        isPrimary,
        positionIds,
        demotedOrgUnitIds,
        demotedPositionIds: demotedPositions.map((item) => item.positionId),
      })
      return member
    })
    return this.hydrateMember(context, created)
  }

  async update(
    context: AuthContext,
    orgUnitId: string,
    userId: string,
    input: UpdateOrganizationMember,
  ) {
    await this.authorizeManage(context)
    const updated = await this.work.run(async (tx) => {
      const existing = await tx.store.getMember(context.tenantId, orgUnitId, userId)
      if (existing === null) fail('ORGANIZATION_MEMBER_NOT_FOUND', '成员不存在', 404)
      const demotedOrgs =
        input.isPrimary === true
          ? await tx.store.clearOtherPrimaryOrgs(context, userId, orgUnitId)
          : []
      const patch = {
        ...(input.isPrimary === undefined ? {} : { isPrimary: input.isPrimary }),
        ...(input.joinedAt === undefined ? {} : { joinedAt: input.joinedAt }),
      }
      await tx.store.updateMember(context, orgUnitId, userId, patch)
      const member = await tx.store.getMember(context.tenantId, orgUnitId, userId)
      if (member === null) fail('ORGANIZATION_MEMBER_NOT_FOUND', '成员不存在', 404)
      const demotedOrgUnitIds = demotedOrgs.map((item) => item.orgUnitId)
      await tx.record(context, 'member_updated', `${orgUnitId}:${userId}`, existing, {
        ...member,
        demotedOrgUnitIds,
      })
      return member
    })
    return this.hydrateMember(context, updated)
  }

  async remove(context: AuthContext, orgUnitId: string, userId: string) {
    await this.authorizeManage(context)
    return this.work.run(async (tx) => {
      const existing = await tx.store.getMember(context.tenantId, orgUnitId, userId)
      if (existing === null) fail('ORGANIZATION_MEMBER_NOT_FOUND', '成员不存在', 404)
      await tx.store.deleteMemberPositionsInUnit(context, orgUnitId, userId)
      await tx.store.deleteMember(context, orgUnitId, userId)
      await tx.record(context, 'member_removed', `${orgUnitId}:${userId}`, existing, null)
      return { orgUnitId, userId }
    })
  }

  async replacePositions(
    context: AuthContext,
    orgUnitId: string,
    userId: string,
    input: ReplaceOrganizationMemberPositions,
  ) {
    await this.authorizeManage(context)
    return this.work.run(async (tx) => {
      const member = await tx.store.getMember(context.tenantId, orgUnitId, userId)
      if (member === null) fail('ORGANIZATION_MEMBER_NOT_FOUND', '成员不存在', 404)
      const before = await tx.store.listUserPositionsInUnit(context.tenantId, orgUnitId, userId)
      const demotedPositions = await this.replacePositionsInTx(
        tx.store,
        context,
        orgUnitId,
        userId,
        input.assignments,
      )
      const after = await tx.store.listUserPositionsInUnit(context.tenantId, orgUnitId, userId)
      const demotedPositionIds = demotedPositions.map((item) => item.positionId)
      const demotedOrgUnitIds = [
        ...new Set(demotedPositions.map((item) => item.orgUnitId)),
      ].toSorted((a, b) => a.localeCompare(b))
      await tx.record(context, 'member_positions_replaced', `${orgUnitId}:${userId}`, before, {
        positions: after,
        demotedPositionIds,
        demotedOrgUnitIds,
      })
      return {
        positions: after.map((item) => ({
          positionId: item.positionId,
          code: item.code,
          name: item.name,
          isPrimary: item.isPrimary,
        })),
      }
    })
  }

  private async replacePositionsInTx(
    store: MembershipStore,
    context: AuthContext,
    orgUnitId: string,
    userId: string,
    assignments: readonly { positionId: string; isPrimary?: boolean | undefined }[],
  ): Promise<readonly { positionId: string; orgUnitId: string }[]> {
    const unique = new Map<string, { positionId: string; isPrimary: boolean }>()
    for (const assignment of assignments) {
      if (unique.has(assignment.positionId))
        fail('ORGANIZATION_POSITION_ASSIGNMENT_EXISTS', '同一岗位不能重复分配')
      unique.set(assignment.positionId, {
        positionId: assignment.positionId,
        isPrimary: assignment.isPrimary ?? false,
      })
    }
    const primaryCount = [...unique.values()].filter((item) => item.isPrimary).length
    if (primaryCount > 1)
      fail('ORGANIZATION_MULTIPLE_PRIMARY_POSITIONS', '同一用户只能有一个主岗位')

    const positionIds = [...unique.keys()]
    if (positionIds.length > 0) {
      const enabled = await store.enabledPositionIdsInUnit(context.tenantId, orgUnitId, positionIds)
      for (const positionId of positionIds) {
        if (!enabled.has(positionId))
          fail('ORGANIZATION_POSITION_NOT_IN_UNIT', '岗位不存在、不属于该组织或已停用', 404)
      }
    }

    const primary = [...unique.values()].find((item) => item.isPrimary)
    const demoted =
      primary === undefined
        ? []
        : await store.clearOtherPrimaryPositions(context, userId, [primary.positionId])
    await store.replaceMemberPositions(context, orgUnitId, userId, [...unique.values()])
    return demoted
  }

  private async hydrateMember(
    context: AuthContext,
    member: OrganizationMemberRecord,
  ): Promise<OrganizationMember> {
    const profiles = await this.users.findSafeProfiles(context.tenantId, [member.userId])
    const positions = await this.store.listUserPositionsInUnit(
      context.tenantId,
      member.orgUnitId,
      member.userId,
    )
    return this.toMemberDto(
      member,
      new Map(profiles.map((profile) => [profile.id, profile])),
      new Map([
        [
          member.userId,
          positions.map((item) => ({
            positionId: item.positionId,
            code: item.code,
            name: item.name,
            isPrimary: item.isPrimary,
          })),
        ],
      ]),
    )
  }

  private toMemberDto(
    member: OrganizationMemberRecord,
    profileById: Map<
      string,
      {
        id: string
        username: string
        displayName: string
        status: OrganizationMember['user']['status']
        avatar: string | null
      }
    >,
    positionsByUser: Map<string, OrganizationMemberPosition[]>,
  ): OrganizationMember {
    const profile = profileById.get(member.userId)
    return {
      userId: member.userId,
      orgUnitId: member.orgUnitId,
      isPrimary: member.isPrimary,
      joinedAt: member.joinedAt,
      user: {
        id: member.userId,
        username: profile?.username ?? '',
        displayName: profile?.displayName ?? '',
        status: profile?.status ?? 'DISABLED',
        avatar: profile?.avatar ?? null,
      },
      positions: positionsByUser.get(member.userId) ?? [],
    }
  }
}
