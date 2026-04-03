/**
 * templateTokens.js
 * Utility for parsing and validating Jinja2 style {{tokens}} from HTML strings.
 */

/**
 * Extract all unique {{token}} keys from an HTML string.
 * Supports spaces inside the braces, e.g., {{  name  }} -> names
 *
 * @param {string} htmlString - The raw HTML string
 * @returns {string[]} Array of unique token keys
 */
export function extractTokens(htmlString) {
  if (!htmlString) return []

  // Regex to match {{ anything }}
  const regex = /\{\{\s*([a-zA-Z0-9_\-]+)\s*\}\}/g
  const tokens = new Set()
  
  let match
  while ((match = regex.exec(htmlString)) !== null) {
    // match[1] is the first capture group (the token name without braces)
    tokens.add(match[1])
  }

  return Array.from(tokens)
}

/**
 * Check if the HTML string is missing any required token keys.
 *
 * @param {string} htmlString - The raw HTML string
 * @param {string[]} requiredKeys - Array of keys that MUST be present, e.g. ['name']
 * @returns {string[]} Array of required keys that are missing from the HTML
 */
export function validateTokens(htmlString, requiredKeys = []) {
  if (!requiredKeys || requiredKeys.length === 0) return []
  
  const foundTokens = new Set(extractTokens(htmlString))
  
  const missing = []
  for (const key of requiredKeys) {
    if (!foundTokens.has(key)) {
      missing.push(key)
    }
  }
  
  return missing
}
