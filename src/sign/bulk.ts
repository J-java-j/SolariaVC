// Reads a pasted list of people for a bulk send. Each line holds one person, in
// whatever shape a spreadsheet, a CSV or an email client gives:
//   Ada Lovelace, ada@example.com
//   ada@example.com<TAB>Ada Lovelace
//   "Ada Lovelace" <ada@example.com>
// A first line without an address is taken as a header row and skipped.

export const BULK_LIMIT = 50;

export type Person = { name: string; email: string };
export type ParsedList = { people: Person[]; problems: string[] };

const EMAIL = /[^\s<>,;"'()]+@[^\s<>,;"'()]+\.[^\s<>,;"'()]+/;

export function parseList(text: string): ParsedList {
  const people: Person[] = [];
  const problems: string[] = [];
  const seen = new Map<string, number>();
  const lines = text.split(/\r?\n/);
  let first = true;
  lines.forEach((line, i) => {
    const row = i + 1;
    if (!line.trim()) return;
    const isFirst = first;
    first = false;
    const found = EMAIL.exec(line);
    if (!found) {
      if (!isFirst) problems.push(`Line ${row} has no email address.`);
      return;
    }
    const email = found[0].toLowerCase();
    const name = (line.slice(0, found.index) + ' ' + line.slice(found.index + found[0].length))
      .replace(/[<>"'\t,;()]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!name) {
      problems.push(`Line ${row} needs a name next to ${email}.`);
      return;
    }
    const earlier = seen.get(email);
    if (earlier) {
      problems.push(`${email} is on lines ${earlier} and ${row}.`);
      return;
    }
    seen.set(email, row);
    people.push({ name: name.slice(0, 120), email });
  });
  if (people.length > BULK_LIMIT) problems.push(`A list can have ${BULK_LIMIT} people at most. Send the rest in a second batch.`);
  return { people, problems };
}
