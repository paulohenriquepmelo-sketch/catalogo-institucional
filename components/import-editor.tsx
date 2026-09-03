'use client';
import { useEffect, useRef, useState } from 'react';
import {
  FileSpreadsheet,
  Images,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Panel, Toggle } from './editor-controls';
import { api } from '@/lib/client-api';
import {
  optimizeImage,
  optimizationSummary,
  type OptimizedImage,
} from '@/lib/optimize-image';
import type { Product } from '@/lib/catalog-data';
import { normalize, type CatalogConfig } from '@/lib/catalog-config';
import {
  autoMap,
  columnTitle,
  importColumns,
  mappingError,
  previewProducts,
  previewImages,
  type ExcelSheet,
  type ColumnMapping,
  type ProductPreview,
  type ImagePreview,
  type ImportOptions,
  type ImportResult,
} from '@/lib/product-import';

type Snapshot = { products: Product[]; config: CatalogConfig };
type Report = { key: string; code: string; status: string; message: string };
const labels: Record<string, string> = {
  new: 'Novo',
  update: 'Atualizar',
  skip: 'Ignorar',
  error: 'Revisar',
  link: 'Vincular',
  replace: 'Substituir',
  created: 'Criado',
  updated: 'Atualizado',
  skipped: 'Mantido',
  linked: 'Vinculado',
};
const messageOf = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Não foi possível concluir a operação.';

