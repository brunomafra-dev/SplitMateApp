export type SecurityIssue = {
  type: string
  table?: string
  message: string
}

export type SecurityAuditReport = {
  safe: boolean
  issues: SecurityIssue[]
}

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: any }>
}

type AuditClient = RpcClient & {
  from?: (table: string) => any
}

const CRITICAL_TABLES = [
  'groups',
  'participants',
  'transactions',
  'payments',
  'profiles',
  'invite_tokens',
]

const REQUIRED_POLICY_ACTIONS = ['select', 'insert', 'update']
const REQUIRED_TRANSACTION_COLUMNS = ['id', 'group_id', 'payer_id', 'value', 'splits']
const NON_BLOCKING_ISSUE_TYPES = new Set([
  'AUDIT_QUERY_FAILED',
  'TABLE_CHECK_UNAVAILABLE',
  'SCHEMA_AUDIT_UNAVAILABLE',
])

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') return value
  const normalized = String(value || '').trim().toLowerCase()
  return normalized === 't' || normalized === 'true' || normalized === '1' || normalized === 'yes'
}

function normalizeRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[]

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data)
      return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : []
    } catch {
      return []
    }
  }

  if (!data || typeof data !== 'object') return []

  const payload = data as Record<string, unknown>
  const candidateKeys = ['rows', 'result', 'data']
  for (const key of candidateKeys) {
    const candidate = payload[key]
    if (Array.isArray(candidate)) return candidate as Record<string, unknown>[]
  }

  return []
}

function isTableMissingError(error: any) {
  const code = String(error?.code || '').trim().toUpperCase()
  const message = String(error?.message || '').toLowerCase()
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  )
}

function isMissingColumnError(error: any) {
  const code = String(error?.code || '').trim().toUpperCase()
  const message = String(error?.message || '').toLowerCase()
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    (message.includes('could not find the') && message.includes('column')) ||
    (message.includes('column') && message.includes('does not exist'))
  )
}

async function runSqlViaRpc(supabase: RpcClient, sql: string) {
  const rpcCandidates: Array<{ name: string; arg: string }> = [
    { name: 'run_sql', arg: 'query' },
    { name: 'run_sql', arg: 'sql' },
    { name: 'exec_sql', arg: 'query' },
    { name: 'exec_sql', arg: 'sql' },
    { name: 'execute_sql', arg: 'query' },
    { name: 'execute_sql', arg: 'sql' },
    { name: 'query_sql', arg: 'query' },
    { name: 'query_sql', arg: 'sql' },
  ]

  let lastError: any = null

  for (const candidate of rpcCandidates) {
    const { data, error } = await supabase.rpc(candidate.name, { [candidate.arg]: sql })
    if (error) {
      lastError = error
      continue
    }

    return {
      rows: normalizeRows(data),
      error: null,
      rpcName: candidate.name,
    }
  }

  return {
    rows: [] as Record<string, unknown>[],
    error: lastError,
    rpcName: null,
  }
}

function inferPolicyActions(row: Record<string, unknown>) {
  const cmd = String(row.cmd || '').trim().toLowerCase()
  const policyName = String(row.policyname || '').trim().toLowerCase()

  if (cmd) {
    if (cmd === '*' || cmd === 'all') return new Set(['select', 'insert', 'update'])
    return new Set([cmd])
  }

  const actions = new Set<string>()
  if (policyName.includes('select')) actions.add('select')
  if (policyName.includes('insert')) actions.add('insert')
  if (policyName.includes('update')) actions.add('update')
  if (policyName.includes('all')) {
    actions.add('select')
    actions.add('insert')
    actions.add('update')
  }
  return actions
}

function hasExposedServiceRoleInClient(supabase: any) {
  if (typeof window === 'undefined') return false

  const envExposed =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) ||
    Boolean(process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY) ||
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  const keyFromClient = String(
    supabase?.supabaseKey ||
    supabase?.rest?.headers?.apikey ||
    supabase?.auth?.headers?.apikey ||
    ''
  ).toLowerCase()

  return envExposed || keyFromClient.includes('service_role')
}

async function detectCriticalTableExistenceViaRest(supabase: AuditClient, tables: string[]) {
  const result = new Map<string, 'exists' | 'missing' | 'unknown'>()

  if (!supabase.from) {
    for (const table of tables) result.set(table, 'unknown')
    return result
  }

  for (const table of tables) {
    const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' })
    if (!error) {
      result.set(table, 'exists')
      continue
    }
    if (isTableMissingError(error)) {
      result.set(table, 'missing')
      continue
    }
    result.set(table, 'unknown')
  }

  return result
}

async function detectMissingColumnsViaRest(supabase: AuditClient, table: string, requiredColumns: string[]) {
  if (!supabase.from) return { missingColumns: [] as string[], unavailable: true, tableMissing: false }

  const missingColumns: string[] = []
  let unknownFailures = 0

  for (const column of requiredColumns) {
    const { error } = await supabase.from(table).select(column, { head: true, count: 'exact' })
    if (!error) continue
    if (isTableMissingError(error)) return { missingColumns, unavailable: false, tableMissing: true }
    if (isMissingColumnError(error)) {
      missingColumns.push(column)
      continue
    }
    unknownFailures += 1
  }

  if (unknownFailures > 0 && missingColumns.length === 0) {
    return { missingColumns, unavailable: true, tableMissing: false }
  }

  return { missingColumns, unavailable: false, tableMissing: false }
}

