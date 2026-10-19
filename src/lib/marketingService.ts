import { formatServicePrice, services, storeInfo } from '../data/mockData'
import type {
  Appointment,
  Customer,
  MarketingGenerateInput,
  MarketingGeneratedContent,
  MarketingSceneType,
  MarketingSection,
  MarketingTone,
  ServiceItem,
} from '../types'

export const MARKETING_SCENES: Array<{
  id: MarketingSceneType
  title: string
  description: string
  defaultPrompt: string
  defaultGoal: string
  defaultAudience: string
}> = [
  {
    id: 'new_customer_campaign',
    title: '新客拓客活动',
    description: '策划到店体验与拓客活动方案',
    defaultPrompt:
      '帮我策划一个周末基础清洁补水拓客活动，面向附近的新客户，并生成朋友圈文案。',
    defaultGoal: '吸引附近新客了解门店并预约体验',
    defaultAudience: '希望了解日常基础皮肤护理的新客户',
  },
  {
    id: 'moments_copy',
    title: '朋友圈宣传',
    description: '生成可直接发布的朋友圈文案',
    defaultPrompt: '帮我写一条朋友圈文案，介绍门店基础清洁补水护理。',
    defaultGoal: '提升项目曝光与咨询量',
    defaultAudience: '朋友圈潜在新客与未到店粉丝',
  },
  {
    id: 'old_customer_revisit',
    title: '老客回访',
    description: '生成老客户关怀与回访话术',
    defaultPrompt: '帮我写一段老客户回访话术，关心近期肤感并邀请到店护理。',
    defaultGoal: '促进老客复购与到店回访',
    defaultAudience: '已有到店记录或跟进中的老客户',
  },
  {
    id: 'new_customer_invite',
    title: '新客邀约',
    description: '生成新客预约邀约沟通话术',
    defaultPrompt: '帮我写一段新客邀约话术，介绍项目并引导预约咨询。',
    defaultGoal: '推动咨询中的新客完成预约',
    defaultAudience: '已咨询但尚未预约的新客户',
  },
  {
    id: 'festival_campaign',
    title: '节日营销',
    description: '策划节日或周末主题营销活动',
    defaultPrompt: '帮我策划一个周末护肤主题活动，并生成宣传文案和邀约话术。',
    defaultGoal: '借节日/周末节点提升到店咨询',
    defaultAudience: '关注护肤养护的潜在与既有客户',
  },
]

const FORBIDDEN_CLAIM =
  /根治|百分百|100%|永久去除|永久消除|彻底祛痘|彻底祛斑|抗衰成功|保证效果/

const DISCOUNT_HINT =
  /折扣|优惠|特价|限时|满减|立减|半价|打折|体验价|秒杀/

export function getSceneLabel(scene: MarketingSceneType): string {
  return MARKETING_SCENES.find((s) => s.id === scene)?.title ?? scene
}

function getService(serviceId?: string): ServiceItem | undefined {
  if (!serviceId) return undefined
  return services.find((s) => s.id === serviceId)
}

function detectServiceFromText(text: string): ServiceItem | undefined {
  const normalized = text.replace(/\s+/g, '')
  const sorted = [...services].sort((a, b) => b.name.length - a.name.length)
  for (const s of sorted) {
    if (normalized.includes(s.name)) return s
  }
  for (const s of services) {
    for (const alias of s.aliases ?? []) {
      if (alias.length >= 2 && normalized.includes(alias)) return s
    }
  }
  return undefined
}

function tonePhrase(tone: MarketingTone, variant: number): string {
  const map: Record<MarketingTone, string[]> = {
    专业可信: [
      '我们更关注护理过程的专业评估与到店体验安排',
      '建议先了解项目内容与时长，再选择合适的到店时间',
      '门店技师会根据肤质沟通护理流程，不做夸大承诺',
    ],
    亲切温和: [
      '欢迎随时告诉我们您的肤感和时间安排',
      '如果您方便，我们可以一起看看更合适的护理选择',
      '不用着急，先了解清楚再决定是否到店体验',
    ],
    轻松活泼: [
      '周末给皮肤放个小假，也给自己一点放松时间',
      '把护理安排进日程，轻松一点也很不错',
      '想体验的话，直接告诉我们方便的时间就好',
    ],
  }
  const list = map[tone]
  return list[variant % list.length]
}

