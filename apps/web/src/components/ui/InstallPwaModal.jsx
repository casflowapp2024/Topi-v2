import React, { useState, useEffect } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/20/solid';
import Modal from './Modal';
import Button from './Button';

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

    return (
        <Modal open={isModalOpen} onClose={handleDismiss} title="Instalar Topi" size="sm"
            footer={<>
                <Button variant="ghost" onClick={handleDismiss}>Ahora no</Button>
                <Button icon={ArrowDownTrayIcon} onClick={handleInstallClick}>Instalar aplicación</Button>
            </>}>
            <div className="flex flex-col items-center gap-4 text-center">
                <span className="w-20 h-20 rounded-2xl bg-topi-50 dark:bg-topi-500/15 flex items-center justify-center p-2">
                    <img src="/icons/icon-192x192.png" alt="" className="w-full h-full object-contain rounded-xl"
                        onError={(e) => { e.target.style.display = 'none'; }} />
                </span>
                <p className="text-sm text-ink-2 dark:text-gray-300">
                    Añade nuestra aplicación a tu pantalla de inicio para una experiencia más rápida, acceso sin conexión y notificaciones.
                </p>
            </div>
        </Modal>
    );
};

export default InstallPwaModal;
