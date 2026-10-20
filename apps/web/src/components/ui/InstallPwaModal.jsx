import React, { useState, useEffect } from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/solid';

const InstallPwaModal = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        // Check if the user already dismissed the prompt recently
        const hasDismissed = localStorage.getItem('pwa_install_dismissed');

        // Only show if they haven't dismissed it in the last 24 hours
        const shouldShow = !hasDismissed ||
            (new Date().getTime() - parseInt(hasDismissed, 10)) > 24 * 60 * 60 * 1000;

        const handleBeforeInstallPrompt = (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            if (shouldShow) {
                setDeferredPrompt(e);
                // Show the custom modal
                setIsModalOpen(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Optional: listen for successful installation
        const handleAppInstalled = () => {
            // Clear the prompt
            setDeferredPrompt(null);
            setIsModalOpen(false);
            console.log('PWA was installed');
        };
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            return;
        }
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
        setIsModalOpen(false);
    };

    const handleDismiss = () => {
        setIsModalOpen(false);
        // Record that the user dismissed it so we don't nag them immediately
        localStorage.setItem('pwa_install_dismissed', new Date().getTime().toString());
    };

    if (!isModalOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm shadow-2xl transition-opacity">
            <div className="bg-white dark:bg-[#151C2C] rounded-3xl shadow-2xl w-full max-w-sm flex flex-col relative overflow-hidden transform transition-all">

                {/* Decorative Header Area */}
                <div className="h-32 bg-gradient-to-br from-[#5266EB] to-purple-600 flex items-center justify-center relative">
                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors focus:outline-none"
                        aria-label="Cerrar"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </button>
                    <div className="w-20 h-20 bg-white dark:bg-gray-800 rounded-2xl shadow-lg flex items-center justify-center p-2 absolute -bottom-10 border-4 border-white dark:border-[#151C2C]">
                        {/* Placeholder for App Logo - Ideally replace with your actual transparent logo */}
                        <img src="/icons/icon-192x192.png" alt="Topi Logo" className="w-full h-full object-contain rounded-xl" onError={(e) => {
                            // Fallback if logo not found
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'block';
                        }} />
                        <span style={{ display: 'none' }} className="font-bold text-[#5266EB] text-2xl">Topi</span>
                    </div>
                </div>

                {/* Content */}
                <div className="pt-14 px-6 pb-6 text-center">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Instalar Topi</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                        Añade nuestra aplicación a tu pantalla de inicio para una experiencia más rápida, acceso sin conexión y notificaciones.
                    </p>

                    <div className="flex flex-col space-y-3">
                        <button
                            onClick={handleInstallClick}
                            className="w-full py-3 px-4 bg-[#5266EB] hover:bg-blue-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors shadow-md shadow-blue-500/30"
                        >
                            <ArrowDownTrayIcon className="w-5 h-5" />
                            Instalar Aplicación
                        </button>
                        <button
                            onClick={handleDismiss}
                            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
                        >
                            Ahora no
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InstallPwaModal;
