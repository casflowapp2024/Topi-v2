
//react
import { useEffect, useState } from "react";
//react-router
import { Link, useLocation, Outlet } from "react-router-dom";
//redux
import { connect } from 'react-redux';
import { get_user_extra_data } from "../redux/actions/auth";
//components
import Layout from "../hocs/Layout"
import UpdateSetts from '../components/settings/UpdateSetts';
import ProfileSetts from '../components/settings/ProfileSetts';
import ConexionesSetts from '../components/settings/ConexionesSetts';
import Membership from '../components/settings/Membership';
import Alert from '../components/alert';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/20/solid';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

export const SETTINGS_TABS = [
    { id: 'profile', label: 'Perfil' },
    { id: 'connections', label: 'Conexiones' },
];

const AccountSettings = ({
    user,
    get_user_extra_data,
    isModal = false,
    activeTab: propActiveTab = 'profile',
    closeSettingsModal,
    handleLogout
}) => {

    useEffect(() => {
        window.scrollTo(0, 0);
        get_user_extra_data();
    }, []);

    useEffect(() => {
        if (isModal && propActiveTab) {
            setActiveTab(propActiveTab);
        }
    }, [propActiveTab, isModal]);

    const location = useLocation();
    const { pathname } = location;

    //edit email, name, lastname
    const [editField, setEditField] = useState(null)
    const [openUpdateSettsBox, setOpenUpdateSettsBox] = useState(false)
    const [activeTab, setActiveTab] = useState('profile')

    /* const handleOpenEditField = (fieldId, initialValue) => {
        setEditField(fieldId)
        setEditFieldValue(initialValue)
        setOpenUpdateSettsBox(true)
    }

    const handleClosePopover = () => {
        setOpenUpdateSettsBox(false); // Hide the popover
        setEditField(null); // Clear the active field
        setAuthValue("")
    }; */

    //CONEXIONES SECTION


    const content = (
        <div className="max-w-5xl mx-auto font-sans relative flex flex-col h-full w-full">
            {/* Header anclado (Sticky) */}
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-surface-raised/90 backdrop-blur-md pt-3 px-6 pb-2">
                {/* Header */}
                <h2 className="text-2xl font-bold mr-5 pb-2 text-gray-900 dark:text-white">Configuraciones</h2>

                {/* Navigation Tabs */}
                <div className="flex space-x-6 border-b border-gray-300 dark:border-gray-700 py-2 text-sm font-semibold justify-start">
                    <Link to="profile" className={`${pathname.includes('/profile') ? "border-b-2 border-topi-500 text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"} cursor-pointer`}>
                        PERFIL
                    </Link>
                    <Link to="connections" className={`${pathname.includes('/connections') ? "border-b-2 border-topi-500 text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"} cursor-pointer`}>
                        CONEXIONES
                    </Link>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto mt-2 px-6 pb-6 relative z-0">
                <Outlet />
            </div>

            {/*PopOver UPDATE USER DATA EXTRA*/}
            <UpdateSetts
                editField={editField}
                openUpdateSettsBox={openUpdateSettsBox}
                setOpenUpdateSettsBox={setOpenUpdateSettsBox}
            />
        </div>
    );

    if (isModal) {
        if (!user) return null;

        return (
            <Modal open onClose={closeSettingsModal} title="Configuración" size="2xl" bodyClassName="p-0"
                className="h-[92dvh] sm:h-[min(774px,90vh)]"
                footer={
                    <div className="!w-full flex flex-col gap-2">
                        <div className="w-full overflow-hidden rounded-lg empty:hidden">
                            <Alert />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <Button variant="ghost" icon={ArrowRightStartOnRectangleIcon} onClick={handleLogout}
                                className="!px-2 -ml-2 !text-ink-2 dark:!text-gray-400 hover:!text-status-crit-text dark:hover:!text-red-400">
                                Cerrar sesión
                            </Button>
                            <span className="text-xs text-ink-2 dark:text-gray-400">Versión 2.0.1</span>
                        </div>
                    </div>
                }>
                {/* pestañas fijas arriba del contenido */}
                <div role="tablist" aria-label="Secciones de configuración"
                    className="sticky top-0 z-10 flex gap-6 px-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-raised">
                    {SETTINGS_TABS.map(t => {
                        const on = activeTab === t.id;
                        return (
                            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setActiveTab(t.id)}
                                className={`-mb-px py-3 text-sm font-semibold border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 rounded-t ${on
                                    ? 'border-topi-500 text-gray-900 dark:text-white'
                                    : 'border-transparent text-ink-2 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'}`}>
                                {t.label}
                            </button>
                        );
                    })}
                </div>

                <div role="tabpanel" className="px-5 py-5">
                    {activeTab === 'profile' && <ProfileSetts />}
                    {activeTab === 'connections' && <ConexionesSetts />}
                    {activeTab === 'membership' && <Membership />}
                </div>

                {/*PopOver UPDATE USER DATA EXTRA*/}
                <UpdateSetts
                    editField={editField}
                    openUpdateSettsBox={openUpdateSettsBox}
                    setOpenUpdateSettsBox={setOpenUpdateSettsBox}
                />
            </Modal>
        );
    }

    return (
        <Layout>
            {user ? content : <></>}
        </Layout>
    )
}

const mapStateToProps = state => ({
    user: state.Auth.user,
})

export default connect(mapStateToProps, {
    get_user_extra_data

})(AccountSettings)