import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Conference .sty/.cls files that aren't in standard TeX Live distributions.
 * If the user's LaTeX references one that isn't installed, we substitute an
 * approximately-equivalent standard preamble so the paper still compiles.
 * The user's stored content is never modified — only the string written to
 * the pdflatex workdir is rewritten.
 */
const SHIMS: Array<{ pattern: RegExp; styBase: string; replacement: string }> = [
  {
    // \usepackage[preprint]{neurips_2024} or \usepackage{neurips_2024}
    pattern: /\\usepackage(?:\[[^\]]*\])?\{neurips_\d{4}\}/g,
    styBase: 'neurips_2024',
    replacement: `% [shim] neurips_YYYY.sty not installed — using standard-article preamble
\\usepackage[margin=1in]{geometry}
\\usepackage{times}`,
  },
  {
    pattern: /\\usepackage(?:\[[^\]]*\])?\{icml\d{4}\}/g,
    styBase: 'icml2024',
    replacement: `% [shim] icml_YYYY.sty not installed — using standard-article preamble
\\usepackage[margin=1in]{geometry}
\\usepackage{times}
% ICML helper macros (minimal stubs so template bodies compile)
\\newcommand{\\icmltitlerunning}[1]{}
\\newcommand{\\icmltitle}[1]{\\title{#1}}
\\newenvironment{icmlauthorlist}{}{}
\\newcommand{\\icmlauthor}[2]{\\author{#1}}
\\newcommand{\\icmlaffiliation}[2]{}
\\newcommand{\\icmlcorrespondingauthor}[2]{}
\\newcommand{\\icmlkeywords}[1]{}`,
  },
]

async function hasOnTexPath(basename: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`kpsewhich ${basename}.sty ${basename}.cls`, { timeout: 3000 })
    return stdout.trim().length > 0
  } catch {
    return false
  }
}

/**
 * Rewrite a LaTeX source string so that references to conference .sty files
 * which aren't installed locally are replaced with a standard-package preamble.
 */
export async function shimMissingStyles(source: string): Promise<{
  content: string
  shimmed: string[]
}> {
  const shimmed: string[] = []
  let out = source
  for (const { pattern, styBase, replacement } of SHIMS) {
    if (!pattern.test(out)) continue
    if (await hasOnTexPath(styBase)) continue
    pattern.lastIndex = 0
    out = out.replace(pattern, replacement)
    shimmed.push(styBase)
  }
  return { content: out, shimmed }
}
