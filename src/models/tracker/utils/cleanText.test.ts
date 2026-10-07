import { expect, test } from 'vitest'
import { cleanText } from './cleanText'

test('trims the value', () => {
  expect(cleanText('  hello  ')).toBe('hello')
})

test.each(['', '   ', '\t\n'])('returns null for %j', (value) => {
  expect(cleanText(value)).toBeNull()
})
