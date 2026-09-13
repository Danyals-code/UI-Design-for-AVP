// Structural validation for a fragment of user-authored Swift.
//
// The `custom` panel and the `.custom` modifier let a designer drop raw
// Swift into the tree. That text is interpolated straight into a generated
// file, so a fragment that does not balance takes the whole file down with
// it — and the failure surfaces in Xcode, far from where it was authored.
//
// These are the same two structural properties `src/export/swiftui.test.js`
// pins for generated code, applied to the fragment while the user can still
// see what they typed:
//
//   1. brackets balance, with string literals and comments stripped so a
//      `{` inside the user's own text never counts as code
//   2. every string literal closes on the line it opens — Swift has no
//      multi-line plain string literal, so an unescaped newline inside one
//      splits it across two lines and stops compiling
//
// We deliberately do NOT try to parse Swift. Anything beyond these two
// checks would reject valid code the designer had every right to write,
// which is worse than letting a typo through to the compiler.

const QUOTE = String.fromCharCode(34)
const BACKSLASH = String.fromCharCode(92)

const OPENERS = { '(': ')', '[': ']', '{': '}' }
const CLOSERS = { ')': '(', ']': '[', '}': '{' }

const NAMES = {
  '(': 'parenthesis', ')': 'parenthesis',
  '[': 'bracket',     ']': 'bracket',
  '{': 'brace',       '}': 'brace'
}

// Walk the fragment once, tracking string literals and comments, and report
// the first structural problem found. `inBlockComment` persists across lines;
// `inString` deliberately does not — a literal left open at end-of-line IS
// the error we are looking for.
export function validateSwiftFragment(src) {
  const text = String(src ?? '')
  if (!text.trim()) return { ok: true }

  const stack = []
  let inBlockComment = false
  const lines = text.split('\n')

  for (let ln = 0; ln < lines.length; ln++) {
    const line = lines[ln]
    let inString = false

    for (let i = 0; i < line.length; i++) {
      const c = line[i]

      if (inBlockComment) {
        if (c === '*' && line[i + 1] === '/') { inBlockComment = false; i++ }
        continue
      }

      if (inString) {
        if (c === BACKSLASH) { i++; continue }
        if (c === QUOTE) inString = false
        continue
      }

      if (c === QUOTE) { inString = true; continue }
      if (c === '/' && line[i + 1] === '/') break            // rest of line is a comment
      if (c === '/' && line[i + 1] === '*') { inBlockComment = true; i++; continue }

      if (OPENERS[c]) {
        stack.push({ ch: c, line: ln + 1 })
      } else if (CLOSERS[c]) {
        const top = stack.pop()
        if (!top) {
          return {
            ok: false,
            line: ln + 1,
            message: `Line ${ln + 1}: closing ${NAMES[c]} '${c}' with nothing open before it.`
          }
        }
        if (OPENERS[top.ch] !== c) {
          return {
            ok: false,
            line: ln + 1,
            message: `Line ${ln + 1}: '${c}' closes a ${NAMES[top.ch]} opened on line ${top.line}.`
          }
        }
      }
    }

    if (inString) {
      return {
        ok: false,
        line: ln + 1,
        message: `Line ${ln + 1}: a string literal opens but never closes. Swift string literals cannot span lines.`
      }
    }
  }

  if (inBlockComment) {
    return { ok: false, message: 'A block comment opens with /* but never closes.' }
  }

  if (stack.length) {
    const first = stack[0]
    const plural = stack.length === 1 ? '' : `s (${stack.length} total)`
    return {
      ok: false,
      line: first.line,
      message: `Unclosed ${NAMES[first.ch]}${plural} — '${first.ch}' on line ${first.line} is never closed.`
    }
  }

  return { ok: true }
}
