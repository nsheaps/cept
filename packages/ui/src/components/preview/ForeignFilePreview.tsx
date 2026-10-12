import { useEffect, useState } from 'react';
import { mimeTypeOf, previewKind, previewText, type PreviewKind } from './foreign-file.js';

export interface ForeignFilePreviewProps {
  /** The file's path relative to the space root. */
  path: string;
  /** Read the file's bytes; null when it is missing. Called once per opened file. */
  readFile: (path: string) => Promise<Uint8Array | null>;
  /** Change it to read the file again, for example after a sync rewrote it. */
  refreshToken?: number;
}

type Loaded =
  | { state: 'loading' }
  | { state: 'missing' }
  | {
      state: 'ready';
      kind: PreviewKind;
      url: string;
      text: string;
      truncated: boolean;
      size: number;
    };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * A read-only preview of a file that is not a page: images, PDFs and plain
 * text are shown, anything else offers a download. The file is read when it is
 * opened and its blob URL is revoked when it is closed.
 */
export function ForeignFilePreview({ path, readFile, refreshToken }: ForeignFilePreviewProps) {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const name = path.split('/').at(-1) ?? path;

  useEffect(() => {
    let disposed = false;
    let url: string | null = null;
    setLoaded({ state: 'loading' });
    readFile(path)
      .then((bytes) => {
        if (disposed) return;
        if (!bytes) {
          setLoaded({ state: 'missing' });
          return;
        }
        const kind = previewKind(name, bytes);
        url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeTypeOf(name, kind) }));
        const { text, truncated } =
          kind === 'text' ? previewText(bytes) : { text: '', truncated: false };
        setLoaded({ state: 'ready', kind, url, text, truncated, size: bytes.length });
      })
      .catch(() => {
        if (!disposed) setLoaded({ state: 'missing' });
      });
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, name, readFile, refreshToken]);

  return (
    <div className="cept-foreign-preview" data-testid="foreign-file-preview">
      <h1 className="cept-foreign-preview-title">{name}</h1>
      {loaded.state === 'loading' && <p data-testid="foreign-file-loading">Loading...</p>}
      {loaded.state === 'missing' && (
        <p data-testid="foreign-file-missing">This file could not be read.</p>
      )}
      {loaded.state === 'ready' && (
        <>
          <p className="cept-foreign-preview-meta">
            {path} · {formatSize(loaded.size)} · read-only
          </p>
          {loaded.kind === 'image' && (
            <img className="cept-foreign-preview-image" src={loaded.url} alt={name} />
          )}
          {loaded.kind === 'pdf' && (
            <object
              className="cept-foreign-preview-pdf"
              type="application/pdf"
              data={loaded.url}
              aria-label={name}
            />
          )}
          {loaded.kind === 'text' && (
            <>
              <pre className="cept-foreign-preview-text" data-testid="foreign-file-text">
                {loaded.text}
              </pre>
              {loaded.truncated && <p>Only the start of this file is shown.</p>}
            </>
          )}
          <a
            className="cept-foreign-preview-download"
            href={loaded.url}
            download={name}
            data-testid="foreign-file-download"
          >
            Download
          </a>
        </>
      )}
    </div>
  );
}
