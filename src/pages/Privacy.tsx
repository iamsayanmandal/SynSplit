import { motion } from 'framer-motion';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Privacy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen min-h-[100dvh] bg-dark-950">
            <div className="max-w-lg mx-auto px-4 py-6 pb-24">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-dark-800 transition-colors">
                        <ArrowLeft className="w-5 h-5 text-dark-300" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-accent-light" />
                        <h1 className="text-xl font-bold text-white">Privacy Policy & Terms</h1>
                    </div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                >
                    {/* Privacy Policy */}
                    <div className="glass-card p-5 space-y-4">
                        <h2 className="text-base font-bold text-white">Privacy Policy</h2>
                        <div className="text-xs text-dark-300 space-y-3 leading-relaxed">
                            <p>
                                <span className="text-white font-medium">Last updated:</span> 28 February 2025 · 04:00 AM
                            </p>
                            <p>
                                SynSplit ("the App") is a free expense management application developed by <strong className="text-white">Sayan Mandal</strong>. This Privacy Policy explains how we collect, use, and protect your information.
                            </p>

                            <h3 className="text-sm font-semibold text-white pt-2">1. Information We Collect</h3>
                            <p>When you sign in with Google, we receive your name, email address, and profile photo. We also store expense data, group information, and usage analytics that you create within the App.</p>

                            <h3 className="text-sm font-semibold text-white pt-2">2. How We Use Your Information</h3>
                            <p>Your information is used solely to provide the expense tracking and splitting features of SynSplit. We use Google Analytics to understand app usage patterns and improve the experience.</p>

                            <h3 className="text-sm font-semibold text-white pt-2">3. Data Sharing</h3>
                            <p>We do <strong className="text-white">NOT</strong> sell, share, or distribute your personal data to any third parties for commercial purposes. Your expense data is only visible to members of your groups.</p>

                            <h3 className="text-sm font-semibold text-white pt-2">4. Data Storage & Security</h3>
                            <p>All data is stored securely on Google Firebase (Cloud Firestore) with strict access rules. Only authenticated users can access their own data and group data they belong to.</p>

                            <h3 className="text-sm font-semibold text-white pt-2">5. Data Retention</h3>
                            <p>Your data is retained as long as your account is active. If you wish to delete your data, contact the developer at sayanmandal568@gmail.com.</p>

                            <h3 className="text-sm font-semibold text-white pt-2">6. Cookies & Tracking</h3>
                            <p>We use Google Analytics (GA4) to collect anonymous usage data such as page views, session duration, and device information. No personally identifiable information is shared with analytics services.</p>
                        </div>
                    </div>

                    {/* Terms of Service */}
                    <div className="glass-card p-5 space-y-4">
                        <h2 className="text-base font-bold text-white">Terms of Service</h2>
                        <div className="text-xs text-dark-300 space-y-3 leading-relaxed">
                            <p>
                                <span className="text-white font-medium">1. Nature of Service:</span> SynSplit is a free, personal project developed by Sayan Mandal. It is provided "as-is" with no warranties of any kind.
                            </p>
                            <p>
                                <span className="text-white font-medium">2. Data Usage:</span> No user data will be sold, shared, or used for commercial purposes. Data may be used solely to monitor active users and improve the application.
                            </p>
                            <p>
                                <span className="text-white font-medium">3. User Responsibility:</span> Users are solely responsible for the accuracy of their expense data. The developer (Sayan Mandal) is not liable for any financial discrepancies, data loss, or decisions made based on this application.
                            </p>
                            <p>
                                <span className="text-white font-medium">4. Service Availability:</span> The developer reserves the right to block any user, modify, or shut down this project at any time without prior notice.
                            </p>
                            <p>
                                <span className="text-white font-medium">5. Changes to Terms:</span> These Terms of Service may be updated at any time. Continued use of SynSplit constitutes acceptance of the current and any future terms.
                            </p>
                            <p>
                                <span className="text-white font-medium">6. Limitation of Liability:</span> Sayan Mandal and any associated parties are not responsible for any direct, indirect, or consequential damages arising from the use of this application.
                            </p>
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="glass-card p-5">
                        <h2 className="text-base font-bold text-white mb-2">Contact</h2>
                        <p className="text-xs text-dark-300">
                            For any questions or concerns regarding this Privacy Policy or Terms of Service, please contact:
                        </p>
                        <a href="mailto:sayanmandal568@gmail.com" className="text-xs text-accent-light hover:underline mt-1 block">
                            sayanmandal568@gmail.com
                        </a>
                    </div>

                    <p className="text-[10px] text-dark-500 text-center pt-2">
                        By using SynSplit, you agree to all the above terms and any future modifications.
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
