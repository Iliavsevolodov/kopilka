"use client";
import { BrandSelect, BrandFile } from "./branded-controls";
import { useState } from "react";
import { useFinance } from "./provider";
import {
  parseCsv,
  guessMap,
  previewCsv,
  importRows,
  type CsvMap,
} from "@/lib/local/csv";
import { uid } from "@/lib/local/model";
import { Money, download } from "./ui";
export function CsvImport({ onClose }: { onClose: () => void }) {
  const { state, update } = useFinance();
  const [file, setFile] = useState<ReturnType<typeof parseCsv> | null>(null),
    [map, setMap] = useState<CsvMap | null>(null),
    [account, setAccount] = useState(
      state.accounts.find((a) => !a.archived)?.id ?? "",
    );
  const [batch, setBatch] = useState(""),
    [excluded, setExcluded] = useState<number[]>([]),
    [page, setPage] = useState(0),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const preview =
    file && map ? previewCsv(state, file.rows, map, account, batch) : [];
  const available = preview.filter((r) => !r.error && !r.duplicate),
    selected = available.filter((r) => !excluded.includes(r.line));
  const labels: Record<keyof CsvMap, string> = {
    currency: "Валюта",
    date: "Дата",
    amount: "Сумма",
    type: "Тип",
    category: "Категория",
    description: "Описание",
    merchant: "Магазин / источник",
    tags: "Теги",
    externalId: "Внешний ID",
  };
  return (
    <section className="card csv-import">
      <div className="section-title">
        <h2>Импорт операций из CSV</h2>
        <button className="text-button" onClick={onClose}>
          Закрыть импорт
        </button>
      </div>
      <p>
        Файл обрабатывается на этом устройстве. До подтверждения баланс не
        меняется.
      </p>
      <p className="hint">
        До 2000 строк, 1 МБ, UTF-8. Без столбца «Тип»: минус — расход, плюс —
        доход. Выберите один счёт; смешанную выписку предварительно разделите.
        Переводы, возвраты и конвертации добавляйте отдельно.
      </p>
      <button
        className="text-button"
        onClick={() =>
          download(
            "kopilka-import-template.csv",
            "\uFEFFДата;Сумма;Тип;Категория;Описание;Магазин;Теги;ID\n2026-01-01;-1500;расход;Продукты;Покупка;Магазин;Дом;example-1",
            "text/csv;charset=utf-8",
          )
        }
      >
        Скачать шаблон CSV
      </button>
      <div className="report-filter-grid">
        <label>
          Счёт импорта
          <BrandSelect
            aria-label="Счёт импорта"
            value={account}
            onChange={(e) => {
              setAccount(e.target.value);
              setExcluded([]);
            }}
          >
            {state.accounts
              .filter((a) => !a.archived)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
          </BrandSelect>
        </label>
        <label>
          Файл CSV
          <BrandFile
            aria-label="Файл CSV"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                if (f.size > 1_000_000)
                  throw new Error("Максимальный размер — 1 МБ");
                const parsed = parseCsv(await f.text());
                setFile(parsed);
                setMap(guessMap(parsed.headers));
                setBatch(uid());
                setPage(0);
                setExcluded([]);
                setError("");
                setMessage("");
              } catch (e) {
                setFile(null);
                setError(
                  e instanceof Error ? e.message : "Не удалось прочитать файл",
                );
              }
            }}
          />
        </label>
      </div>
      {file && map && (
        <>
          <h3>Сопоставление столбцов</h3>
          <div className="report-filter-grid">
            {(Object.keys(labels) as (keyof CsvMap)[]).map((key) => (
              <label key={key}>
                {labels[key]}
                {["date", "amount"].includes(key) ? " *" : ""}
                <BrandSelect
                  aria-label={labels[key]}
                  value={map[key]}
                  onChange={(e) => {
                    setMap({ ...map, [key]: Number(e.target.value) });
                    setExcluded([]);
                    setPage(0);
                  }}
                >
                  <option value={-1}>Не указан</option>
                  {file.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Столбец ${i + 1}`}
                    </option>
                  ))}
                </BrandSelect>
              </label>
            ))}
          </div>
          <h3>Предпросмотр · {selected.length} к импорту</h3>
          <p className="hint">
            {preview.filter((r) => r.error).length} ошибок ·{" "}
            {preview.filter((r) => r.duplicate).length} возможных дублей
            исключено. Неизвестные категории получают доступную категорию по
            умолчанию и попадают в «Требует внимания» при выборе «Другое».
          </p>
          <div className="import-preview">
            {preview.slice(page * 10, page * 10 + 10).map((r) => (
              <label
                key={r.line}
                className={`import-row ${r.error ? "error-message" : ""}`}
              >
                <input
                  type="checkbox"
                  aria-label={`Импорт строки ${r.line}`}
                  checked={
                    !r.error && !r.duplicate && !excluded.includes(r.line)
                  }
                  disabled={!!r.error || r.duplicate}
                  onChange={(e) =>
                    setExcluded(
                      e.target.checked
                        ? excluded.filter((x) => x !== r.line)
                        : [...excluded, r.line],
                    )
                  }
                />
                <span>
                  <strong>
                    Строка {r.line} · {r.transaction?.date}
                  </strong>
                  <small>
                    {r.error ||
                      r.transaction?.description ||
                      r.transaction?.merchant ||
                      "Без описания"}
                  </small>
                  <small>
                    {r.duplicate
                      ? "Возможный дубль — проверьте историю"
                      : r.needsCategory
                        ? "Категория не распознана"
                        : state.categories.find(
                            (c) => c.id === r.transaction?.categoryId,
                          )?.name}
                  </small>
                </span>
                {r.transaction && (
                  <b>
                    {r.transaction.type === "expense" ? "−" : "+"}
                    <Money
                      value={r.transaction.amountMinor}
                      currency={
                        state.accounts.find((a) => a.id === account)?.currency
                      }
                    />
                  </b>
                )}
              </label>
            ))}
          </div>
          <div className="pagination">
            <button
              className="btn-secondary"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Предыдущие строки
            </button>
            <span>
              {page + 1} / {Math.ceil(preview.length / 10)}
            </span>
            <button
              className="btn-secondary"
              disabled={(page + 1) * 10 >= preview.length}
              onClick={() => setPage(page + 1)}
            >
              Следующие строки
            </button>
          </div>
          <button
            className="btn-primary"
            disabled={!selected.length || saving}
            onClick={async () => {
              setSaving(true);
              setError("");
              try {
                await update((s) =>
                  importRows(s, preview, new Set(selected.map((r) => r.line))),
                );
                setMessage(`Импортировано операций: ${selected.length}`);
                setFile(null);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "Не удалось импортировать файл",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving
              ? "Импортируем…"
              : `Подтвердить импорт (${selected.length})`}
          </button>
        </>
      )}
      {message && (
        <p role="status" className="success-box">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
    </section>
  );
}
