"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "~/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toasts: Toast[];
    addToast: (message: string, type?: ToastType) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

interface ToastProviderProps {
    children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}

interface ToastContainerProps {
    toasts: Toast[];
    onRemove: (id: string) => void;
}

function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    );
}

interface ToastItemProps {
    toast: Toast;
    onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
    const icons = {
        success: <CheckCircle className="h-5 w-5 text-green-500" />,
        error: <AlertCircle className="h-5 w-5 text-red-500" />,
        info: <Info className="h-5 w-5 text-blue-500" />,
    };

    const bgColors = {
        success: "bg-green-50 border-green-200 dark:bg-green-950/50 dark:border-green-800",
        error: "bg-red-50 border-red-200 dark:bg-red-950/50 dark:border-red-800",
        info: "bg-blue-50 border-blue-200 dark:bg-blue-950/50 dark:border-blue-800",
    };

    return (
        <div
            className={cn(
                "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg",
                "animate-in slide-in-from-right-full fade-in duration-300",
                "min-w-[280px] max-w-[400px]",
                bgColors[toast.type]
            )}
        >
            {icons[toast.type]}
            <span className="flex-1 text-sm text-text-primary">{toast.message}</span>
            <button
                onClick={() => onRemove(toast.id)}
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
                <X className="h-4 w-4 text-text-secondary" />
            </button>
        </div>
    );
}

// Simple toast function for use without context (standalone)
let toastFn: ((message: string, type?: ToastType) => void) | null = null;

export function setToastFunction(fn: (message: string, type?: ToastType) => void) {
    toastFn = fn;
}

export function toast(message: string, type: ToastType = "info") {
    if (toastFn) {
        toastFn(message, type);
    } else {
        console.warn("Toast function not initialized. Wrap your app with ToastProvider.");
    }
}

toast.success = (message: string) => toast(message, "success");
toast.error = (message: string) => toast(message, "error");
toast.info = (message: string) => toast(message, "info");
