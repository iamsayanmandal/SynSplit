import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

/**
 * React Error Boundary that catches component crashes
 * and shows a friendly recovery UI instead of a blank screen.
 */
export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen min-h-[100dvh] bg-dark-950 flex items-center justify-center p-6">
                    <div className="max-w-sm w-full bg-dark-900 rounded-3xl p-8 border border-glass-border shadow-soft text-center">
                        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
                            <span className="text-3xl">⚠️</span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                        <p className="text-dark-400 text-sm mb-6">
                            An unexpected error occurred. Your data is safe.
                        </p>
                        <button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.href = '/';
                            }}
                            className="w-full bg-gradient-to-r from-accent to-purple-600 text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 active:scale-95"
                        >
                            Back to Home
                        </button>
                        {this.state.error && (
                            <p className="mt-4 text-dark-600 text-[10px] font-mono break-all">
                                {this.state.error.message}
                            </p>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
