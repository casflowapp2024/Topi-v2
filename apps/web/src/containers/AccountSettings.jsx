
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
import { XMarkIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/solid';

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
            <div className="sticky top-0 z-20 bg-white/90 dark:bg-[#151C2C]/90 backdrop-blur-md pt-3 px-6 pb-2">
                {/* Header */}
                <h2 className="text-2xl font-bold mr-5 pb-2 text-gray-900 dark:text-white">Configuraciones</h2>

                {/* Navigation Tabs */}
                <div className="flex space-x-6 border-b border-gray-300 dark:border-gray-700 py-2 text-sm font-semibold justify-start">
                    <Link to="profile" className={`${pathname.includes('/profile') ? "border-b-2 border-[#5266EB] text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"} cursor-pointer`}>
                        PERFIL
                    </Link>
                    <Link to="connections" className={`${pathname.includes('/connections') ? "border-b-2 border-[#5266EB] text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"} cursor-pointer`}>
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-2 sm:px-4 py-6 md:py-10">
                <div className="bg-white dark:bg-[#151C2C] rounded-3xl shadow-2xl w-full max-w-[930px] h-full max-h-[774px] flex flex-col overflow-hidden relative">

                    {/* Fixed Header */}
                    <div className="flex-shrink-0 pt-6 px-6 bg-white dark:bg-[#151C2C] border-b border-gray-100 dark:border-gray-800 z-10 flex justify-between items-start">
                        <div className="w-full">
                            <h2 className="text-2xl font-bold mr-5 pb-2 text-gray-900 dark:text-white">Configuraciones</h2>
                            {/* Navigation Tabs */}
                            <div className="flex space-x-6 py-2 text-sm font-semibold justify-start">
                                <button onClick={() => setActiveTab('profile')} className={`${activeTab === 'profile' ? "border-b-2 border-[#5266EB] text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"} cursor-pointer uppercase`}>
                                    PERFIL
                                </button>
                                <button onClick={() => setActiveTab('connections')} className={`${activeTab === 'connections' ? "border-b-2 border-[#5266EB] text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"} cursor-pointer uppercase`}>
                                    CONEXIONES
                                </button>
                            </div>
                        </div>
                        <button onClick={closeSettingsModal} className="p-2 -mr-2 -mt-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none text-gray-400 hover:text-gray-900 dark:hover:text-white flex-shrink-0">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto hide-scrollbar p-6 bg-white dark:bg-[#151C2C] z-0">
                        {activeTab === 'profile' && <ProfileSetts />}
                        {activeTab === 'connections' && <ConexionesSetts />}
                        {activeTab === 'membership' && <Membership />}

                        {/*PopOver UPDATE USER DATA EXTRA*/}
                        <UpdateSetts
                            editField={editField}
                            openUpdateSettsBox={openUpdateSettsBox}
                            setOpenUpdateSettsBox={setOpenUpdateSettsBox}
                        />
                    </div>

                    {/* Fixed Footer */}
                    <div className="flex-shrink-0 pb-6 px-6 pt-4 flex flex-col border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#151C2C] z-10">
                        <div className='w-full h-auto rounded-lg mb-2 overflow-hidden flex-shrink-0 min-h-[1.5rem]'>
                            <Alert />
                        </div>
                        <div className="flex justify-between items-center group">
                            <button onClick={handleLogout} className="flex items-center gap-3 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors font-medium">
                                <ArrowLeftOnRectangleIcon className="w-6 h-6" />
                                <span>Cerrar sesión</span>
                            </button>
                            <span className="text-xs text-gray-400 dark:text-gray-500">Versión 2.0.1</span>
                        </div>
                    </div>
                </div>
            </div>
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