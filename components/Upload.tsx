import {useCallback, useEffect, useRef, useState} from 'react'
import {CheckCircle2, ImageIcon, UploadIcon} from "lucide-react";
import {PROGRESS_INCREMENT, REDIRECT_DELAY_MS, PROGRESS_INTERVAL_MS} from "../lib/constants";

interface UploadProps {
    onComplete?: (base64Data: string) => void;
}

const Upload = ({ onComplete }: UploadProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [progress, setProgress] = useState(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, []);

    const fileToPngIfNeeded = useCallback(async (originalFile: File): Promise<File> => {
        if (originalFile.type === "image/png") return originalFile;

        // Convert any other image type to PNG client-side via canvas.
        const objectUrl = URL.createObjectURL(originalFile);
        try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = objectUrl;
            });

            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;

            const ctx = canvas.getContext("2d");
            if (!ctx) return originalFile;

            ctx.drawImage(img, 0, 0);

            const pngBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob), "image/png");
            });

            if (!pngBlob) return originalFile;

            const safeBaseName = (originalFile.name || "upload")
                .replace(/\.[^/.]+$/, "");
            const pngName = `${safeBaseName}.png`;
            return new File([pngBlob], pngName, { type: "image/png" });
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }, []);

    const processFile = useCallback(async (incomingFile: File) => {
        const normalizedFile = await fileToPngIfNeeded(incomingFile);
        setFile(normalizedFile);
        setProgress(0);

        const reader = new FileReader();
        reader.onerror = () => {
            setFile(null);
            setProgress(0);
        };
        reader.onloadend = () => {
            const base64Data = reader.result as string;

            intervalRef.current = setInterval(() => {
                setProgress((prev) => {
                    const next = prev + PROGRESS_INCREMENT;
                    if (next >= 100) {
                        if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                        }
                        timeoutRef.current = setTimeout(() => {
                            onComplete?.(base64Data);
                            timeoutRef.current = null;
                        }, REDIRECT_DELAY_MS);
                        return 100;
                    }
                    return next;
                });
            }, PROGRESS_INTERVAL_MS);
        };
        reader.readAsDataURL(normalizedFile);
    }, [fileToPngIfNeeded, onComplete]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (droppedFile && allowedTypes.includes(droppedFile.type)) {
            void processFile(droppedFile);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            void processFile(selectedFile);
        }
        // Allow selecting the same file again.
        e.target.value = "";
    };

    const handleDropzoneActivate = () => inputRef.current?.click();

    const handleDropzoneKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleDropzoneActivate();
        }
    };

    return (
        <div className="upload">
            {!file ? (
                <div
                    className={`dropzone ${isDragging ? 'is-dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={handleDropzoneActivate}
                    onKeyDown={handleDropzoneKeyDown}
                    role="button"
                    tabIndex={0}
                >
                    <input
                        type="file"
                        className="drop-input"
                        accept=".jpg,.jpeg,.png,.webp"
                        onChange={handleChange}
                        onClick={(e) => e.stopPropagation()}
                        ref={inputRef}
                    />

                    <div className="drop-content">
                        <div className="drop-icon">
                            <UploadIcon size={20} />
                        </div>
                        <p>
                            Click to upload or just drag and drop
                        </p>
                        <p className="help">Maximum file size 50 MB.</p>
                    </div>
                </div>
            ) : (
                <div className="upload-status">
                    <div className="status-content">
                        <div className="status-icon">
                            {progress === 100 ? (
                                <CheckCircle2 className="check" />
                            ): (
                                <ImageIcon className="image" />
                            )}
                        </div>

                        <h3>{file.name}</h3>

                        <div className='progress'>
                            <div className="bar" style={{ width: `${progress}%` }} />

                            <p className="status-text">
                                {progress < 100 ? 'Analyzing Floor Plan...' : 'Redirecting...'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
export default Upload