function buildWarnings(
  input: MarketingGenerateInput,
  service?: ServiceItem,
): string[] {
  const warnings: string[] = []
  const text = `${input.prompt} ${input.promoRule ?? ''} ${input.goal ?? ''}`

  if (DISCOUNT_HINT.test(text) && !input.promoRule?.trim()) {
    warnings.push(
      '您提到了优惠/折扣活动，但未填写已确认的优惠规则。本方案不会编造折扣、名额或倒计时，请店主补充真实活动信息后再对外发布。',
    )
  }

  if (FORBIDDEN_CLAIM.test(text)) {
    warnings.push(
      '已自动规避“根治 / 百分百有效 / 永久去除”等绝对化表述，请勿在对外文案中承诺确定性疗效。',
    )
  }

  if (!service) {
    warnings.push(
      '未选择主推项目：已生成不涉及具体项目价格的通用文案。如需引用价格与时长，请选择统一价目表中的项目。',
    )
  }

  return warnings
}

function projectLine(service?: ServiceItem): string {
  if (!service) return '可结合门店现有护理项目进行介绍（请从价目表选择主推项目）'
  return `「${service.name}」：${formatServicePrice(service)}，时长 ${service.durationMinutes} 分钟。${service.description}`
}

function promoLine(promoRule?: string, wantsDiscount?: boolean): string {
  if (promoRule?.trim()) {
    return `活动规则（店主已确认）：${promoRule.trim()}`
  }
  if (wantsDiscount) {
    return '本期暂不公布具体折扣金额。请客户先了解项目内容与预约方式，优惠规则待门店确认后补充。'
  }
  return '本次以项目介绍与预约体验为主，不另行编造优惠价格。'
}

function sectionsToFullText(sections: MarketingSection[]): string {
  return sections
    .map((s) => `【${s.title}】\n${s.content}`)
    .join('\n\n')
}

function customerContext(
  customer?: Customer,
  appointments?: Appointment[],
): string {
  if (!customer) return ''
  const latest = appointments
    ?.filter((a) => a.customerId === customer.id)
    .sort((a, b) =>
      `${b.appointmentDate}${b.startTime}`.localeCompare(
        `${a.appointmentDate}${a.startTime}`,
      ),
    )[0]

  const lines = [
    `客户姓名：${customer.name}`,
    `关注项目：${customer.focusProject || '暂无明确记录'}`,
    `意向等级：${customer.intentLevel}`,
    `跟进状态：${customer.followUpStatus}`,
  ]
  if (latest) {
    lines.push(
      `最近预约：${latest.appointmentDate} ${latest.startTime}–${latest.endTime}「${latest.serviceName}」（${latest.status === 'booked' ? '已预约' : latest.status === 'cancelled' ? '已取消' : latest.status === 'completed' ? '已完成' : '待确认'}）`,
    )
  } else if (customer.lastAppointmentAt) {
    lines.push(`最近预约：${customer.lastAppointmentAt}`)
  } else {
    lines.push('最近预约：暂无预约记录')
  }
  return lines.join('\n')
}

