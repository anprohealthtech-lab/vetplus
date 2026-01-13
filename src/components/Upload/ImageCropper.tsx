import React, { useState, useRef, useEffect, MouseEvent } from 'react';
import { X, Check, Crop } from 'lucide-react';

interface ImageCropperProps {
    imageFile: File;
    onCrop: (croppedFile: File) => void;
    onCancel: () => void;
}

interface Selection {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageFile, onCrop, onCancel }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [selection, setSelection] = useState<Selection | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const url = URL.createObjectURL(imageFile);
        setImageUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [imageFile]);

    const getRelativeCoords = (e: MouseEvent) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        const coords = getRelativeCoords(e);
        setStartPos(coords);
        setSelection({ x: coords.x, y: coords.y, width: 0, height: 0 });
        setIsDragging(true);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const current = getRelativeCoords(e);

        const width = current.x - startPos.x;
        const height = current.y - startPos.y;

        setSelection({
            x: width > 0 ? startPos.x : current.x,
            y: height > 0 ? startPos.y : current.y,
            width: Math.abs(width),
            height: Math.abs(height)
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleCrop = () => {
        if (!imgRef.current || !selection || selection.width < 10 || selection.height < 10) return;

        const canvas = document.createElement('canvas');
        const displayWidth = imgRef.current.width;
        const displayHeight = imgRef.current.height;
        const naturalWidth = imgRef.current.naturalWidth;
        const naturalHeight = imgRef.current.naturalHeight;

        const scaleX = naturalWidth / displayWidth;
        const scaleY = naturalHeight / displayHeight;

        canvas.width = selection.width * scaleX;
        canvas.height = selection.height * scaleY;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(
            imgRef.current,
            selection.x * scaleX,
            selection.y * scaleY,
            selection.width * scaleX,
            selection.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
        );

        canvas.toBlob((blob) => {
            if (!blob) return;
            const newFile = new File([blob], `cropped_${imageFile.name}`, {
                type: imageFile.type,
                lastModified: Date.now(),
            });
            onCrop(newFile);
        }, imageFile.type);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-75 p-4">
            <div className="relative flex max-h-[90vh] max-w-[90vw] flex-col rounded-lg bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-lg font-semibold text-gray-900">Crop Image</h3>
                    <button onClick={onCancel} className="rounded-full p-1 hover:bg-gray-100">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="relative flex-1 overflow-auto bg-gray-100 p-4">
                    <div
                        ref={containerRef}
                        className="relative mx-auto inline-block cursor-crosshair select-none"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {imageUrl && (
                            <img
                                ref={imgRef}
                                src={imageUrl}
                                alt="Crop target"
                                className="max-h-[60vh] max-w-full object-contain"
                                onDragStart={(e) => e.preventDefault()}
                            />
                        )}

                        {selection && (
                            <div
                                className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20"
                                style={{
                                    left: selection.x,
                                    top: selection.y,
                                    width: selection.width,
                                    height: selection.height,
                                }}
                            />
                        )}
                    </div>
                    <p className="mt-2 text-center text-sm text-gray-500">
                        Click and drag to draw a crop box.
                    </p>
                </div>

                <div className="flex justify-end gap-3 border-t px-4 py-3">
                    <button
                        onClick={onCancel}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCrop}
                        disabled={!selection || selection.width < 10}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Check className="h-4 w-4" />
                        Apply Crop
                    </button>
                </div>
            </div>
        </div>
    );
};
