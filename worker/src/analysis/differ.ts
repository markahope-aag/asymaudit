import { logger } from '../utils/logger';

export interface DiffChange {
  key: string;
  description: string;
}

export interface DiffChangeAdded extends DiffChange {
  value: any;
}

export interface DiffChangeRemoved extends DiffChange {
  value: any;
}

export interface DiffChangeModified extends DiffChange {
  previous: any;
  current: any;
  direction: 'improved' | 'degraded' | 'neutral';
}

export interface AuditDiff {
  changes: {
    added: DiffChangeAdded[];
    removed: DiffChangeRemoved[];
    changed: DiffChangeModified[];
  };
  severity: 'info' | 'warning' | 'critical';
  summary?: string;
}

export interface MetricDefinition {
  higherIsBetter: boolean;
  criticalThreshold?: number;
  warningThreshold?: number;
  displayName?: string;
  unit?: string;
}

export function computeDiff(
  currentData: Record<string, any>,
  previousData: Record<string, any>,
  metricDefinitions: Record<string, MetricDefinition> = {}
): AuditDiff {
  const diffLogger = logger.child({ module: 'differ' });
  diffLogger.debug('Computing audit diff');

  const diff: AuditDiff = {
    changes: { added: [], removed: [], changed: [] },
    severity: 'info',
  };

  try {
    // Flatten both objects for comparison
    const currentFlat = flattenObject(currentData);
    const previousFlat = flattenObject(previousData);

    const allKeys = new Set([...Object.keys(currentFlat), ...Object.keys(previousFlat)]);
    let maxSeverity: 'info' | 'warning' | 'critical' = 'info';

    for (const key of allKeys) {
      const definition = metricDefinitions[key];
      
      if (!(key in previousFlat)) {
        // New value added
        diff.changes.added.push({
          key,
          value: currentFlat[key],
          description: generateAddedDescription(key, currentFlat[key], definition),
        });
        
      } else if (!(key in currentFlat)) {
        // Value removed
        diff.changes.removed.push({
          key,
          value: previousFlat[key],
          description: generateRemovedDescription(key, previousFlat[key], definition),
        });
        
      } else if (!deepEqual(currentFlat[key], previousFlat[key])) {
        // Value changed
        const direction = determineDirection(
          previousFlat[key],
          currentFlat[key],
          definition
        );
        
        const changeSeverity = assessChangeSeverity(
          previousFlat[key],
          currentFlat[key],
          definition,
          direction
        );
        
        if (changeSeverity === 'critical') {
          maxSeverity = 'critical';
        } else if (changeSeverity === 'warning' && maxSeverity !== 'critical') {
          maxSeverity = 'warning';
        }

        diff.changes.changed.push({
          key,
          previous: previousFlat[key],
          current: currentFlat[key],
          direction,
          description: generateChangedDescription(
            key,
            previousFlat[key],
            currentFlat[key],
            direction,
            definition
          ),
        });
      }
    }

    diff.severity = maxSeverity;
    diff.summary = generateDiffSummary(diff);

    diffLogger.debug({
      addedCount: diff.changes.added.length,
      removedCount: diff.changes.removed.length,
      changedCount: diff.changes.changed.length,
      severity: diff.severity,
    }, 'Diff computation completed');

    return diff;

  } catch (error) {
    diffLogger.error({ error }, 'Failed to compute diff');
    return {
      changes: { added: [], removed: [], changed: [] },
      severity: 'info',
      summary: 'Unable to compute changes due to data comparison error',
    };
  }
}

function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Recursively flatten nested objects
      Object.assign(result, flattenObject(value, newKey));
    } else {
      // Store primitive values, arrays, and dates as-is
      result[newKey] = value;
    }
  }
  
  return result;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  if (!a || !b || (typeof a !== 'object' && typeof b !== 'object')) {
    return a === b;
  }
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

function determineDirection(
  previous: any,
  current: any,
  definition?: MetricDefinition
): 'improved' | 'degraded' | 'neutral' {
  if (!definition) return 'neutral';
  
  // Only determine direction for numeric values
  if (typeof previous !== 'number' || typeof current !== 'number') {
    return 'neutral';
  }
  
  const increased = current > previous;
  
  // If higher is better and value increased, or lower is better and value decreased
  if ((definition.higherIsBetter && increased) || (!definition.higherIsBetter && !increased)) {
    return 'improved';
  } else if (current !== previous) {
    return 'degraded';
  }
  
  return 'neutral';
}

