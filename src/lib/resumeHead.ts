/**
 * Where a resume stops being the candidate's own details and starts being our
 * writing.
 *
 * The paywall's build animation prints the head sharp and blurs the body: their
 * name, their number, their address are theirs and there is nothing there to
 * withhold, while the professional summary onwards is the thing being sold. So
 * this split decides what a candidate is allowed to read, which is why it is a
 * plain function with tests rather than a regex inline in a component.
 *
 * The first `##`/`###` section heading, skipping line one, which is the name. A
 * resume with no headings at all falls back to the first blank line, which is
 * the end of the contact block in every layout we have seen; failing that the
 * whole thing stays sharp, because showing someone their own unformatted resume
 * costs nothing.
 */
export function splitAtFirstSection(markdown: string): { head: string; body: string } {
  const lines = (markdown ?? '').split('\n');

  for (let i = 1; i < lines.length; i++) {
    if (/^\s{0,3}#{2,4}\s+\S/.test(lines[i])) {
      return { head: lines.slice(0, i).join('\n'), body: lines.slice(i).join('\n') };
    }
  }

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      return { head: lines.slice(0, i).join('\n'), body: lines.slice(i).join('\n') };
    }
  }

  return { head: markdown ?? '', body: '' };
}
