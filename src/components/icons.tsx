import type { ReactNode } from 'react'

type IconProps = { size?: number }

function Icon({ children, size = 16 }: { children: ReactNode } & IconProps) {
  return (
    <svg aria-hidden="true" fill="none" height={size} viewBox="0 0 16 16" width={size}>
      {children}
    </svg>
  )
}

const stroke = {
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 1.5,
} as const

export const SparkleIcon = (props: IconProps) => (
  <Icon {...props}>
    <path
      d="M6.5 3.5Q7.2 8.8 12.5 9.5Q7.2 10.2 6.5 15.5Q5.8 10.2 0.5 9.5Q5.8 8.8 6.5 3.5Z"
      fill="currentColor"
    />
    <path
      d="M13 0.5Q13.3 2.7 15.5 3Q13.3 3.3 13 5.5Q12.7 3.3 10.5 3Q12.7 2.7 13 0.5Z"
      fill="currentColor"
    />
  </Icon>
)

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.5" {...stroke} strokeWidth={1} />
    <path d="M10.5 10.5L14 14" {...stroke} strokeWidth={1} />
  </Icon>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" {...stroke} />
  </Icon>
)

export const StopIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect fill="currentColor" height="16" rx="3" width="16" />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3v10M3 8h10" {...stroke} />
  </Icon>
)

export const ChevronIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6l4 4 4-4" {...stroke} />
  </Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 8.5l3 3 6-7" {...stroke} />
  </Icon>
)

export const CrossIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" {...stroke} />
  </Icon>
)
