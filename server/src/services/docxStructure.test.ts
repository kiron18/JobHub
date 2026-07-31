import { describe, it, expect } from 'vitest';
import zlib from 'zlib';
import { extractDocxStructure, describeDocxStructure, DocxStructure } from './docxStructure';

/**
 * Builds a real, mammoth-readable .docx in memory. A stored (uncompressed) zip
 * is enough — mammoth only needs the three parts below.
 */
function buildDocx(bodyXml: string): Buffer {
  const files: Array<[string, string]> = [
    ['[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '</Types>'],
    ['_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
      + '</Relationships>'],
    ['word/document.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
      + `<w:body>${bodyXml}</w:body></w:document>`],
  ];

  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of files) {
    const nameBuf = Buffer.from(name, 'latin1');
    const data = Buffer.from(content, 'utf-8');
    const crc = zlib.crc32 ? zlib.crc32(data) : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 8);              // stored
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const localBlock = Buffer.concat([local, nameBuf, data]);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([central, nameBuf]));

    locals.push(localBlock);
    offset += localBlock.length;
  }

  const centralBlock = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBlock.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralBlock, eocd]);
}

const para = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
const cell = (t: string) => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${para(t)}</w:tc>`;
const row = (cells: string[]) => `<w:tr>${cells.map(cell).join('')}</w:tr>`;
const table = (rows: string[][]) => `<w:tbl>${rows.map(row).join('')}</w:tbl>`;

describe('extractDocxStructure', () => {
  it('preserves tables that extractRawText would flatten into loose lines', async () => {
    // This is the whole point: a work history laid out as a table comes out of
    // extractRawText as disconnected lines, so the model cannot tell it is a
    // table — and table content is routinely dropped by ATS parsers.
    const docx = buildDocx(
      para('JANE SMITH')
      + table([['Role', 'Company', 'Dates'], ['Marketing Coordinator', 'Retail Group', 'Feb 2023 - Present']]),
    );

    const s = await extractDocxStructure(docx);

    expect(s).not.toBeNull();
    expect(s!.html).toContain('<table>');
    expect(s!.html).toContain('Marketing Coordinator');
    expect(s!.tableCount).toBe(1);
    expect(s!.largestTableCells).toBe(6);
  });

  it('counts every table and reports the largest', async () => {
    const docx = buildDocx(
      table([['a', 'b']])
      + para('gap')
      + table([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]),
    );

    const s = await extractDocxStructure(docx);

    expect(s!.tableCount).toBe(2);
    expect(s!.largestTableCells).toBe(9);
  });

  it('reports no tables for a plain document', async () => {
    const s = await extractDocxStructure(buildDocx(para('Just a paragraph of prose.')));
    expect(s!.tableCount).toBe(0);
    expect(s!.largestTableCells).toBe(0);
    expect(s!.html).toContain('Just a paragraph');
  });

  it('returns null rather than throwing on a file that is not a docx', async () => {
    // A bad upload must degrade to the text-only read, never break intake.
    expect(await extractDocxStructure(Buffer.from('not a zip at all', 'latin1'))).toBeNull();
  });
});

describe('describeDocxStructure', () => {
  const base: DocxStructure = { html: '<p>hi</p>', tableCount: 0, largestTableCells: 0, imageCount: 0 };

  it('warns about ATS damage when the resume uses tables', () => {
    const out = describeDocxStructure({ ...base, tableCount: 3, largestTableCells: 9 });
    expect(out).toContain('3 tables');
    expect(out).toContain('9 cells');
    expect(out).toMatch(/mangle or silently drop table cells/);
  });

  it('says nothing about tables when there are none', () => {
    expect(describeDocxStructure(base)).not.toMatch(/contains \d+ table/);
  });

  it('states plainly what the structured view cannot show', () => {
    // Without this the model invents claims about fonts and page count, which is
    // exactly the failure the PDF path was built to avoid.
    const out = describeDocxStructure(base);
    expect(out).toContain('CANNOT see');
    expect(out).toMatch(/fonts, colours, margins/);
    expect(out).toContain('page count');
  });

  it('carries the document structure itself', () => {
    const out = describeDocxStructure({ ...base, html: '<table><tr><td>Coles</td></tr></table>' });
    expect(out).toContain('<table><tr><td>Coles</td></tr></table>');
  });
});
