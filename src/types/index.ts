export interface User {
  id: string
  name: string
  email?: string
  avatar: string
  createdAt: string
}

export interface Group {
  id: string
  name: string
  category: string
  avatar: string
  participants: string[]
  totalSpent: number
  balance: number
  transactions: Transaction[]
  createdAt: string
}

export interface Transaction {
  id: string
  groupId: string
  value: number
  description: string
  payer: string
  participants: string[]
  date: string
  splits?: { [userId: string]: number }
}