function genNewCustomerCampaign(
  input: MarketingGenerateInput,
  service: ServiceItem | undefined,
  variant: number,
): MarketingSection[] {
  const date = input.activityDate?.trim() || '本周末'
  const audience = input.audience?.trim() || '希望了解日常基础皮肤护理的新客户'
  const goal = input.goal?.trim() || '吸引附近新客了解门店并预约体验'
  const tone = input.tone ?? '专业可信'
  const wantsDiscount = DISCOUNT_HINT.test(
    `${input.prompt} ${input.promoRule ?? ''}`,
  )
  const themes = [
    service
      ? `周末「${service.name}」新客体验活动`
      : '周末新客皮肤护理体验活动',
    service
      ? `附近新客「${service.name}」到店了解日`
      : '附近新客到店了解日',
    service
      ? `${date}「${service.name}」轻度体验邀约`
      : `${date}门店护理体验邀约`,
  ]

  const channels = [
    '朋友圈图文、门店私信咨询、到店前台介绍',
    '社区社群分享、朋友圈、门店预约登记',
    '附近住户触达、朋友圈、电话/微信预约咨询',
  ]

  return [
    {
      key: 'theme',
      title: '活动主题',
      content: themes[variant % themes.length],
    },
    {
      key: 'goal',
      title: '活动目标',
      content: goal,
    },
    {
      key: 'audience',
      title: '目标客群',
      content: audience,
    },
    {
      key: 'project',
      title: '主推项目',
      content: projectLine(service),
    },
    {
      key: 'schedule',
      title: '活动安排',
      content: [
        `建议档期：${date}`,
        '流程建议：到店接待 → 基础皮肤咨询（如适用）→ 介绍护理项目与时长 → 协助预约合适时段',
        promoLine(input.promoRule, wantsDiscount),
        tonePhrase(tone, variant),
      ].join('\n'),
    },
    {
      key: 'channels',
      title: '宣传渠道建议',
      content: channels[variant % channels.length],
    },
    {
      key: 'moments',
      title: '朋友圈文案',
      content: service
        ? [
            `【${storeInfo.name}】${date}欢迎新客了解「${service.name}」`,
            '',
            `${service.description}`,
            `护理时长约 ${service.durationMinutes} 分钟，项目价格 ${formatServicePrice(service)}。`,
            promoLine(input.promoRule, wantsDiscount),
            '',
            '想了解流程或预约到店时间，欢迎私信或电话咨询。',
            `咨询电话：${storeInfo.phone}`,
            '',
            '（内容为门店服务介绍，不承诺特定疗效）',
          ].join('\n')
        : [
            `【${storeInfo.name}】${date}欢迎新客到店了解基础护理项目`,
            '',
            '我们提供清洁、补水、舒缓等日常护理选项，可先到店沟通肤质与时间安排。',
            '具体项目与价格请以门店价目表为准。',
            '',
            `欢迎私信或拨打 ${storeInfo.phone} 咨询预约。`,
          ].join('\n'),
    },
    {
      key: 'invite',
      title: '客户邀约话术',
      content: service
        ? [
            `您好，我是${storeInfo.name}的顾问。`,
            `最近我们在邀请附近新客了解「${service.name}」（${formatServicePrice(service)} / ${service.durationMinutes} 分钟）。`,
            '如果您方便，我可以先介绍护理内容和到店流程，再帮您看看合适的时间。',
            '您更想先了解项目细节，还是直接预约咨询？',
          ].join('\n')
        : [
            `您好，我是${storeInfo.name}的顾问。`,
            '如果您对日常皮肤护理感兴趣，我可以介绍门店现有项目和预约方式。',
            '您方便说一下更关心清洁、补水还是舒缓类护理吗？',
          ].join('\n'),
    },
  ]
}

function genMoments(
  input: MarketingGenerateInput,
  service: ServiceItem | undefined,
  variant: number,
): MarketingSection[] {
  const tone = input.tone ?? '亲切温和'
  const titles = service
    ? [
        `给皮肤一次清爽补水｜${service.name}`,
        `${service.name}｜了解护理内容再决定是否到店`,
        `门店护理分享｜${service.name}`,
      ]
    : [
        '悦颜皮肤管理中心｜日常护理分享',
        '想了解基础护理？欢迎到店咨询',
        '周末护肤小事｜先了解再预约',
      ]

  const body = service
    ? [
        `${storeInfo.name}提醒您：`,
        service.description,
        `「${service.name}」价格 ${formatServicePrice(service)}，时长约 ${service.durationMinutes} 分钟。`,
        tonePhrase(tone, variant),
        input.promoRule?.trim()
          ? `活动说明：${input.promoRule.trim()}`
          : '如需了解到店流程，欢迎留言或私信。',
      ].join('\n')
    : [
        `${storeInfo.name}提供清洁、补水、舒缓等日常护理项目。`,
        '具体价格与时长请以门店价目表为准，欢迎先咨询再预约。',
        tonePhrase(tone, variant),
      ].join('\n')

  const ctas = [
    `想预约或咨询，欢迎私信，或拨打 ${storeInfo.phone}`,
    '评论区留下您方便的时间段，我们协助安排咨询',
    '点击头像了解更多项目，或直接私信预约咨询',
  ]

  return [
    { key: 'title', title: '文案标题', content: titles[variant % titles.length] },
    { key: 'body', title: '正文', content: body },
    {
      key: 'cta',
      title: '行动引导语',
      content: ctas[variant % ctas.length],
    },
  ]
}

