/**
 * Diagrid DFD (Data Flow Diagram) Helper Utilities
 * Standardized parsing and formatting for Gane & Sarson and Yourdon DFD notations.
 */

export interface DfdStoreParts {
  id: string;
  name: string;
}

export interface DfdProcessParts {
  id: string;
  name: string;
}

/**
 * Parses a DFD Data Store label into an ID component (e.g., 'D1', 'D27')
 * and an entity/store name, stripping redundant notation prefixes like '[D]'.
 */
export const parseDfdStoreLabel = (label: string): DfdStoreParts => {
  if (!label) return { id: 'D', name: '' };

  // 1. Strip redundant leading [D] or [d]
  const cleaned = label.trim().replace(/^\[d\]\s*/i, '').trim();

  // 2. Match standard DFD IDs: D1, D27, M1, DS1 followed by optional separator or space
  const idMatch = cleaned.match(/^([D|M|DS]\d+)\s*[:|-]?\s*(.*)$/i);
  if (idMatch) {
    const id = idMatch[1].toUpperCase();
    const name = idMatch[2].trim() || id;
    return { id, name };
  }

  // 3. Match alphanumeric ID pattern (e.g. S1, DB1)
  const genericIdMatch = cleaned.match(/^([a-zA-Z]+\d+)\s*[:|-]?\s*(.*)$/);
  if (genericIdMatch) {
    return {
      id: genericIdMatch[1].toUpperCase(),
      name: genericIdMatch[2].trim() || genericIdMatch[1],
    };
  }

  // 4. Fallback: single 'D' identifier and cleaned name
  return { id: 'D', name: cleaned };
};

/**
 * Parses a DFD Process label into a process number (e.g. '1.0', '3.1')
 * and a verb-phrase title.
 */
export const parseDfdProcessLabel = (label: string): DfdProcessParts => {
  if (!label) return { id: '1.0', name: '' };

  const trimmed = label.trim();

  // Match numbered prefixes: '1.0', '2.1.3', '3'
  const match = trimmed.match(/^(\d+(?:\.\d+)*)\s*[:|-]?\s*(.*)$/);
  if (match) {
    return {
      id: match[1],
      name: match[2].trim() || trimmed,
    };
  }

  // Fallback: split by first space if starts with number
  const splitIdx = trimmed.indexOf(' ');
  if (splitIdx !== -1 && /^\d/.test(trimmed)) {
    return {
      id: trimmed.substring(0, splitIdx),
      name: trimmed.substring(splitIdx + 1).trim(),
    };
  }

  return { id: '1.0', name: trimmed };
};
