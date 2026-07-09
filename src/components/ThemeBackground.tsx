import { useTheme } from '../contexts/ThemeContext';

export default function ThemeBackground() {
    const { theme } = useTheme();

    if (theme === 'jaguar') {
        // Pure Dark Matte Black UI - minimal backdrop, no glowing orbs
        return (
            <div className="fixed inset-0 -z-50 bg-[#000000] overflow-hidden pointer-events-none" />
        );
    }

    if (theme === 'pink') {
        // Pink Bubu Dudu Theme
        return (
            <div className="fixed inset-0 -z-50 bg-[#180911] overflow-hidden pointer-events-none select-none">
                {/* Glowing Rose Pink Orbs */}
                <div className="absolute top-[10%] left-[-10%] w-[70vw] h-[70vw] max-w-[450px] max-h-[450px] rounded-full bg-rose-500/10 blur-[80px] animate-smoke-1" />
                <div className="absolute bottom-[10%] right-[-10%] w-[60vw] h-[60vw] max-w-[400px] max-h-[400px] rounded-full bg-pink-500/10 blur-[80px] animate-smoke-2" />

                {/* Floating Bubbles/Hearts */}
                <div className="absolute bottom-0 left-[15%] w-3 h-3 rounded-full bg-rose-400/20 blur-[1px] animate-bubble" style={{ animationDelay: '0s', animationDuration: '10s' }} />
                <div className="absolute bottom-0 left-[45%] w-4 h-4 rounded-full bg-pink-400/25 blur-[1px] animate-bubble" style={{ animationDelay: '3s', animationDuration: '12s' }} />
                <div className="absolute bottom-0 left-[75%] w-2 h-2 rounded-full bg-rose-300/30 blur-[0.5px] animate-bubble" style={{ animationDelay: '6s', animationDuration: '8s' }} />

                {/* Cute Floating Bubu & Dudu watermark in bottom corner */}
                <div className="absolute bottom-24 right-4 opacity-30 select-none animate-bounce" style={{ animationDuration: '4s' }}>
                    <svg viewBox="0 0 160 100" className="w-32 h-20">
                        {/* Dudu (Grey Cat, Left) */}
                        <g transform="translate(10, 10)">
                            {/* Tail */}
                            <path d="M 15,65 Q 5,60 8,50 Q 11,40 20,45" fill="none" stroke="#78716c" strokeWidth="6" strokeLinecap="round" />
                            {/* Body */}
                            <rect x="20" y="45" width="40" height="30" rx="15" fill="#78716c" />
                            {/* Head */}
                            <circle cx="35" cy="35" r="22" fill="#78716c" />
                            {/* Left Ear */}
                            <polygon points="17,20 28,15 25,30" fill="#78716c" />
                            <polygon points="20,22 26,18 24,28" fill="#fda4af" />
                            {/* Right Ear */}
                            <polygon points="53,20 42,15 45,30" fill="#78716c" />
                            <polygon points="50,22 44,18 46,28" fill="#fda4af" />
                            {/* Eyes */}
                            <circle cx="28" cy="33" r="2.5" fill="#000" />
                            <circle cx="42" cy="33" r="2.5" fill="#000" />
                            {/* Cheeks */}
                            <circle cx="23" cy="38" r="3" fill="#f43f5e" opacity="0.6" />
                            <circle cx="47" cy="38" r="3" fill="#f43f5e" opacity="0.6" />
                            {/* Mouth */}
                            <path d="M 32,38 Q 35,40 35,38 Q 35,40 38,38" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                            {/* Paws */}
                            <circle cx="30" cy="73" r="6" fill="#57534e" />
                            <circle cx="50" cy="73" r="6" fill="#57534e" />
                        </g>
                        
                        {/* Bubu (White Cat, Right) */}
                        <g transform="translate(75, 5)">
                            {/* Tail */}
                            <path d="M 50,70 Q 60,65 58,55 Q 56,45 48,50" fill="none" stroke="#f1f5f9" strokeWidth="6" strokeLinecap="round" />
                            {/* Body */}
                            <rect x="15" y="50" width="40" height="30" rx="15" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                            {/* Head */}
                            <circle cx="35" cy="38" r="22" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                            {/* Left Ear */}
                            <polygon points="17,23 28,18 25,33" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                            <polygon points="20,25 26,21 24,31" fill="#fda4af" />
                            {/* Right Ear */}
                            <polygon points="53,23 42,18 45,33" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />
                            <polygon points="50,25 44,21 46,31" fill="#fda4af" />
                            {/* Eyes */}
                            <circle cx="28" cy="36" r="2.5" fill="#000" />
                            <circle cx="42" cy="36" r="2.5" fill="#000" />
                            {/* Cheeks */}
                            <circle cx="23" cy="41" r="3" fill="#f43f5e" opacity="0.6" />
                            <circle cx="47" cy="41" r="3" fill="#f43f5e" opacity="0.6" />
                            {/* Mouth */}
                            <path d="M 32,41 Q 35,43 35,41 Q 35,43 38,41" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round" />
                            {/* Paws */}
                            <circle cx="25" cy="78" r="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                            <circle cx="45" cy="78" r="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
                        </g>
                    </svg>
                </div>
            </div>
        );
    }

    // Default: Smoke Effect Theme (smoke)
    return (
        <div className="fixed inset-0 -z-50 bg-[#060810] overflow-hidden pointer-events-none">
            {/* Ambient Shifting Smoke/Gaseous Orbs */}
            <div className="absolute top-[5%] left-[-15%] w-[85vw] h-[85vw] max-w-[550px] max-h-[550px] rounded-full bg-accent/15 blur-[95px] animate-smoke-1" />
            <div className="absolute bottom-[5%] right-[-15%] w-[75vw] h-[75vw] max-w-[500px] max-h-[500px] rounded-full bg-purple-600/10 blur-[95px] animate-smoke-2" />
            <div className="absolute top-[40%] right-[10%] w-[50vw] h-[50vw] max-w-[300px] max-h-[300px] rounded-full bg-blue-500/5 blur-[80px] animate-smoke-3" />
        </div>
    );
}
