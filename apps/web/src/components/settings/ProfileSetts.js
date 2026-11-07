//react
import { useEffect, useState } from "react";
//redux
import { connect } from 'react-redux';
import { get_user_extra_data, update_user_extra_data, update_user_config, set_theme } from "../../redux/actions/auth";
import { setAlert } from "../../redux/actions/alert";
//components
import { UserIcon, ChevronDownIcon, LanguageIcon, GlobeAmericasIcon, CheckIcon } from '@heroicons/react/24/outline'
import { timezones_list } from '../info_arrays';
import { useRef } from 'react';
import Alert from "../alert";
import ChangePasswordCard from "./ChangePasswordCard";
import BaseCurrencyCard from "./BaseCurrencyCard";
import ThemeSwitch from '../ui/ThemeSwitch';
import { themePreference } from '../ui/theme';

const CustomSelect = ({ name, value, options, onChange, Icon, menuUp = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const selectedOption = options.find(opt => String(opt.value) === String(value)) || options[0] || {};

    return (
        <div ref={wrapperRef} className="relative w-full">
            <button
                type="button"
                className="w-full flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3.5 text-left focus:outline-none ring-1 ring-transparent focus:ring-topi-500/50 transition-all duration-200 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 group"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gray-50 dark:bg-gray-900 rounded-xl text-gray-400 group-hover:text-topi-500 transition-colors duration-200">
                        {Icon && <Icon className="w-[22px] h-[22px]" />}
                    </div>
                    <div>
                        <span className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">{selectedOption?.label_top || "Opción"}</span>
                        <span className="block text-gray-800 dark:text-gray-200 font-semibold text-sm">{selectedOption?.label}</span>
                    </div>
                </div>
                <div className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-900 transition-transform duration-300 ${isOpen ? 'rotate-180 bg-topi-500/10' : ''}`}>
                    <ChevronDownIcon className={`w-4 h-4 text-gray-400 ${isOpen ? 'text-topi-500' : ''}`} />
                </div>
            </button>

            <div
                className={`absolute z-50 w-full bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-xl max-h-64 overflow-y-auto py-2 custom-scrollbar transition-all duration-200 
                ${menuUp ? 'bottom-full mb-2 origin-bottom' : 'mt-1 origin-top'}
                ${isOpen ? (menuUp ? 'opacity-100 scale-100 translate-y-0' : 'opacity-100 scale-100 translate-y-0') : (menuUp ? 'opacity-0 scale-95 translate-y-2 pointer-events-none' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none')}`}
            >
                {options.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className={`w-full text-left px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between
                            ${String(value) === String(option.value) ? 'bg-topi-500/5 dark:bg-topi-500/10' : ''}`}
                        onClick={() => {
                            onChange({ target: { name, value: option.value } });
                            setIsOpen(false);
                        }}
                    >
                        <span className={`font-medium text-sm ${String(value) === String(option.value) ? 'text-topi-500 dark:text-topi-200' : 'text-gray-700 dark:text-gray-300'}`}>
                            {option.label}
                        </span>
                        {String(value) === String(option.value) && (
                            <CheckIcon className="w-5 h-5 text-topi-500 dark:text-topi-200" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
};

const ProfileSetts = ({
    user,
    user_extra,
    update_user_extra_data,
    get_user_extra_data,
    update_user_config,
    set_theme,
    setAlert
}) => {

    const zeroData = {
        num: '',
        timezone: '',
        birthday: '',
        local_currency: '',
        language: ''
    }

    //load form data
    const [updateUserExtraData, setUpdateUserExtraData] = useState(zeroData);
    const [dataLoaded, setDataLoaded] = useState(false)

    useEffect(() => {
        if (user_extra) {
            setUpdateUserExtraData({
                num: user_extra.whatsapp ?? '',
                timezone: user_extra.utc_offset ?? '',
                birthday: user_extra.birthday ?? '',
                local_currency: user_extra.local_currency ?? '',
                language: user_extra.language ?? ''
            });
            setDataLoaded(true)
        }
    }, [user_extra]);


    const onChangeUpdate = async (e) => {
        const { name, value } = e.target;

        setUpdateUserExtraData({
            ...updateUserExtraData,
            [name]: value
        });
    };

    useEffect(() => {
        if (dataLoaded && (updateUserExtraData.timezone !== user_extra.utc_offset)) {
            onSubmitSendToServer()
        }
    }, [updateUserExtraData]);


    const onSubmitSendToServer = async () => {
        const updated = await update_user_extra_data(
            parseInt(updateUserExtraData.timezone),
            updateUserExtraData.num,
            user_extra.onboarding_completed,
            updateUserExtraData.birthday,
            updateUserExtraData.local_currency,
            updateUserExtraData.language
        )
        if (updated) {
            get_user_extra_data()
            setAlert("Información actualizada", true, "text-white", "bg-green-500", 3000);
        } else {
            setAlert("Error al actualizar información", false, "text-white", "bg-red-500", 3000);
        }
    }

    const markOnboardingComplete = async () => {
        const updated = await update_user_extra_data(
            user_extra.utc_offset,
            user_extra.whatsapp,
            true,
            user_extra.birthday,
            user_extra.local_currency,
            user_extra.language
        )
        if (updated) {
            get_user_extra_data();
            setAlert("Onboarding marcado como completado", true, "text-white", "bg-green-500", 3000);
        } else {
            setAlert("Error al actualizar el estado", false, "text-white", "bg-red-500", 3000);
        }
    };

    return (
        <>
            <div className="px-1 md:px-0">
                <div className="flex items-center space-x-5 p-4 md:p-6 bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm">
                    <div className="relative w-20 h-20 bg-gradient-to-tr from-topi-500/20 to-topi-500/5 rounded-2xl flex items-center justify-center shadow-inner">
                        <UserIcon className="h-10 w-10 text-topi-500" />
                    </div>
                    <div className='flex flex-col justify-center space-y-1.5'>
                        <p className="font-bold text-xl text-gray-900 dark:text-white capitalize tracking-tight">{user.name} {user.lastName} </p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">{user.email}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preferences */}
            <div className="mt-8 px-1 md:px-0 pb-20">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6 pl-2 tracking-tight">Preferencias del Sistema</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                    <BaseCurrencyCard />

                    <CustomSelect
                        name="language"
                        value={updateUserExtraData.language || "ES"}
                        onChange={onChangeUpdate}
                        Icon={LanguageIcon}
                        options={[
                            { value: "ES", label: "Español", label_top: "Idioma" },
                            { value: "EN", label: "Inglés", label_top: "Idioma" }
                        ]}
                    />

                    <CustomSelect
                        name="timezone"
                        value={updateUserExtraData.timezone}
                        onChange={onChangeUpdate}
                        Icon={GlobeAmericasIcon}
                        options={timezones_list.map(tz => ({ ...tz, label_top: "Zona Horaria" }))}
                        menuUp={true}
                    />
                </div>
            </div>

            {/* Visual Preferences & Experience */}
            <div className="mt-8 px-1 md:px-0 pb-20">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6 pl-2 tracking-tight">Preferencias Visuales y Experiencia</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
                        <p className="text-xs font-medium text-ink-2 dark:text-gray-400 mb-2">Tema</p>
                        <ThemeSwitch
                            value={themePreference(user_extra?.config)}
                            onChange={async (t) => {
                                const ok = await set_theme(t);
                                if (!ok) setAlert("Error al actualizar el tema", false, "text-white", "bg-red-500", 3000);
                            }}
                        />
                    </div>

                    {!user_extra.onboarding_completed && (
                        <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 shadow-sm">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Onboarding</h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Marcar flujo inicial como completado</p>
                            </div>
                            <button
                                onClick={markOnboardingComplete}
                                className="bg-topi-500 hover:bg-topi-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                            >
                                Completar
                            </button>
                        </div>
                    )}

                    <ChangePasswordCard />
                </div>
            </div>
        </>
    )
}

const mapStateToProps = state => ({
    user: state.Auth.user,
    user_extra: state.Auth.user_extra_data,
})

export default connect(mapStateToProps, {
    get_user_extra_data,
    update_user_extra_data,
    update_user_config,
    set_theme,
    setAlert
})(ProfileSetts)
