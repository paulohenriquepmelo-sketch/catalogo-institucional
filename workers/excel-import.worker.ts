import readExcelFile from 'read-excel-file/web-worker';
import { validateXlsxArchive } from '../lib/xlsx-safety';

self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    validateXlsxArchive(event.data);
    const sheets = await readExcelFile(event.data);
    if (sheets.length > 30 || sheets.some((s) => s.data.length > 20001))
      throw new Error(
        'Limite: 30 abas e 20.000 linhas de produtos por aba. Divida o arquivo.',
      );
    self.postMessage({ sheets });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error
          ? error.message
          : 'Não foi possível ler este Excel.',
    });
  }
};
