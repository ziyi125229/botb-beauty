import type {
  Appointment,
  ChatSession,
  Customer,
  FollowUpTask,
  ReceptionRecord,
  ServiceItem,
  StoreInfo,
  Technician,
} from '../types'
import { addDays, addMinutesToTime, getTodayDate } from '../lib/dateUtils'
import {
  createPresentationCustomer,
  createPresentationSession,
} from './presentation'

/** 示例门店基础信息（虚构） */
export const storeInfo: StoreInfo = {
  name: '悦颜皮肤管理中心',
  brand: 'BotB 美业门店智能体',
  businessStatus: '营业中',
  address: '上海市静安区南京西路 1266 号悦颜中心 3 楼',
  phone: '021-6238-8890',
  businessHours: '每日 10:00–21:00（法定节假日正常营业）',
  openTime: '10:00',
  closeTime: '21:00',
}

/** 统一服务项目与价格 */
export const services: ServiceItem[] = [
  {
    id: 'svc-clean',
    name: '基础清洁护理',
    price: 128,
    durationMinutes: 40,
    description: '基础清洁、去角质与皮肤舒缓，适合日常保养与初次到店体验。',
    aliases: ['清洁护理'],
  },
  {
    id: 'svc-clean-hydrate',
    name: '基础清洁补水',
    price: 198,
    durationMinutes: 60,
    description: '清洁后补充保湿精华，改善干燥紧绷，适合干性与混合偏干肤质。',
    aliases: ['清洁补水', '基础补水'],
  },
  {
    id: 'svc-soothe-hydrate',
    name: '舒缓补水护理',
    price: 268,
    durationMinutes: 60,
    description: '温和舒缓与深层补水，适合换季敏感、泛红不适的肌肤状态。',
    aliases: ['舒缓补水', '补水护理'],
  },
  {
    id: 'svc-skin-care',
    name: '肌肤养护护理',
    price: 328,
    durationMinutes: 75,
    description: '综合清洁、养护与放松护理，适合希望做完整护理流程的客户。',
    aliases: ['肌肤养护', '养护护理'],
  },
  {
    id: 'svc-shoulder',
    name: '肩颈舒缓护理',
    price: 168,
    durationMinutes: 40,
    description: '针对肩颈僵硬与疲劳的舒缓护理，可与面部护理搭配安排。',
    aliases: ['肩颈舒缓', '肩颈护理'],
  },
  {
    id: 'svc-consult',
    name: '基础皮肤咨询',
    price: 0,
    durationMinutes: 15,
    description: '到店基础皮肤状态沟通与项目建议，不含医疗诊断。',
    aliases: ['皮肤咨询', '免费咨询'],
  },
]

export const technicians: Technician[] = [
  {
    id: 'tech-01',
    name: '小美',
    specialty: '清洁与补水护理',
    serviceIds: [
      'svc-clean',
      'svc-clean-hydrate',
      'svc-soothe-hydrate',
      'svc-consult',
    ],
    workStart: '10:00',
    workEnd: '20:00',
  },
  {
    id: 'tech-02',
    name: '阿怡',
    specialty: '舒缓与养护护理',
    serviceIds: [
      'svc-clean-hydrate',
      'svc-soothe-hydrate',
      'svc-skin-care',
      'svc-consult',
    ],
    workStart: '11:00',
    workEnd: '21:00',
  },
  {
    id: 'tech-03',
    name: '小悦',
    specialty: '肩颈舒缓与到店接待',
    serviceIds: ['svc-shoulder', 'svc-clean', 'svc-consult'],
    workStart: '10:00',
    workEnd: '19:00',
  },
]

