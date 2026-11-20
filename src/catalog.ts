export const icons = [
  'none', 'education', 'work', 'project', 'skills', 'contact', 'mail', 'location', 'phone', 'globe', 'certificate', 'award', 'languages', 'calendar', 'research', 'publication', 'volunteer', 'code', 'chart', 'portfolio'
] as const
type Icon = typeof icons[number]

export const iconNames: Record<Icon, string> = {
  none: '无图标',
  education: '教育',
  work: '工作',
  project: '项目',
  skills: '技能',
  contact: '联系人',
  mail: '邮箱',
  location: '地点',
  phone: '电话',
  globe: '网站',
  certificate: '证书',
  award: '奖项',
  languages: '语言',
  calendar: '日期',
  research: '研究',
  publication: '出版物',
  volunteer: '志愿服务',
  code: '开发',
  chart: '业绩',
  portfolio: '作品集',
}

export const iconPaths: Record<Exclude<Icon, 'none'>, string> = {
  education: 'M2 9l10-5 10 5-10 5z M6 11v6q6 5 12 0v-6 M22 9v7',
  work: 'M3 8h18v12H3z M8 8V5h8v3 M3 11q9 6 18 0 M11 13h2v3h-2z',
  project: 'M2 6h8l3 3h9l-3 11H2z M3 10h9',
  skills: 'M14 5a6 6 0 0 0-7 8l-4 4a2.5 2.5 0 0 0 4 4l5-6a6 6 0 0 0 7-8l-4 4-3-3z',
  contact: 'M 4 4 L 20 4 L 20 20 L 4 20 Z M 9 9 C 9 5 15 5 15 9 C 15 13 9 13 9 9 Z M 7 17 C 7 12 17 12 17 17',
  mail: 'M 2 5 L 22 5 L 22 19 L 2 19 Z M 2 6 L 12 14 L 22 6',
  location: 'M 12 22 C 10 19 4 13 4 9 C 4 0 20 0 20 9 C 20 13 14 19 12 22 Z M 9 9 C 9 5 15 5 15 9 C 15 13 9 13 9 9 Z',
  phone: 'M 6 2 L 10 7 L 8 10 C 9 13 12 16 15 17 L 18 14 L 22 18 L 20 21 C 14 25 0 11 3 5 Z',
  globe: 'M 2 12 C 2 -1 22 -1 22 12 C 22 25 2 25 2 12 Z M 12 2 C 5 7 5 17 12 22 C 19 17 19 7 12 2 Z M 3 12 L 21 12',
  certificate: 'M 3 3 L 21 3 L 21 17 L 18 17 M 11 17 L 3 17 L 3 3 M 6 7 L 16 7 M 6 10 L 10 10 M 12 13 C 12 9 18 9 18 13 C 18 17 12 17 12 13 Z M 13 16 L 12 22 L 15 20 L 18 22 L 17 16',
  award: 'M 7 3 L 17 3 L 17 9 C 17 16 7 16 7 9 Z M 7 5 L 3 5 C 3 10 4 11 8 11 M 17 5 L 21 5 C 21 10 20 11 16 11 M 12 14 L 12 20 M 7 21 L 17 21',
  languages: 'M 2 6 L 14 6 M 8 3 L 8 6 M 12 6 C 11 12 7 16 2 18 M 4 9 C 5 12 8 15 11 16 M 12 21 L 17 9 L 22 21 M 14 17 L 20 17',
  calendar: 'M 3 5 L 21 5 L 21 21 L 3 21 Z M 7 2 L 7 8 M 17 2 L 17 8 M 3 11 L 21 11 M 7 15 L 10 15 M 14 15 L 17 15',
  research: 'M 8 2 L 16 2 M 9 2 L 9 10 L 3 20 L 4 22 L 20 22 L 21 20 L 15 10 L 15 2 M 7 15 L 17 15',
  publication: 'M 12 6 C 9 3 5 3 2 4 L 2 19 C 5 18 9 18 12 21 C 15 18 19 18 22 19 L 22 4 C 19 3 15 3 12 6 Z M 12 6 L 12 21',
  volunteer: 'M 12 21 C 10 19 2 13 2 8 C 2 2 9 1 12 7 C 15 1 22 2 22 8 C 22 13 15 18 12 21 Z',
  code: 'M 7 6 L 2 12 L 7 18 M 14 3 L 10 21 M 17 6 L 22 12 L 17 18',
  chart: 'M 3 3 L 3 21 L 22 21 M 7 17 L 7 13 M 12 17 L 12 9 M 17 17 L 17 5',
  portfolio: 'M 3 5 L 21 5 L 21 20 L 3 20 Z M 3 17 L 9 11 L 14 16 L 17 13 L 21 17 M 15 9 L 17 9',
}

export const symbols = [
  '•', '→', '★', '◆', '✓', '±', '←', '↑', '↓', '↔', '⇒', '⇔', '↗', '↘', '≤', '≥', '≠', '≈', '×', '÷', '∞', '∑', '√', '∝', '∈', '∩', '∪', '⊕', '∴', '∵',
] as const
