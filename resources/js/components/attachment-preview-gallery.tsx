import { ExternalLink, FileText, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import '@/../css/attachment-preview-gallery.css';

export type AttachmentPreviewFile = {
    name: string;
    url: string;
    mime?: string | null;
};

const fileKind = (file: AttachmentPreviewFile) => {
    const mime = (file.mime ?? '').toLowerCase();
    const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'jfif', 'png', 'webp', 'gif'].includes(extension)) {
        return 'image';
    }

    if (mime === 'application/pdf' || extension === 'pdf') {
        return 'pdf';
    }

    return 'file';
};

export function AttachmentPreviewGallery({ files }: { files: AttachmentPreviewFile[] }) {
    const [selectedUrl, setSelectedUrl] = useState(files[0]?.url ?? '');
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        setSelectedUrl(files[0]?.url ?? '');
        setZoom(1);
    }, [files.map((file) => file.url).join('|')]);

    if (files.length === 0) return null;

    const selected = files.find((file) => file.url === selectedUrl) ?? files[0];
    const kind = fileKind(selected);

    return (
        <section className="attachment-preview-gallery" aria-label="Attached file preview">
            {files.length > 1 && (
                <div className="attachment-preview-gallery__tabs">
                    {files.map((file) => (
                        <button
                            key={file.url}
                            type="button"
                            className={file.url === selected.url ? 'is-active' : ''}
                            onClick={() => setSelectedUrl(file.url)}
                            title={file.name}
                        >
                            {file.name}
                        </button>
                    ))}
                </div>
            )}
            <div className={`attachment-preview-gallery__frame${kind === 'image' ? ' is-image' : ''}`}>
                {kind === 'image' && (
                    <div className="attachment-preview-gallery__zoom">
                        <button type="button" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} disabled={zoom <= 1} aria-label="Zoom out">
                            <ZoomOut />
                        </button>
                        <strong>{Math.round(zoom * 100)}%</strong>
                        <button type="button" onClick={() => setZoom((value) => Math.min(4, value + 0.5))} disabled={zoom >= 4} aria-label="Zoom in">
                            <ZoomIn />
                        </button>
                        <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Reset zoom">
                            <RotateCcw />
                        </button>
                    </div>
                )}
                {kind === 'image' ? (
                    <img
                        src={selected.url}
                        alt={selected.name}
                        style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}
                        onDoubleClick={() => setZoom((value) => (value === 1 ? 2 : 1))}
                    />
                ) : kind === 'pdf' ? (
                    <iframe src={selected.url} title={`Preview of ${selected.name}`} />
                ) : (
                    <div className="attachment-preview-gallery__unsupported">
                        <FileText />
                        <strong>{selected.name}</strong>
                        <span>This file type cannot be previewed in the browser.</span>
                    </div>
                )}
            </div>
            <a href={selected.url} target="_blank" rel="noreferrer">
                <ExternalLink /> Open {selected.name}
            </a>
        </section>
    );
}