export const seedCustomers: Customer[] = [
  createPresentationCustomer(),
  {
    id: 'cus-001',
    name: '刘梦瑶',
    phone: '135****8820',
    firstConsultAt: addDays(getTodayDate(), -14),
    focusProjectId: 'svc-clean-hydrate',
    focusProject: '基础清洁补水',
    intentLevel: '高意向',
    intentReason: '明确询问体验档期，表示本周可到店',
    tags: ['新客', '价格敏感'],
    lastConsultAt: addDays(getTodayDate(), -1),
    lastVisit: addDays(getTodayDate(), -6),
    followUpStatus: '待跟进',
    notes: '询问基础清洁补水价格，考虑本周预约体验',
  },
  {
    id: 'cus-002',
    name: '黄诗涵',
    phone: '158****3347',
    firstConsultAt: addDays(getTodayDate(), -20),
    focusProjectId: 'svc-soothe-hydrate',
    focusProject: '舒缓补水护理',
    intentLevel: '观望',
    intentReason: '对舒缓补水有兴趣，仍在比较时间与价格',
    tags: ['干敏肌', '换季护理'],
    lastConsultAt: addDays(getTodayDate(), -2),
    lastVisit: addDays(getTodayDate(), -10),
    followUpStatus: '跟进中',
    notes: '换季干敏，关注舒缓补水是否合适',
  },
  {
    id: 'cus-003',
    name: '郑欣然',
    phone: '186****2291',
    firstConsultAt: addDays(getTodayDate(), -8),
    focusProjectId: 'svc-skin-care',
    focusProject: '肌肤养护护理',
    intentLevel: '高意向',
    intentReason: '已提交预约待确认，明确希望体验养护项目',
    tags: ['预约待确认'],
    lastConsultAt: addDays(getTodayDate(), -1),
    lastVisit: addDays(getTodayDate(), -3),
    followUpStatus: '待跟进',
    notes: '咨询养护时长与到店频率，需回访确认档期',
  },
  {
    id: 'cus-004',
    name: '孙悦',
    phone: '139****6674',
    firstConsultAt: addDays(getTodayDate(), -60),
    focusProjectId: 'svc-shoulder',
    focusProject: '肩颈舒缓护理',
    intentLevel: '高意向',
    intentReason: '老客表达复购肩颈舒缓意愿',
    tags: ['老客复购'],
    lastConsultAt: addDays(getTodayDate(), -5),
    lastVisit: addDays(getTodayDate(), -20),
    followUpStatus: '跟进中',
    notes: '希望搭配面部护理复购肩颈舒缓',
  },
  {
    id: 'cus-005',
    name: '林婉清',
    phone: '138****2618',
    firstConsultAt: addDays(getTodayDate(), -40),
    focusProjectId: 'svc-clean',
    focusProject: '基础清洁护理',
    intentLevel: '高意向',
    intentReason: '已完成今日预约确认',
    tags: ['老客复购', '已预约'],
    lastConsultAt: getTodayDate(),
    lastVisit: getTodayDate(),
    lastAppointmentAt: `${getTodayDate()} 10:00`,
    followUpStatus: '已预约',
  },
  {
    id: 'cus-006',
    name: '赵思涵',
    phone: '139****7742',
    firstConsultAt: addDays(getTodayDate(), -12),
    focusProjectId: 'svc-clean-hydrate',
    focusProject: '基础清洁补水',
    intentLevel: '观望',
    intentReason: '已预约到店，此前主要咨询价格与时长',
    tags: ['已预约'],
    lastConsultAt: getTodayDate(),
    lastVisit: getTodayDate(),
    lastAppointmentAt: `${getTodayDate()} 11:30`,
    followUpStatus: '已预约',
  },
  {
    id: 'cus-007',
    name: '周雅静',
    phone: '150****4489',
    firstConsultAt: addDays(getTodayDate(), -30),
    focusProjectId: 'svc-skin-care',
    focusProject: '肌肤养护护理',
    intentLevel: '高意向',
    intentReason: '主动选择今日养护档期并完成预约',
    tags: ['已预约'],
    lastConsultAt: addDays(getTodayDate(), -2),
    lastVisit: addDays(getTodayDate(), -13),
    lastAppointmentAt: `${getTodayDate()} 16:30`,
    followUpStatus: '已预约',
  },
  {
    id: 'cus-008',
    name: '吴静怡',
    phone: '137****1156',
    firstConsultAt: addDays(getTodayDate(), -45),
    focusProjectId: 'svc-soothe-hydrate',
    focusProject: '舒缓补水护理',
    intentLevel: '观望',
    intentReason: '关注舒缓补水，近期时间不确定',
    tags: ['观望中'],
    lastConsultAt: addDays(getTodayDate(), -7),
    lastVisit: addDays(getTodayDate(), -28),
    lastAppointmentAt: `${getTodayDate()} 18:00`,
    followUpStatus: '暂缓',
  },
]

function seedApt(partial: {
  id: string
  customerId: string
  customerName: string
  phone?: string
  serviceId: string
  date: string
  startTime: string
  staffId: string
  staffName: string
  status: Appointment['status']
  remark?: string
}): Appointment {
  const service = services.find((s) => s.id === partial.serviceId)!
  return {
    appointmentId: partial.id,
    customerId: partial.customerId,
    customerName: partial.customerName,
    serviceId: service.id,
    serviceName: service.name,
    durationMinutes: service.durationMinutes,
    appointmentDate: partial.date,
    startTime: partial.startTime,
    endTime: addMinutesToTime(partial.startTime, service.durationMinutes),
    staffId: partial.staffId,
    staffName: partial.staffName,
    status: partial.status,
    createdAt: `${partial.date}T08:00:00.000Z`,
    remark: partial.remark ?? '',
    phone: partial.phone,
    source: 'manual',
  }
}