function genOldRevisit(
  _input: MarketingGenerateInput,
  service: ServiceItem | undefined,
  variant: number,
  customer?: Customer,
  appointments?: Appointment[],
): MarketingSection[] {
  const ctx = customerContext(customer, appointments)
  const focus =
    service?.name ||
    customer?.focusProject ||
    '您关注过的护理项目'
  const openings = customer
    ? [
        `${customer.name}您好，我是${storeInfo.name}的顾问，好久不见。`,
        `${customer.name}您好，想跟您同步一下近期护理安排。`,
        `${customer.name}您好，冒昧打扰，想关心一下您最近的肤感。`,
      ]
    : [
        `您好，我是${storeInfo.name}的顾问。`,
        '您好，想做一次简单的护理回访。',
        '您好，感谢您此前对门店的关注。',
      ]

  const care = customer
    ? [
        ctx,
        '',
        '以上信息均来自门店已有记录，未添加未经确认的需求。',
        customer.notes
          ? `跟进备注参考：${customer.notes}`
          : '如您近期肤感有变化，也可以告诉我们。',
      ].join('\n')
    : '本次未选择具体客户，请店主根据真实回访情况补充客户近况，勿编造客户经历。'

  const suggest = service
    ? `若您仍关注「${service.name}」，可以了解其服务内容（${formatServicePrice(service)} / ${service.durationMinutes} 分钟）。是否到店由您决定，我们不做效果承诺。`
    : `如果您仍对「${focus}」感兴趣，我可以介绍门店对应项目的内容与预约方式。`

  const questions = [
    '您最近皮肤有干燥、紧绷或不适吗？',
    '这周或下周是否方便安排一次到店咨询？',
    '您更希望先了解项目细节，还是直接看可预约时段？',
  ]

  return [
    {
      key: 'opening',
      title: '回访开场',
      content: openings[variant % openings.length],
    },
    { key: 'care', title: '客户关怀内容', content: care },
    { key: 'suggest', title: '项目或服务建议', content: suggest },
    {
      key: 'questions',
      title: '后续沟通问题',
      content: questions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
    },
  ]
}

function genNewInvite(
  _input: MarketingGenerateInput,
  service: ServiceItem | undefined,
  variant: number,
  customer?: Customer,
  appointments?: Appointment[],
): MarketingSection[] {
  const ctx = customerContext(customer, appointments)
  const openings = customer
    ? [
        `${customer.name}您好，看到您此前咨询过${customer.focusProject || '门店护理'}，想跟您确认是否还需要了解。`,
        `${customer.name}您好，我是${storeInfo.name}顾问，方便占用您一分钟吗？`,
        `${customer.name}您好，关于您关注的护理项目，我这边整理了简要介绍。`,
      ]
    : [
        `您好，我是${storeInfo.name}顾问。`,
        '您好，感谢您对门店护理的兴趣。',
        '您好，想邀请您了解一下到店咨询流程。',
      ]

  const intro = service
    ? `「${service.name}」：${formatServicePrice(service)}，约 ${service.durationMinutes} 分钟。${service.description}`
    : '门店提供清洁、补水、舒缓、养护等项目，具体价格以统一价目表为准。'

  const guide = [
    '如果您方便，我可以帮您了解可预约时段。',
    '您也可以先预约「基础皮肤咨询」（免费，15 分钟）沟通肤质后再决定项目。',
    '请告诉我您更方便的日期（如明天/本周末），我帮您对照门店档期说明。',
  ]

  const faq = [
    'Q：会不会强制推销？\nA：咨询与预约以您的时间与需求为准，不强制下单。',
    'Q：项目有没有保证效果？\nA：我们介绍的是护理服务内容与流程，不承诺医疗或确定性疗效。',
    'Q：价格会不会额外加收？\nA：对外介绍以门店统一价目为准；如有经确认的活动规则，会单独说明。',
  ]

  return [
    {
      key: 'opening',
      title: '邀约开场',
      content:
        openings[variant % openings.length] +
        (customer ? `\n\n（客户档案摘要）\n${ctx}` : ''),
    },
    { key: 'intro', title: '项目介绍', content: intro },
    {
      key: 'guide',
      title: '预约引导',
      content: guide[variant % guide.length],
    },
    {
      key: 'faq',
      title: '常见顾虑的回应',
      content: faq.join('\n\n'),
    },
  ]
}