function assessChangeSeverity(
  previous: any,
  current: any,
  definition?: MetricDefinition,
  direction?: 'improved' | 'degraded' | 'neutral'
): 'info' | 'warning' | 'critical' {
  if (!definition || direction === 'improved' || direction === 'neutral') {
    return 'info';
  }
  
  if (typeof previous !== 'number' || typeof current !== 'number') {
    return 'info';
  }
  
  const change = Math.abs(current - previous);
  
  if (definition.criticalThreshold !== undefined && change >= definition.criticalThreshold) {
    return 'critical';
  }
  
  if (definition.warningThreshold !== undefined && change >= definition.warningThreshold) {
    return 'warning';
  }
  
  return 'info';
}

function generateAddedDescription(key: string, value: any, definition?: MetricDefinition): string {
  const displayName = definition?.displayName || humanizeKey(key);
  const formattedValue = formatValue(value, definition);
  
  return `New metric: ${displayName} = ${formattedValue}`;
}

function generateRemovedDescription(key: string, value: any, definition?: MetricDefinition): string {
  const displayName = definition?.displayName || humanizeKey(key);
  const formattedValue = formatValue(value, definition);
  
  return `Removed metric: ${displayName} was ${formattedValue}`;
}

function generateChangedDescription(
  key: string,
  previous: any,
  current: any,
  direction: 'improved' | 'degraded' | 'neutral',
  definition?: MetricDefinition
): string {
  const displayName = definition?.displayName || humanizeKey(key);
  const formattedPrevious = formatValue(previous, definition);
  const formattedCurrent = formatValue(current, definition);
  
  const directionText = direction === 'improved' ? '↗️' : direction === 'degraded' ? '↘️' : '↔️';
  
  if (typeof previous === 'number' && typeof current === 'number') {
    const change = current - previous;
    const changeText = change > 0 ? `+${change}` : change.toString();
    return `${displayName}: ${formattedPrevious} → ${formattedCurrent} (${changeText}) ${directionText}`;
  }
  
  return `${displayName}: ${formattedPrevious} → ${formattedCurrent} ${directionText}`;
}

function formatValue(value: any, definition?: MetricDefinition): string {
  if (typeof value === 'number') {
    const formatted = value % 1 === 0 ? value.toString() : value.toFixed(2);
    return definition?.unit ? `${formatted}${definition.unit}` : formatted;
  }
  
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  
  if (typeof value === 'object' && value !== null) {
    return '[Object]';
  }
  
  return String(value);
}

function humanizeKey(key: string): string {
  return key
    .split('.')
    .pop()! // Get the last part after dots
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
}

function generateDiffSummary(diff: AuditDiff): string {
  const { added, removed, changed } = diff.changes;
  const totalChanges = added.length + removed.length + changed.length;
  
  if (totalChanges === 0) {
    return 'No changes detected since last audit';
  }
  
  const parts: string[] = [];
  
  if (added.length > 0) {
    parts.push(`${added.length} new metric${added.length > 1 ? 's' : ''}`);
  }
  
  if (removed.length > 0) {
    parts.push(`${removed.length} removed metric${removed.length > 1 ? 's' : ''}`);
  }
  
  if (changed.length > 0) {
    const improved = changed.filter(c => c.direction === 'improved').length;
    const degraded = changed.filter(c => c.direction === 'degraded').length;
    const neutral = changed.filter(c => c.direction === 'neutral').length;
    
    const changeParts: string[] = [];
    if (improved > 0) changeParts.push(`${improved} improved`);
    if (degraded > 0) changeParts.push(`${degraded} degraded`);
    if (neutral > 0) changeParts.push(`${neutral} changed`);
    
    parts.push(`${changed.length} metric${changed.length > 1 ? 's' : ''} changed (${changeParts.join(', ')})`);
  }
  
  return `${totalChanges} total change${totalChanges > 1 ? 's' : ''}: ${parts.join(', ')}`;
}