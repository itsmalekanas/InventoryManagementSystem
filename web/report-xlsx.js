'use strict';

function reportWorkbook(sheets, rtl) {
  const schema = 'http://schemas.openxmlformats.org';
  const main = schema + '/spreadsheetml/2006/main';
  const relationships = schema + '/officeDocument/2006/relationships';
  const packageSchema = schema + '/package/2006';
  const xml = value => value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const rel = (id, type, target) => `<Relationship Id="rId${id}" Type="${relationships}/${type}" Target="${target}"/>`;
  const rels = contents => `<Relationships xmlns="${packageSchema}/relationships">${contents}</Relationships>`;
  const contentType = (path, type) => `<Override PartName="/xl/${path}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.${type}+xml"/>`;
  const numbered = sheets.map((sheet, index) => ({ ...sheet, id: index + 1, path: `worksheets/sheet${index + 1}` }));
  const files = {
    '[Content_Types].xml': `<Types xmlns="${packageSchema}/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${contentType('workbook', 'sheet.main')}${contentType('styles', 'styles')}${numbered.map(s => contentType(s.path, 'worksheet')).join('')}</Types>`,
    '_rels/.rels': rels(rel(1, 'officeDocument', 'xl/workbook.xml')),
    'xl/workbook.xml': `<workbook xmlns="${main}" xmlns:r="${relationships}"><bookViews><workbookView/></bookViews><sheets>${numbered.map(s => `<sheet name="${xml(s.name)}" sheetId="${s.id}" r:id="rId${s.id}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': rels(numbered.map(s => rel(s.id, 'worksheet', s.path + '.xml')).join('') + rel(numbered.length + 1, 'styles', 'styles.xml')),
    'xl/styles.xml': `<styleSheet xmlns="${main}">
      <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
      <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
      <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`,
  };
  for (const sheet of numbered) {
    const column = index => String.fromCharCode(65 + index);
    const data = sheet.rows.map((row, rowIndex) => {
      const cells = row.map((value, index) => {
        const ref = column(index) + (rowIndex + 1);
        if (typeof value === 'number') return `<c r="${ref}" s="2"><v>${value}</v></c>`;
        if (value === '') return '';
        return `<c r="${ref}" s="${rowIndex === 0 ? 1 : 0}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    }).join('');
    const last = column(sheet.rows[0].length - 1) + sheet.rows.length;
    const cols = sheet.rows[0].map((title, index) => {
      const width = Math.max(index === 0 ? 30 : 16, title.length + 5);
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    }).join('');
    files[`xl/${sheet.path}.xml`] = `<worksheet xmlns="${main}"><sheetViews><sheetView rightToLeft="${rtl ? 1 : 0}" workbookViewId="0"/></sheetViews><cols>${cols}</cols><sheetData>${data}</sheetData>${sheet.filter ? `<autoFilter ref="A1:${last}"/>` : ''}</worksheet>`;
  }
  return new Blob(reportZip(files), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// Open XML uses a ZIP container. Store the UTF-8 parts without compression.
function reportZip(files) {
  const encoder = new TextEncoder();
  const entries = [];
  const directory = [];
  let offset = 0;
  let directorySize = 0;
  for (const [path, xml] of Object.entries(files)) {
    const name = encoder.encode(path);
    const data = encoder.encode('<?xml version="1.0" encoding="UTF-8"?>' + xml);
    let crc = -1;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(12, 33, true); // 1980-01-01 in DOS date format
    local.setUint32(14, ~crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    new Uint8Array(central.buffer).set(new Uint8Array(local.buffer, 4), 6);
    central.setUint32(42, offset, true);
    entries.push(local.buffer, name, data);
    directory.push(central.buffer, name);
    offset += local.byteLength + name.length + data.length;
    directorySize += central.byteLength + name.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, directory.length / 2, true);
  end.setUint16(10, directory.length / 2, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return [...entries, ...directory, end.buffer];
}