export async function auditDatabaseSecurity(supabase: AuditClient): Promise<SecurityAuditReport> {
  const issues: SecurityIssue[] = []

  const tablesQuery = `
    select tablename, rowsecurity
    from pg_tables
    where schemaname = 'public'
  `
  const tablesResult = await runSqlViaRpc(supabase, tablesQuery)

  const rlsByTable = new Map<string, boolean>()
  const canAuditTablesWithRls = !tablesResult.error

  if (canAuditTablesWithRls) {
    for (const row of tablesResult.rows) {
      const table = String(row.tablename || '').trim()
      if (!table) continue
      rlsByTable.set(table, parseBoolean(row.rowsecurity))
    }

    for (const table of CRITICAL_TABLES) {
      if (!rlsByTable.has(table)) {
        issues.push({
          type: 'MISSING_TABLE',
          table,
          message: 'Tabela critica nao encontrada no schema public.',
        })
        continue
      }

      const rlsEnabled = Boolean(rlsByTable.get(table))
      if (!rlsEnabled) {
        issues.push({
          type: 'RLS_DISABLED',
          table,
          message: 'Row Level Security desativado nesta tabela',
        })
        issues.push({
          type: 'TABLE_EXPOSED',
          table,
          message: 'Tabela acessivel publicamente',
        })
      }
    }
  } else {
    issues.push({
      type: 'AUDIT_QUERY_FAILED',
      message: 'Nao foi possivel listar tabelas/public e status de RLS via RPC.',
    })

    const fallbackTableExistence = await detectCriticalTableExistenceViaRest(supabase, CRITICAL_TABLES)
    for (const table of CRITICAL_TABLES) {
      const state = fallbackTableExistence.get(table) || 'unknown'
      if (state === 'missing') {
        issues.push({
          type: 'MISSING_TABLE',
          table,
          message: 'Tabela critica nao encontrada no schema public.',
        })
      } else if (state === 'unknown') {
        issues.push({
          type: 'TABLE_CHECK_UNAVAILABLE',
          table,
          message: 'Nao foi possivel validar existencia/permissao desta tabela no contexto atual.',
        })
      }
    }
  }

  const policiesQuery = `
    select tablename, policyname, cmd
    from pg_policies
    where schemaname = 'public'
  `
  const policiesResult = await runSqlViaRpc(supabase, policiesQuery)
  const canAuditPolicies = !policiesResult.error

  if (canAuditPolicies) {
    const actionsByTable = new Map<string, Set<string>>()
    for (const row of policiesResult.rows) {
      const table = String(row.tablename || '').trim()
      if (!table) continue
      const set = actionsByTable.get(table) || new Set<string>()
      const inferred = inferPolicyActions(row)
      for (const action of inferred) set.add(action)
      actionsByTable.set(table, set)
    }

    for (const table of CRITICAL_TABLES) {
      const actions = actionsByTable.get(table) || new Set<string>()
      const hasAllRequired = REQUIRED_POLICY_ACTIONS.every((action) => actions.has(action))
      if (!hasAllRequired) {
        issues.push({
          type: 'MISSING_POLICY',
          table,
          message: 'Tabela sem todas as policies necessarias (SELECT, INSERT, UPDATE).',
        })
      }
    }
  } else {
    issues.push({
      type: 'AUDIT_QUERY_FAILED',
      message: 'Nao foi possivel listar policies do schema public via RPC.',
    })
  }

  const transactionColumnsQuery = `
    select column_name
    from information_schema.columns
    where table_name = 'transactions'
      and table_schema = 'public'
  `
  const columnsResult = await runSqlViaRpc(supabase, transactionColumnsQuery)
  const canAuditSchemaByRpc = !columnsResult.error

  if (canAuditSchemaByRpc) {
    const existingColumns = new Set(
      columnsResult.rows
        .map((row) => String(row.column_name || '').trim())
        .filter(Boolean)
    )
    const missingColumns = REQUIRED_TRANSACTION_COLUMNS.filter((column) => !existingColumns.has(column))

    if (missingColumns.length > 0) {
      issues.push({
        type: 'SCHEMA_INCONSISTENT',
        table: 'transactions',
        message: `Schema da tabela transactions esta incompleto (faltando: ${missingColumns.join(', ')}).`,
      })
    }
  } else {
    issues.push({
      type: 'AUDIT_QUERY_FAILED',
      table: 'transactions',
      message: 'Nao foi possivel validar schema da tabela transactions via RPC.',
    })

    const schemaFallback = await detectMissingColumnsViaRest(supabase, 'transactions', REQUIRED_TRANSACTION_COLUMNS)
    if (schemaFallback.tableMissing) {
      issues.push({
        type: 'MISSING_TABLE',
        table: 'transactions',
        message: 'Tabela critica nao encontrada no schema public.',
      })
    } else if (schemaFallback.missingColumns.length > 0) {
      issues.push({
        type: 'SCHEMA_INCONSISTENT',
        table: 'transactions',
        message: `Schema da tabela transactions esta incompleto (faltando: ${schemaFallback.missingColumns.join(', ')}).`,
      })
    } else if (schemaFallback.unavailable) {
      issues.push({
        type: 'SCHEMA_AUDIT_UNAVAILABLE',
        table: 'transactions',
        message: 'Nao foi possivel validar colunas da tabela transactions no contexto atual.',
      })
    }
  }

  if (hasExposedServiceRoleInClient(supabase)) {
    issues.push({
      type: 'SERVICE_ROLE_EXPOSED',
      message: 'Service role key nao deve estar disponivel no frontend',
    })
  }

  const blockingIssues = issues.filter((issue) => !NON_BLOCKING_ISSUE_TYPES.has(issue.type))

  if (issues.length === 0) {
    return {
      safe: true,
      issues: [],
    }
  }

  return {
    safe: blockingIssues.length === 0,
    issues,
  }
}