export function createSeedAppointments(): Appointment[] {
  const today = getTodayDate()
  return [
    seedApt({
      id: 'apt-001',
      customerId: 'cus-005',
      customerName: '林婉清',
      phone: '138****2618',
      serviceId: 'svc-clean',
      date: today,
      startTime: '10:00',
      staffId: 'tech-01',
      staffName: '小美',
      status: 'booked',
    }),
    seedApt({
      id: 'apt-002',
      customerId: 'cus-006',
      customerName: '赵思涵',
      phone: '139****7742',
      serviceId: 'svc-clean-hydrate',
      date: today,
      startTime: '11:30',
      staffId: 'tech-02',
      staffName: '阿怡',
      status: 'booked',
    }),
    seedApt({
      id: 'apt-003',
      customerId: 'cus-003',
      customerName: '郑欣然',
      phone: '186****2291',
      serviceId: 'svc-skin-care',
      date: today,
      startTime: '14:00',
      staffId: 'tech-01',
      staffName: '小美',
      status: 'pending_confirmation',
      remark: '待门店确认',
    }),
    seedApt({
      id: 'apt-004',
      customerId: 'cus-007',
      customerName: '周雅静',
      phone: '150****4489',
      serviceId: 'svc-skin-care',
      date: today,
      startTime: '16:30',
      staffId: 'tech-02',
      staffName: '阿怡',
      status: 'booked',
    }),
    seedApt({
      id: 'apt-005',
      customerId: 'cus-008',
      customerName: '吴静怡',
      phone: '137****1156',
      serviceId: 'svc-soothe-hydrate',
      date: today,
      startTime: '18:00',
      staffId: 'tech-01',
      staffName: '小美',
      status: 'booked',
    }),
  ]
}

export function createSeedFollowUpTasks(): FollowUpTask[] {
  const today = getTodayDate()
  return [
    {
      id: 'task-001',
      customerId: 'cus-001',
      customerName: '刘梦瑶',
      title: '回访基础清洁补水意向',
      note: '客户询问价格后未确认预约',
      createdAt: `${addDays(today, -1)}T10:00:00.000Z`,
      dueDate: today,
      status: '待跟进',
      category: 'customer_followup',
    },
    {
      id: 'task-002',
      customerId: 'cus-003',
      customerName: '郑欣然',
      title: '确认今日预约',
      note: '预约仍为待确认状态',
      createdAt: `${addDays(today, -1)}T11:00:00.000Z`,
      dueDate: today,
      status: '待跟进',
      category: 'customer_followup',
    },
    {
      id: 'task-003',
      customerId: 'cus-002',
      customerName: '黄诗涵',
      title: '跟进舒缓补水护理方案',
      note: '换季敏感肌咨询中',
      createdAt: `${addDays(today, -2)}T09:30:00.000Z`,
      dueDate: addDays(today, 1),
      status: '待跟进',
      category: 'customer_followup',
    },
  ]
}

export const seedReceptionRecords: ReceptionRecord[] = [
  {
    id: 'rec-001',
    customerId: 'cus-005',
    customerName: '林婉清',
    time: '09:42',
    summary: '咨询基础清洁护理适合肤质，并确认今日 10:00 预约。',
    topic: '预约意向',
  },
  {
    id: 'rec-002',
    customerId: 'cus-001',
    customerName: '刘梦瑶',
    time: '09:15',
    summary: '了解基础清洁补水价格与护理时长，询问是否可当天体验。',
    topic: '价格询问',
  },
  {
    id: 'rec-003',
    customerId: 'cus-002',
    customerName: '黄诗涵',
    time: '08:50',
    summary: '询问舒缓补水护理对干敏肌是否适用，以及护理时长。',
    topic: '项目咨询',
  },
  {
    id: 'rec-004',
    customerId: 'cus-003',
    customerName: '郑欣然',
    time: '昨 19:20',
    summary: '确认肌肤养护护理注意事项，并申请改约到今日下午。',
    topic: '预约意向',
  },
]