export function ImportEditor({
  dirty,
  onBusy,
  onRefresh,
}: {
  dirty: boolean;
  onBusy: (busy: boolean) => void;
  onRefresh: () => Promise<Snapshot>;
}) {
  const [mode, setMode] = useState<'excel' | 'images'>('excel');
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<ExcelSheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [header, setHeader] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [options, setOptions] = useState<ImportOptions>({
    mode: 'upsert',
    publishNew: false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [replaceImages, setReplaceImages] = useState(false);
  const [products, setProducts] = useState<ProductPreview[] | null>(null);
  const [images, setImages] = useState<ImagePreview[] | null>(null);
  const [relationships, setRelationships] = useState({
    brands: 0,
    categories: 0,
  });
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [progress, setProgress] = useState({ value: 0, total: 0 });
  const [report, setReport] = useState<Report[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(0);
  const cancel = useRef(false);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);
  const sheet = sheets[sheetIndex];
  const headers = sheet?.data[header] ?? [];
  const readyProducts = (products ?? []).filter(
    (row) => row.action === 'new' || row.action === 'update',
  );
  const readyImages = (images ?? []).filter(
    (row) => row.action === 'link' || row.action === 'replace',
  );
  const ready = mode === 'excel' ? readyProducts.length : readyImages.length;
  const reviewed = mode === 'excel' ? products !== null : images !== null;
  const previewRows =
    mode === 'excel'
      ? (products ?? []).map((row) => ({
          key: String(row.row),
          reference: `Linha ${row.row}`,
          code: row.values.code ?? '',
          name: row.name || row.values.name || '—',
          action: row.action,
          note: row.note,
          segment: row.segment,
        }))
      : (images ?? []).map((row, i) => ({
          key: String(i),
          reference: row.file.name,
          code: row.product?.code ?? '',
          name: row.product?.name ?? 'Sem produto',
          action: row.action,
          note: row.note,
          segment: '',
        }));
  const reportMap = new Map(report.map((row) => [row.key, row]));
  const errors = previewRows.filter((row) => row.action === 'error').length;
  const skipped = previewRows.filter((row) => row.action === 'skip').length;
  const successful = report.filter((row) =>
    ['created', 'updated', 'linked'].includes(row.status),
  ).length;
  function resetPreview() {
    setProducts(null);
    setImages(null);
    setReport([]);
    setDone(false);
    setError('');
    setNotice('');
    setPage(0);
  }
  function lock(value: boolean) {
    setBusy(value);
    onBusy(value);
  }
  async function read(file?: File) {
    if (!file || busy || dirty) return;
    resetPreview();
    setSheets([]);
    setFileName('');
    if (!/\.xlsx$/i.test(file.name) || file.size > 20 * 1024 * 1024) {
      setError(
        'Selecione um Excel .xlsx de até 20 MB. Para .xls, salve uma cópia .xlsx no Excel.',
      );
      return;
    }
    lock(true);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await new Promise<ExcelSheet[]>((resolve, reject) => {
        const reader = new Worker(
          new URL('../workers/excel-import.worker.ts', import.meta.url),
          { type: 'module' },
        );
        worker.current = reader;
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'A leitura demorou demais. Divida a planilha em arquivos menores.',
              ),
            ),
          45000,
        );
        reader.onmessage = (
          event: MessageEvent<{ sheets?: ExcelSheet[]; error?: string }>,
        ) =>
          event.data.sheets
            ? resolve(event.data.sheets)
            : reject(new Error(event.data.error ?? 'Excel inválido.'));
        reader.onerror = () =>
          reject(
            new Error(
              'Não foi possível ler o arquivo. Verifique se é .xlsx e não está protegido por senha.',
            ),
          );
        reader.postMessage(buffer, [buffer]);
      });
      if (!parsed.length) throw new Error('Este arquivo não possui abas.');
      setFileName(file.name);
      setSheets(parsed);
      setSheetIndex(0);
      setHeader(0);
      setMapping(autoMap(parsed[0].data[0] ?? []));
    } catch (error) {
      setError(messageOf(error));
    } finally {
      clearTimeout(timer);
      worker.current?.terminate();
      worker.current = null;
      lock(false);
    }
  }
  async function analyze() {
    if (busy || dirty) return;
    resetPreview();
    lock(true);
    try {
      const snapshot = await onRefresh();
      if (mode === 'excel') {
        if (!sheet) throw new Error('Selecione uma planilha.');
        const rows = previewProducts(
          sheet.data,
          header,
          mapping,
          snapshot.products,
          snapshot.config,
          options,
        );
        if (!rows.length)
          throw new Error(
            'Nenhum produto encontrado abaixo do cabeçalho selecionado.',
          );
        setProducts(rows);
        const valid = rows.filter((r) => ['new', 'update'].includes(r.action));
        setRelationships({
          brands: new Set(
            valid
              .filter(
                (r) =>
                  !snapshot.config.brands.some(
                    (b) => normalize(b.name) === normalize(r.values.brand!),
                  ),
              )
              .map((r) => normalize(r.values.brand!)),
          ).size,
          categories: new Set(
            valid
              .filter(
                (r) =>
                  !snapshot.config.taxonomy.some(
                    (t) =>
                      normalize(t.department) ===
                        normalize(r.values.department!) &&
                      normalize(t.section) === normalize(r.values.section!) &&
                      normalize(t.category) === normalize(r.values.category!),
                  ),
              )
              .map((r) =>
                JSON.stringify(
                  [
                    r.values.department,
                    r.values.section,
                    r.values.category,
                  ].map((v) => normalize(v!)),
                ),
              ),
          ).size,
        });
      } else setImages(previewImages(files, snapshot.products, replaceImages));
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock(false);
    }
  }
  async function run() {
    if (busy || dirty || done || !ready) return;
    const question =
      mode === 'excel'
        ? `Importar ${ready} produtos válidos? ${readyProducts.filter((r) => r.action === 'update').length} serão atualizados. Novos produtos serão ${options.publishNew ? 'publicados' : 'salvos como rascunho'}. Linhas com erro não serão importadas.`
        : `Vincular ${ready} imagens? ${readyImages.filter((r) => r.action === 'replace').length} imagens existentes serão substituídas. Arquivos com erro serão ignorados.`;
    if (!window.confirm(question)) return;
    lock(true);
    setRunning(true);
    setDone(false);
    setError('');
    setNotice('');
    setReport([]);
    setStopping(false);
    cancel.current = false;
    setProgress({ value: 0, total: ready });
    const collected: Report[] = [];
    let attempted = 0;
    let interrupted = false;
    try {
      if (mode === 'excel') {
        for (
          let start = 0;
          start < readyProducts.length && !cancel.current;
          start += 10
        ) {
          const batch = readyProducts.slice(start, start + 10);
          const response = await api<{ results: ImportResult[] }>(
            '/api/import/products',
            {
              rows: batch.map(({ row, values, expectedUpdatedAt }) => ({
                row,
                values,
                expectedUpdatedAt,
              })),
              sourceFile: fileName.slice(0, 120),
              ...options,
            },
            AbortSignal.timeout(60000),
          );
          collected.push(
            ...response.results.map((r) => ({
              key: String(r.row),
              code: r.code,
              status: r.status,
              message: r.message,
            })),
          );
          attempted += batch.length;
          setReport([...collected]);
          setProgress({ value: attempted, total: ready });
        }
      } else {
        for (const row of readyImages) {
          if (cancel.current) break;
          let optimized: OptimizedImage;
          try {
            optimized = await optimizeImage(row.file);
          } catch (error) {
            collected.push({
              key: String(images!.indexOf(row)),
              code: row.product!.code,
              status: 'error',
              message: messageOf(error) + ' Nenhum arquivo foi enviado.',
            });
            attempted++;
            setReport([...collected]);
            setProgress({ value: attempted, total: ready });
            continue;
          }
          if (cancel.current) break;
          const form = new FormData();
          form.append('file', optimized.file);
          form.append('code', row.product!.code);
          form.append('expectedUpdatedAt', row.product!.updatedAt ?? '');
          form.append('replaceExisting', String(replaceImages));
          const response = await fetch('/api/import/images', {
            method: 'POST',
            body: form,
            signal: AbortSignal.timeout(60000),
          });
          const result = (await response.json()) as {
            error?: string;
            url?: string;
          };
          if (response.status >= 500 || response.status === 403)
            throw new Error(result.error ?? 'Conexão interrompida.');
          collected.push({
            key: String(images!.indexOf(row)),
            code: row.product!.code,
            status: response.ok && result.url ? 'linked' : 'error',
            message:
              response.ok && result.url
                ? 'Imagem principal vinculada. ' +
                  optimizationSummary(optimized)
                : (result.error ?? 'Falha ao enviar.'),
          });
          attempted++;
          setReport([...collected]);
          setProgress({ value: attempted, total: ready });
        }
      }
      setNotice(
        cancel.current && attempted < ready
          ? `Interrompido após a operação atual. ${ready - attempted} itens não foram enviados.`
          : 'Processamento concluído. Confira o resultado de cada linha abaixo.',
      );
    } catch (error) {
      interrupted = true;
      setError(
        `${messageOf(error)} Os envios foram interrompidos. O último lote pode ter sido salvo sem confirmação; analise novamente antes de tentar. Os itens já confirmados foram mantidos.`,
      );
    } finally {
      setDone(true);
      setRunning(false);
      setStopping(false);
      try {
        await onRefresh();
      } catch {
        setError((current) =>
          `${current} Não foi possível atualizar a lista do editor. Recarregue a página para conferir os dados salvos.`.trim(),
        );
      }
      if (interrupted)
        setNotice(
          `${collected.length} resultados confirmados antes da interrupção.`,
        );
      lock(false);
    }
  }
  function downloadReport() {
    const cell = (value: string) =>
      `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;
    const rows = previewRows.map((row) => {
      const result = reportMap.get(row.key);
      return [
        row.reference,
        row.code,
        row.name,
        result
          ? (labels[result.status] ?? result.status)
          : done && ['new', 'update', 'link', 'replace'].includes(row.action)
            ? 'Sem confirmação / não enviado'
            : labels[row.action],
        result?.message ?? row.note,
      ]
        .map(cell)
        .join(';');
    });
    const url = URL.createObjectURL(
      new Blob(
        [
          '\uFEFFReferência;Código;Produto;Situação;Observação\r\n' +
            rows.join('\r\n'),
        ],
        { type: 'text/csv;charset=utf-8' },
      ),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'relatorio-importacao.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Panel
      title="Importações em lote"
      note="Seu catálogo cresce sem cadastro um a um. Escolha o arquivo, confira os vínculos e só então importe."
    >
      <div className="import-tabs" aria-label="Tipo de importação">
        <Button
          variant={mode === 'excel' ? 'default' : 'outline'}
          aria-pressed={mode === 'excel'}
          disabled={busy}
          onClick={() => {
            setMode('excel');
            resetPreview();
          }}
        >
          <FileSpreadsheet /> Produtos por Excel
        </Button>
        <Button
          variant={mode === 'images' ? 'default' : 'outline'}
          aria-pressed={mode === 'images'}
          disabled={busy}
          onClick={() => {
            setMode('images');
            resetPreview();
          }}
        >
          <Images /> Imagens por código
        </Button>
      </div>
      {dirty && (
        <p role="alert" className="data-warning">
          Salve ou desfaça as alterações pendentes em Produtos e nas
          configurações antes de importar.
        </p>
      )}
      <fieldset disabled={busy || dirty} className="import-setup">
        <div className="import-step-title">
          <span>1</span>
          <h2>
            {mode === 'excel' ? 'Selecione a planilha' : 'Selecione as imagens'}
          </h2>
        </div>
        {mode === 'excel' ? (
          <>
            <label className="import-dropzone">
              <FileSpreadsheet />
              <strong>{fileName || 'Selecionar arquivo Excel'}</strong>
              <span>.xlsx · até 20 MB · até 20.000 produtos por aba</span>
              <Input
                type="file"
                aria-label="Selecionar arquivo Excel de produtos"
                accept=".xlsx"
                onChange={(e) => {
                  void read(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            <p className="source-note">
              Compatível com as colunas da sua planilha produtos.xlsx. Código,
              nome, departamento, seção, categoria e marca são obrigatórios.
              Guarde códigos e EAN como texto no Excel para preservar zeros à
              esquerda; zeros já perdidos no arquivo não podem ser recuperados.
            </p>
            {sheets.length > 0 && (
              <>
                <div className="import-options">
                  <label className="editor-field" htmlFor="import-sheet">
                    <span>Aba da planilha</span>
                    <NativeSelect
                      id="import-sheet"
                      value={sheetIndex}
                      onChange={(e) => {
                        const index = Number(e.target.value);
                        setSheetIndex(index);
                        setHeader(0);
                        setMapping(autoMap(sheets[index].data[0] ?? []));
                        resetPreview();
                      }}
                    >
                      {sheets.map((s, i) => (
                        <option key={i} value={i}>
                          {s.sheet}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                  <label className="editor-field" htmlFor="import-header-row">
                    <span>Linha dos títulos das colunas</span>
                    <Input
                      id="import-header-row"
                      type="number"
                      min={1}
                      max={Math.min(50, sheet?.data.length ?? 1)}
                      value={header + 1}
                      onChange={(e) => {
                        const next = Math.max(
                          0,
                          Math.min(
                            49,
                            (sheet?.data.length ?? 1) - 1,
                            (Number(e.target.value) || 1) - 1,
                          ),
                        );
                        setHeader(next);
                        setMapping(autoMap(sheet?.data[next] ?? []));
                        resetPreview();
                      }}
                    />
                  </label>
                </div>
                <details
                  className="import-mapping"
                  open={Boolean(mappingError(mapping))}
                >
                  <summary>
                    Conferir colunas reconhecidas{' '}
                    {mappingError(mapping)
                      ? '· atenção necessária'
                      : '· campos obrigatórios identificados'}
                  </summary>
                  <div className="import-options">
                    {importColumns.map((field) => (
                      <label
                        key={field.key}
                        className="editor-field"
                        htmlFor={`import-column-${field.key}`}
                      >
                        <span>
                          {field.label}
                          {'required' in field ? ' *' : ''}
                        </span>
                        <NativeSelect
                          id={`import-column-${field.key}`}
                          value={mapping[field.key] ?? ''}
                          onChange={(e) => {
                            setMapping({
                              ...mapping,
                              [field.key]:
                                e.target.value === ''
                                  ? undefined
                                  : Number(e.target.value),
                            });
                            resetPreview();
                          }}
                        >
                          <option value="">Não importar</option>
                          {headers.map((title, index) =>
                            columnTitle(title) ? (
                              <option key={index} value={index}>
                                {index + 1}. {columnTitle(title)}
                              </option>
                            ) : null,
                          )}
                        </NativeSelect>
                      </label>
                    ))}
                  </div>
                </details>
                <label className="editor-field" htmlFor="import-mode">
                  <span>Quando o código já existir</span>
                  <NativeSelect
                    id="import-mode"
                    value={options.mode}
                    onChange={(e) => {
                      setOptions({
                        ...options,
                        mode: e.target.value as ImportOptions['mode'],
                      });
                      resetPreview();
                    }}
                  >
                    <option value="upsert">
                      Atualizar existentes e cadastrar novos
                    </option>
                    <option value="new">
                      Cadastrar apenas novos; manter existentes
                    </option>
                  </NativeSelect>
                </label>
                <Toggle
                  disabled={busy || dirty}
                  label="Publicar os novos produtos ao importar"
                  value={options.publishNew}
                  onChange={(value) => {
                    setOptions({ ...options, publishNew: value });
                    resetPreview();
                  }}
                />
                <div className="import-help">
                  <CheckCircle2 />
                  <p>
                    Novos itens ficam como{' '}
                    <strong>
                      {options.publishNew ? 'publicados' : 'rascunho'}
                    </strong>
                    . Atualizações preservam fotos, descrição, características,
                    destaque e publicação. Células opcionais vazias mantêm os
                    valores existentes. Marcas e hierarquias novas são
                    cadastradas sem alterar logos ou a aparência da página.
                    Segmentos são classificados pelas regras atuais do catálogo.
                  </p>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <label className="import-dropzone">
              <Images />
              <strong>
                {files.length
                  ? `${files.length} arquivos selecionados`
                  : 'Selecionar várias imagens'}
              </strong>
              <span>
                PNG, JPEG, WebP ou GIF estático · até 5 MB cada · até 500
                arquivos
              </span>
              <Input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif"
                aria-label="Selecionar imagens de produtos em lote"
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? []);
                  resetPreview();
                  if (selected.length > 500) {
                    setFiles([]);
                    setError('Selecione até 500 imagens por vez.');
                  } else setFiles(selected);
                  e.target.value = '';
                }}
              />
            </label>
            <div className="import-file-examples">
              <code>123.jpg</code>
              <code>123_frente.png</code>
              <code>123-foto.webp</code>
              <span>
                → produto de código <strong>123</strong>
              </span>
            </div>
            <p className="source-note">
              Todas as imagens serão convertidas para WebP antes do envio, com
              até 1.920 pixels no maior lado e transparência preservada. O
              relatório mostra o tamanho antes e depois. Os arquivos originais
              no seu computador não são alterados.
            </p>
            <p className="source-note">
              Use o código exato no início do nome, seguido de espaço, hífen ou
              sublinhado. Zeros à esquerda e letras maiúsculas/minúsculas
              precisam coincidir. Cada produto recebe uma imagem principal;
              nomes sem correspondência ou vários arquivos para o mesmo código
              ficam para revisão.
            </p>
            <Toggle
              disabled={busy || dirty}
              label="Permitir substituir imagens já cadastradas"
              value={replaceImages}
              onChange={(value) => {
                setReplaceImages(value);
                resetPreview();
              }}
            />
            {replaceImages && (
              <p className="data-warning">
                As imagens indicadas como “Substituir” trocarão a foto principal
                do produto. As demais informações não serão alteradas.
              </p>
            )}
          </>
        )}
        <Button
          disabled={
            busy || dirty || (mode === 'excel' ? !sheets.length : !files.length)
          }
          onClick={() => void analyze()}
        >
          <SearchIcon />
          {reviewed ? 'Analisar novamente' : 'Analisar e conferir'}
        </Button>
      </fieldset>
      {busy && !running && (
        <output className="import-loading">
          <Loader2 className="animate-spin" /> Lendo os dados e preparando a
          conferência…
        </output>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {reviewed && (
        <section className="import-preview">
          <div className="import-step-title">
            <span>2</span>
            <h2>Confira antes de importar</h2>
          </div>
          <div className="import-stats">
            <article>
              <strong>{previewRows.length}</strong>
              <span>
                {mode === 'excel'
                  ? 'Linhas encontradas'
                  : 'Imagens selecionadas'}
              </span>
            </article>
            <article>
              <strong>{ready}</strong>
              <span>Prontos para importar</span>
            </article>
            <article>
              <strong>{skipped}</strong>
              <span>Serão mantidos</span>
            </article>
            <article className={errors ? 'has-warning' : ''}>
              <strong>{errors}</strong>
              <span>Precisam de correção</span>
            </article>
          </div>
          {mode === 'excel' && (
            <p className="source-note">
              {readyProducts.filter((r) => r.action === 'new').length} produtos
              novos ·{' '}
              {readyProducts.filter((r) => r.action === 'update').length}{' '}
              atualizações · {relationships.brands} marcas novas ·{' '}
              {relationships.categories} caminhos de categoria novos.
            </p>
          )}
          {errors > 0 && (
            <div className="import-help">
              <AlertTriangle />
              <p>
                As linhas marcadas para revisão não serão importadas. Corrija o
                arquivo e selecione novamente para incluí-las.
              </p>
            </div>
          )}
          <div className="import-actions">
            <Button
              disabled={busy || dirty || !ready || done}
              onClick={() => void run()}
            >
              <Upload />
              Confirmar e importar {ready}{' '}
              {mode === 'excel' ? 'produtos' : 'imagens'}
            </Button>
            <Button variant="outline" disabled={busy} onClick={downloadReport}>
              <Download />
              Baixar relatório
            </Button>
          </div>
          {(running || done) && (
            <div className="import-progress" aria-live="polite">
              <Progress
                value={
                  progress.total ? (progress.value / progress.total) * 100 : 0
                }
              >
                <ProgressLabel>
                  {progress.value} de {progress.total} processados
                </ProgressLabel>
                <ProgressValue />
              </Progress>
              {running ? (
                <Button
                  variant="outline"
                  disabled={stopping}
                  onClick={() => {
                    cancel.current = true;
                    setStopping(true);
                  }}
                >
                  {stopping
                    ? 'Concluindo a operação atual…'
                    : 'Parar após a operação atual'}
                </Button>
              ) : (
                <p>
                  <strong>{successful} salvos com sucesso</strong> ·{' '}
                  {report.filter((r) => r.status === 'error').length} falhas ·{' '}
                  {report.filter((r) => r.status === 'skipped').length}{' '}
                  mantidos. Para nova tentativa, clique em “Analisar novamente”.
                </p>
              )}
            </div>
          )}
          {notice && <output className="success-message">{notice}</output>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{mode === 'excel' ? 'Linha' : 'Arquivo'}</TableHead>
                <TableHead>Código / produto</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Conferência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.slice(page * 30, page * 30 + 30).map((row) => {
                const result = reportMap.get(row.key);
                const status = result?.status ?? row.action;
                return (
                  <TableRow key={row.key}>
                    <TableCell className="import-reference">
                      {row.reference}
                    </TableCell>
                    <TableCell className="import-product">
                      <strong>{row.code || '—'}</strong>
                      <span>{row.name}</span>
                      {row.segment && <small>{row.segment}</small>}
                    </TableCell>
                    <TableCell>
                      <span className={`import-status status-${status}`}>
                        {result
                          ? labels[status]
                          : done &&
                              ['new', 'update', 'link', 'replace'].includes(
                                status,
                              )
                            ? 'Não confirmado'
                            : labels[status]}
                      </span>
                    </TableCell>
                    <TableCell className="import-note">
                      {result?.message ?? row.note}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="import-pagination">
            <span>
              {previewRows.length ? page * 30 + 1 : 0}–
              {Math.min(page * 30 + 30, previewRows.length)} de{' '}
              {previewRows.length}
            </span>
            <Button
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={(page + 1) * 30 >= previewRows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Próximos
            </Button>
          </div>
        </section>
      )}
    </Panel>
  );
}
function SearchIcon() {
  return <CheckCircle2 />;
}