function genFestival(
  input: MarketingGenerateInput,
  service: ServiceItem | undefined,
  variant: number,
): MarketingSection[] {
  const date = input.activityDate?.trim() || '本周末 / 节日档期'
  const wantsDiscount = DISCOUNT_HINT.test(
    `${input.prompt} ${input.promoRule ?? ''}`,
  )
  const themes = [
    service
      ? `${date}「${service.name}」主题护理日`
      : `${date}悦颜护肤主题日`,
    service
      ? `节日轻护理｜${service.name}`
      : '节日轻护理邀约',
    `${date}门店护理体验周`,
  ]

  return [
    {
      key: 'theme',
      title: '活动主题',
      content: themes[variant % themes.length],
    },
    {
      key: 'content',
      title: '活动内容',
      content: [
        projectLine(service),
        `建议档期：${date}`,
        promoLine(input.promoRule, wantsDiscount),
        '安排：到店接待 → 项目介绍 → 预约登记（不编造名额与倒计时）',
      ].join('\n'),
    },
    {
      key: 'copy',
      title: '宣传文案',
      content: service
        ? [
            `${storeInfo.name}｜${date}`,
            `邀请您了解「${service.name}」（${formatServicePrice(service)} / ${service.durationMinutes} 分钟）`,
            service.description,
            promoLine(input.promoRule, wantsDiscount),
            `咨询预约：${storeInfo.phone}`,
          ].join('\n')
        : [
            `${storeInfo.name}｜${date}`,
            '欢迎了解门店日常护理项目，具体价格见统一价目表。',
            `咨询预约：${storeInfo.phone}`,
          ].join('\n'),
    },
    {
      key: 'invite',
      title: '客户邀约话术',
      content: [
        `您好，${date}我们整理了护理体验安排。`,
        service
          ? `如果您对「${service.name}」感兴趣，我可以介绍内容和可预约时间。`
          : '如果您想了解清洁/补水/舒缓类护理，我可以按价目表说明。',
        '您方便哪个时间段到店或先电话咨询呢？',
      ].join('\n'),
    },
  ]
}

export interface MarketingGenerateContext {
  customer?: Customer
  appointments?: Appointment[]
}

export function generateMarketingContent(
  input: MarketingGenerateInput,
  ctx: MarketingGenerateContext = {},
): MarketingGeneratedContent {
  const variant = input.variant ?? 0
  let service = getService(input.serviceId)
  if (!service) {
    service = detectServiceFromText(input.prompt)
  }

  const warnings = buildWarnings(input, service)
  let sections: MarketingSection[] = []

  switch (input.scene) {
    case 'new_customer_campaign':
      sections = genNewCustomerCampaign(input, service, variant)
      break
    case 'moments_copy':
      sections = genMoments(input, service, variant)
      break
    case 'old_customer_revisit':
      sections = genOldRevisit(
        input,
        service,
        variant,
        ctx.customer,
        ctx.appointments,
      )
      break
    case 'new_customer_invite':
      sections = genNewInvite(
        input,
        service,
        variant,
        ctx.customer,
        ctx.appointments,
      )
      break
    case 'festival_campaign':
      sections = genFestival(input, service, variant)
      break
  }

  const footer = [
    '——',
    `门店：${storeInfo.name}`,
    '生成方式：本地模板规则（Demo，未接入大模型）',
    '本内容仅供店主编辑参考，不代表已发送给客户。',
  ].join('\n')

  const fullText = `${sectionsToFullText(sections)}\n\n${footer}`

  return {
    scene: input.scene,
    sceneLabel: getSceneLabel(input.scene),
    serviceId: service?.id,
    serviceName: service?.name,
    sections,
    fullText,
    warnings,
    generatedAt: new Date().toISOString(),
  }
}

export function validateMarketingInput(input: {
  prompt: string
}): { ok: true } | { ok: false; error: string } {
  if (!input.prompt.trim()) {
    return {
      ok: false,
      error: '请先填写营销需求或选择快捷场景后再生成，不能生成空白结果。',
    }
  }
  return { ok: true }
}
