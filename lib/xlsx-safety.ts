// Inspect ZIP size declarations before a worker decompresses the workbook.
export function validateXlsxArchive(data: ArrayBuffer) {
  if (data.byteLength > 20 * 1024 * 1024 || data.byteLength < 22)
    throw new Error('Use um arquivo .xlsx de até 20 MB.');
  const view = new DataView(data);
  let end = -1;
  for (
    let i = data.byteLength - 22;
    i >= Math.max(0, data.byteLength - 65557);
    i--
  )
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0)
    throw new Error(
      'Arquivo Excel inválido. Salve novamente no formato .xlsx.',
    );
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  if (
    count > 2000 ||
    view.getUint16(end + 4, true) !== 0 ||
    view.getUint16(end + 6, true) !== 0
  )
    throw new Error('Planilha muito complexa. Divida em arquivos menores.');
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50)
      throw new Error('Arquivo Excel inválido.');
    const size = view.getUint32(offset + 24, true);
    total += size;
    if (
      size > 40 * 1024 * 1024 ||
      total > 80 * 1024 * 1024 ||
      view.getUint16(offset + 8, true) & 1
    )
      throw new Error(
        'Planilha protegida ou grande demais após descompactação. Salve uma cópia menor, sem senha.',
      );
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
}
