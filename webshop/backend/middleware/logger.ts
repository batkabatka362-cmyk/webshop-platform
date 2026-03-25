/**
 * WEBSHOP — Centralized Structured Logger
 *
 * Contract:
 * - All logs are JSON (machine-readable)
 * - All logs include: timestamp, level, service, event, and context
 * - Levels: INFO, WARN, ERROR
 * - No event should be logged without a service and event name
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR'

export interface LogEntry {
  timestamp: string
  level:     LogLevel
  service:   string
  event:     string
  data?:     Record<string, any>
  error?:    string
  stack?:    string
}

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry)
  if (entry.level === 'ERROR') {
    process.stderr.write(line + '\n')
  } else {
    process.stdout.write(line + '\n')
  }
}

function buildEntry(
  level:   LogLevel,
  service: string,
  event:   string,
  data?:   Record<string, any>,
  err?:    unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    event,
    data,
  }
  if (err instanceof Error) {
    entry.error = err.message
    entry.stack = err.stack
  } else if (typeof err === 'string') {
    entry.error = err
  }
  return entry
}

export const Logger = {
  info(service: string, event: string, data?: Record<string, any>) {
    emit(buildEntry('INFO', service, event, data))
  },

  warn(service: string, event: string, data?: Record<string, any>, err?: unknown) {
    emit(buildEntry('WARN', service, event, data, err))
  },

  error(service: string, event: string, data?: Record<string, any>, err?: unknown) {
    emit(buildEntry('ERROR', service, event, data, err))
  },
}
