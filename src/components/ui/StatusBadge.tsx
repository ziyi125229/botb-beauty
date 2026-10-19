import {
  APPOINTMENT_STATUS_LABEL,
  type AppointmentStatus,
  type FollowUpStatus,
  type FollowUpTaskStatus,
  type IntentLevel,
} from '../../types'

const appointmentStyles: Record<AppointmentStatus, string> = {
  pending_confirmation: 'bg-amber-50 text-amber-700 border-amber-200',
  booked: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-slate-50 text-slate-600 border-slate-200',
  cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
}

const followUpStyles: Record<FollowUpStatus, string> = {
  待跟进: 'bg-amber-50 text-amber-700 border-amber-200',
  跟进中: 'bg-brand-50 text-brand-700 border-brand-200',
  已预约: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  暂缓: 'bg-slate-50 text-slate-600 border-slate-200',
}

const intentStyles: Record<IntentLevel, string> = {
  高意向: 'bg-brand-50 text-brand-700 border-brand-200',
  观望: 'bg-sky-50 text-sky-700 border-sky-200',
  低意向: 'bg-slate-50 text-slate-600 border-slate-200',
  未知: 'bg-stone-50 text-stone-600 border-stone-200',
}

const taskStyles: Record<FollowUpTaskStatus, string> = {
  待跟进: 'bg-amber-50 text-amber-700 border-amber-200',
  已完成: 'bg-slate-50 text-slate-600 border-slate-200',
}

type StatusBadgeProps =
  | { type: 'appointment'; status: AppointmentStatus }
  | { type: 'followup'; status: FollowUpStatus }
  | { type: 'intent'; status: IntentLevel }
  | { type: 'task'; status: FollowUpTaskStatus }
  | { type: 'topic'; status: string }
  | { type: 'tag'; status: string }

export function StatusBadge(props: StatusBadgeProps) {
  let className = 'bg-slate-50 text-slate-600 border-slate-200'
  let label = ''

  if (props.type === 'appointment') {
    className = appointmentStyles[props.status]
    label = APPOINTMENT_STATUS_LABEL[props.status]
  } else if (props.type === 'followup') {
    className = followUpStyles[props.status]
    label = props.status
  } else if (props.type === 'intent') {
    className = intentStyles[props.status]
    label = props.status
  } else if (props.type === 'task') {
    className = taskStyles[props.status]
    label = props.status
  } else if (props.type === 'tag') {
    className = 'bg-surface text-text-secondary border-border'
    label = props.status
  } else {
    className = 'bg-brand-50 text-brand-700 border-brand-200'
    label = props.status
  }

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}