/** 种子会话：今日进行中的会话计入「今日咨询量」 */
export function createSeedChatSessions(): ChatSession[] {
  const today = getTodayDate()
  const yesterday = addDays(today, -1)

  return [
    createPresentationSession(),
    {
      id: 'chat-001',
      customerId: 'cus-001',
      customerName: '刘梦瑶',
      lastMessage: '基础清洁补水多少钱？',
      time: '09:15',
      lastActivityAt: `${today}T09:15:00`,
      unread: 1,
      status: '进行中',
      messages: [
        {
          id: 'chat-001-m1',
          role: 'customer',
          content: '你好，我想了解一下基础清洁补水',
          time: '09:12',
          date: today,
        },
        {
          id: 'chat-001-m2',
          role: 'assistant',
          content:
            '您好，欢迎咨询悦颜皮肤管理中心。「基础清洁补水」包含清洁与补水护理，时长 60 分钟，价格 198 元。请问您更关心价格、护理内容，还是预约到店体验？',
          time: '09:12',
          date: today,
        },
        {
          id: 'chat-001-m3',
          role: 'customer',
          content: '基础清洁补水多少钱？',
          time: '09:15',
          date: today,
        },
        {
          id: 'chat-001-m4',
          role: 'assistant',
          content:
            '「基础清洁补水」目前价格为 198 元，护理时长 60 分钟。如需了解其他项目，也可以告诉我项目名称。',
          time: '09:16',
          date: today,
        },
      ],
    },
    {
      id: 'chat-002',
      customerId: 'cus-002',
      customerName: '黄诗涵',
      lastMessage: '干敏肌能做舒缓补水护理吗？',
      time: '08:50',
      lastActivityAt: `${today}T08:50:00`,
      status: '进行中',
      messages: [
        {
          id: 'chat-002-m1',
          role: 'customer',
          content: '换季皮肤又干又敏，有没有合适的护理？',
          time: '08:48',
          date: today,
        },
        {
          id: 'chat-002-m2',
          role: 'assistant',
          content:
            '可以考虑「舒缓补水护理」：价格 268 元，时长 60 分钟，偏温和舒缓与补水。也可用「基础皮肤咨询」（免费，15 分钟）先到店沟通肤质。请问您更想先了解项目，还是预约咨询？',
          time: '08:49',
          date: today,
        },
        {
          id: 'chat-002-m3',
          role: 'customer',
          content: '干敏肌能做舒缓补水护理吗？',
          time: '08:50',
          date: today,
        },
      ],
    },
    {
      id: 'chat-003',
      customerId: 'cus-003',
      customerName: '郑欣然',
      lastMessage: '下午两点可以改约吗？',
      time: '19:20',
      lastActivityAt: `${yesterday}T19:20:00`,
      status: '已结束',
      latestAppointmentId: 'apt-003',
      messages: [
        {
          id: 'chat-003-m1',
          role: 'customer',
          content: '我原来约的早上有事，下午两点可以改约吗？',
          time: '19:18',
          date: yesterday,
        },
        {
          id: 'chat-003-m2',
          role: 'assistant',
          content:
            '可以协助改约。今日 14:00「肌肤养护护理」已为您登记为待确认预约，技师小美。您也可以在预约管理中确认或改期。',
          time: '19:20',
          date: yesterday,
        },
      ],
    },
  ]
}

/** @deprecated 兼容旧引用，请优先使用 createSeedChatSessions() */
export const seedChatSessions = createSeedChatSessions()

export const quickQuestions = [
  '基础清洁补水多少钱？',
  '明天下午有空位吗？',
  '我想预约一次护理。',
  '预约可以改时间吗？',
  '你们门店在哪里？',
]

export const marketingScenes = [
  {
    id: 'scene-1',
    title: '新客体验活动',
    description: '面向首次到店客户的体验价文案',
  },
  {
    id: 'scene-2',
    title: '换季护肤提醒',
    description: '舒缓补水与清洁补水推广',
  },
  {
    id: 'scene-3',
    title: '老客复购回访',
    description: '护理结束后的复购关怀话术',
  },
  {
    id: 'scene-4',
    title: '小红书种草笔记',
    description: '门店项目种草短文与标题',
  },
]

export function formatServicePrice(service: ServiceItem): string {
  return service.price === 0 ? '免费' : `${service.price} 元`
}

export function matchServiceFromText(text: string): ServiceItem | undefined {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, '')
  const byNameLen = [...services].sort((a, b) => b.name.length - a.name.length)

  for (const service of byNameLen) {
    if (normalized.includes(service.name.toLowerCase().replace(/\s+/g, ''))) {
      return service
    }
  }

  const aliasHits: { service: ServiceItem; aliasLen: number }[] = []
  for (const service of services) {
    for (const alias of service.aliases ?? []) {
      if (alias.length >= 2 && normalized.includes(alias.toLowerCase())) {
        aliasHits.push({ service, aliasLen: alias.length })
      }
    }
  }
  if (aliasHits.length === 0) return undefined
  aliasHits.sort((a, b) => b.aliasLen - a.aliasLen)
  return aliasHits[0]?.service
}
