import { formatServicePrice, services, storeInfo } from '../data/mockData'
import type { Appointment, ServiceItem } from '../types'
import { describeLatestAppointment } from './bookingFlow'
import { nowTimeLabel as timeLabel } from './dateUtils'

export const MEDICAL_PATTERNS = [
  /治疗/,
  /诊断/,
  /开药/,
  /用药/,
  /处方/,
  /医院/,
  /手术/,
  /病理/,
  /激素/,
  /湿疹/,
  /皮炎/,
  /感染/,
  /疾病/,
  /医生/,
  /看病/,
  /药物/,
  /消炎药/,
  /抗生素/,
  /医美手术/,
  /激光治疗/,
  /能不能治/,
  /怎么治/,
]

export function isMedicalQuery(text: string): boolean {
  return MEDICAL_PATTERNS.some((p) => p.test(text))
}

const PRICE_PATTERNS = [/多少钱/, /价格/, /收费/, /费用/, /价位/, /贵不贵/]
const INTRO_PATTERNS = [/介绍/, /是什么/, /做什么/, /包含/, /适合/, /多久/, /多长时间/, /时长/]
const HOURS_PATTERNS = [/营业时间/, /几点开门/, /几点关门/, /什么时候开门/, /上班时间/, /营业吗/]
const LOCATION_PATTERNS = [/在哪里/, /地址/, /位置/, /怎么去/, /门店地址/]
const LIST_SERVICES_PATTERNS = [/有哪些项目/, /价目表/, /项目列表/, /都有什么护理/, /有什么项目/]

const UNKNOWN_SERVICE_HINTS = [
  '光子嫩肤',
  '水光针',
  '玻尿酸',
  '热玛吉',
  '皮秒',
  '超声刀',
  '祛痘针',
  '刷酸',
  '微针',
]

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, '')
}

export function matchService(text: string): ServiceItem | undefined {
  const normalized = normalize(text)
  const byNameLen = [...services].sort((a, b) => b.name.length - a.name.length)

  for (const service of byNameLen) {
    if (normalized.includes(normalize(service.name))) {
      return service
    }
  }

  const aliasHits: { service: ServiceItem; aliasLen: number }[] = []
  for (const service of services) {
    for (const alias of service.aliases ?? []) {
      if (alias.length >= 2 && normalized.includes(normalize(alias))) {
        aliasHits.push({ service, aliasLen: alias.length })
      }
    }
  }

  if (aliasHits.length === 0) return undefined
  aliasHits.sort((a, b) => b.aliasLen - a.aliasLen)
  return aliasHits[0]?.service
}

function mentionsUnknownService(text: string): boolean {
  return UNKNOWN_SERVICE_HINTS.some((hint) => text.includes(hint))
}

function looksLikeUnknownPricedProject(
  text: string,
  service?: ServiceItem,
): boolean {
  if (service) return false
  if (!PRICE_PATTERNS.some((p) => p.test(text))) return false

  const stripped = text
    .replace(/多少钱|价格|收费|费用|价位|贵不贵|吗|呢|啊|呀|请问|一下|大概|一般/g, '')
    .replace(/[？?！!，,。.\s]/g, '')
    .trim()

  if (stripped.length < 2) return false
  if (/你们|门店|护理|项目|你们店|价目/.test(stripped) && stripped.length <= 4) {
    return false
  }

  return !services.some(
    (s) =>
      stripped.includes(s.name) ||
      (s.aliases ?? []).some((a) => a.length >= 2 && stripped.includes(a)),
  )
}

function formatServiceLine(service: ServiceItem): string {
  return `「${service.name}」：${formatServicePrice(service)}，时长 ${service.durationMinutes} 分钟`
}

function replyPrice(service?: ServiceItem): string {
  if (service) {
    return `${formatServiceLine(service)}。${service.description}`
  }
  const list = services.map((s) => formatServiceLine(s)).join('\n')
  return `当前门店已配置的护理价格如下（演示数据）：\n${list}\n\n如需查询某一项目，请直接说出项目名称。未配置的项目我无法提供价格。`
}

function replyIntro(service?: ServiceItem): string {
  if (service) {
    return `${formatServiceLine(service)}。\n项目说明：${service.description}`
  }
  return replyPrice()
}

/**
 * 非预约流程的规则回复。预约相关由 bookingFlow 接管。
 */
export function generateReply(
  userText: string,
  options?: { latestAppointment?: Appointment },
): string {
  const text = userText.trim()
  if (!text) return '请问有什么可以帮您？'

  if (isMedicalQuery(text)) {
    return `抱歉，我无法提供医疗诊断、用药建议或疾病治疗方案。\n\n悦颜皮肤管理中心提供的是非医疗性质的皮肤护理与咨询服务。如您有皮肤疾病、用药或治疗相关问题，请前往正规医疗机构咨询专业医生。\n\n已为您登记「待人工处理」事项，店员可在客户管理 / 经营概览待处理事项中查看（前端 Demo，非真实转接系统）。`
  }

  if (mentionsUnknownService(text)) {
    const names = services.map((s) => s.name).join('、')
    return `该项目暂未配置在本门店演示价目表中，我无法提供价格或详情。\n\n当前可查询的项目有：${names}。`
  }

  const service = matchService(text)

  if (looksLikeUnknownPricedProject(text, service)) {
    const names = services.map((s) => s.name).join('、')
    return `该项目暂未配置在本门店演示价目表中，我无法提供价格或详情。\n\n当前可查询的项目有：${names}。`
  }

  if (/我的预约|预约详情|预约信息|查一下预约/.test(text)) {
    if (options?.latestAppointment) {
      return describeLatestAppointment(options.latestAppointment)
    }
    return '当前会话还没有关联的预约记录。您可以说「我想预约一次护理」开始预约。'
  }

  if (/改时间|改约|改期/.test(text)) {
    return '如需改期，请前往「预约管理」选择对应预约进行改期；或在本对话中重新发起预约流程。改期会先校验新时段是否可用，失败时不会丢失原预约。'
  }

  if (HOURS_PATTERNS.some((p) => p.test(text))) {
    return `${storeInfo.name}营业时间为：${storeInfo.businessHours}。当前门店状态：${storeInfo.businessStatus}。`
  }

  if (LOCATION_PATTERNS.some((p) => p.test(text))) {
    return `${storeInfo.name}地址：${storeInfo.address}。咨询电话：${storeInfo.phone}。`
  }

  if (LIST_SERVICES_PATTERNS.some((p) => p.test(text))) {
    return replyPrice()
  }

  if (PRICE_PATTERNS.some((p) => p.test(text))) {
    return replyPrice(service)
  }

  if (INTRO_PATTERNS.some((p) => p.test(text)) && service) {
    return replyIntro(service)
  }

  if (service) {
    return replyIntro(service)
  }

  if (/你好|您好|在吗|嗨|hello/i.test(text)) {
    return `您好，我是${storeInfo.name}的 AI 接待助手（规则演示版）。可以帮您查询项目价格、营业时间、门店地址，或完成预约流程。`
  }

  return `我可以协助您查询项目价格与介绍、营业时间与门店地址，以及预约流程（前端演示，未接入大模型）。\n\n您可以说「我想预约一次护理」开始预约，或点击下方快捷问题。`
}

export function nowTimeLabel(): string {
  return timeLabel()
}
