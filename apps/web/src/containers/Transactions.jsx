//react
import { useEffect, useState, useRef, useMemo } from "react";
//redux
import { connect } from 'react-redux';
import {
    get_user_transactions,
    update_transaction,
    update_transaction_local
} from "../redux/actions/cashflow";

//components
//components
//import Layout from "../hocs/Layout"
import TransactionDetail from "../components/transactions/TransactionDetail2";
import { formatMoney, formatDate, capitalizeWords, accountClass } from "../components/helpers";
import { ACCOUNT_GROUPS } from "../components/dashboard/productsAccounts/accountGroups";
import { groupByDay, dayLabel, dayNet, installmentsNote, isNeutral } from "../components/transactions/transactionDays";

import TransactionFilterSheet, { countPanelFilters } from "../components/transactions/TransactionFilterSheet";
import Chip from "../components/ui/Chip";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import Money from "../components/ui/Money";
import { SkeletonRows } from "../components/ui/Skeleton";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import CreateTransaction from "../components/transactions/CreateTransaction";
import TransferModal from "../components/transactions/TransferModal";
import TransferCandidatesModal from "../components/transactions/TransferCandidatesModal";
import { fetch_transfer_candidates } from "../redux/actions/transfers";
//icons
import {
    PlusIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon,
    ArrowDownTrayIcon, ArrowsRightLeftIcon
} from '@heroicons/react/20/solid'
import { FunnelIcon, ExclamationTriangleIcon, ChevronDownIcon, Squares2X2Icon, SparklesIcon } from '@heroicons/react/20/solid'

import { EnvelopeIcon } from '@heroicons/react/24/outline'

import { Emoji } from "emoji-picker-react";
import { Link } from "react-router-dom";
import { change_transactions_filter, filtersFromState } from "../redux/actions/cashflow";

const QUICK = [
    { id: 'all', label: 'Todas', icon: Squares2X2Icon },
    { id: 'verify', label: 'Por revisar', icon: ExclamationTriangleIcon },
    { id: 'new', label: 'Nuevas', icon: SparklesIcon },
    { id: 'transfer', label: 'Transferencias', icon: ArrowsRightLeftIcon },
];

// En PC la lista es una tabla: ícono · descripción · categoría · cuenta · monto · estado. Así el espacio lleva datos
// y el monto va pegado a la descripción (con su estado al lado) en vez de al otro extremo de la fila.
// Orden en PC: ícono · descripción · monto · estado · categoría · cuenta. Encabezado, días y filas comparten columnas.
export const TX_COLUMNS = 'lg:grid lg:grid-cols-[1.5rem_minmax(0,2fr)_minmax(7.5rem,0.8fr)_1rem_minmax(0,1fr)_minmax(0,1fr)] lg:gap-x-4';

// Tipo de cuenta con el mismo ícono de la vista Cuentas (efectivo, tarjeta, inversión)
const AccountTypeIcon = ({ account }) => {
    const group = ACCOUNT_GROUPS.find(g => g.id === accountClass(account));
    if (!group) return null;
    const Icon = group.Icon;
    return (
        <span title={group.label} className="shrink-0 inline-flex text-gray-400 dark:text-gray-500">
            <Icon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">{group.label}: </span>
        </span>
    );
};

const TransactionsHeader = () => (
    <div aria-hidden="true" className={`hidden ${TX_COLUMNS} px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs font-medium text-ink-2 dark:text-gray-400`}>
        <span />
        <span>Descripción</span>
        <span className="text-right">Monto</span>
        <span />
        <span>Categoría</span>
        <span>Cuenta</span>
    </div>
);

// Fila de un movimiento. Las transferencias van neutrales: ícono ↔ y monto sin signo ni color de flujo.
const TransactionRow = ({ tx, onOpen, account }) => {
    const neutral = isNeutral(tx);
    return (
        <li>
            <button type="button" onClick={() => onOpen(tx.id)}
                className={`w-full px-3 md:px-4 py-2 flex items-center gap-3 ${TX_COLUMNS} lg:items-center text-left hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-topi-500 transition-colors duration-150`}>
                <span className="lg:order-1 w-6 h-6 shrink-0 flex items-center justify-center">
                    {tx.transfer_group_id ? (
                        <span title="Transferencia entre tus cuentas" className="text-data-transfer dark:text-slate-300"><ArrowsRightLeftIcon className="w-5 h-5" aria-hidden="true" /><span className="sr-only">Transferencia</span></span>
                    ) : tx.category?.emoji ? (
                        <Emoji unified={tx.category.emoji.toLowerCase()} emojiStyle="apple" size={20} />
                    ) : null}
                </span>
                <span className="lg:order-2 flex-1 min-w-0 flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{tx.description}</span>
                    <span className="lg:hidden text-xs text-ink-2 dark:text-gray-400 truncate">{capitalizeWords(tx.category?.name)} · {tx.account?.name}</span>
                </span>
                <span className="hidden lg:block lg:order-5 min-w-0 text-sm text-ink-2 dark:text-gray-300 truncate">{capitalizeWords(tx.category?.name)}</span>
                <span className="hidden lg:flex lg:order-6 min-w-0 items-center gap-1.5 text-sm text-ink-2 dark:text-gray-300">
                    <AccountTypeIcon account={account || tx.account} />
                    <span className="truncate">{tx.account?.name}</span>
                </span>
                <span className="shrink-0 flex items-center gap-1.5 lg:contents">
                    <span className="lg:order-3 lg:flex lg:justify-end lg:min-w-0">
                    <Money amount={tx.amount} currency={tx.currency} base={tx.amount_base} note={installmentsNote(tx)}
                        sign={neutral ? '' : tx.expense ? '-' : '+'}
                        className={`text-sm font-semibold tabular-nums ${neutral ? 'text-data-transfer dark:text-slate-300' : tx.expense ? 'text-gray-900 dark:text-gray-100' : 'text-money-in dark:text-money-in-dark'}`} />
                    </span>
                    <span className="lg:order-4 w-4 flex justify-center">
                        {tx.needs_counterpart ? (
                            <span title="Falta elegir la cuenta con que pagaste" className="inline-flex items-center text-status-warn-text dark:text-amber-300"><ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Falta elegir la cuenta con que pagaste</span></span>
                        ) : tx.should_verify === true ? (
                            <span title="Por revisar" className="inline-flex items-center text-status-warn-text dark:text-amber-300"><ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Por revisar</span></span>
                        ) : tx.checked === false ? (
                            <span title="Nuevo" className="inline-flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-topi-500" aria-hidden="true" /><span className="sr-only">Nuevo</span></span>
                        ) : null}
                    </span>
                </span>
            </button>
        </li>
    );
};

const Transactions = ({
    get_user_transactions,
    user_transactions,
    user_accounts,
    user_categories,
    update_transaction,
    update_transaction_local,
    change_transactions_filter,
    trans_filters_activated,
    default_limit,

}) => {

    // Al entrar: cargar la primera página con los filtros que estén puestos (antes la cargaba el
    // panel de filtros viejo al montarse; sin él, la lista se quedaba en "Cargando...")
    useEffect(() => {
        get_user_transactions(0, default_limit, trans_filters_activated.params);
        setCurrentFrontendPage(1);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const findElmentById = (elements, id) => {
        const element = elements.find(element => element.id === id);
        return element ? element : null; // Return the name if found, otherwise null
    };


    //INFOR POR DETAIL MODAL
    const [detailInfo, setDetailInfo] = useState(null)
    const [openTransDetail, setOpenTransDetail] = useState(false)


    const handleOpenTransDetail = async (transactionId) => {
        const selectedTransaction = findElmentById(user_transactions.items, transactionId)

        setDetailInfo(selectedTransaction)
        setOpenTransDetail(true);
        if ((selectedTransaction.checked === false) || (selectedTransaction.should_verify === true)) {
            // Update database
            const updateResponse = await update_transaction(
                transactionId,
                selectedTransaction.category?.id,
                selectedTransaction.account?.id,
                selectedTransaction.description,
                selectedTransaction.expense,
                selectedTransaction.amount,
                selectedTransaction.date,
                true
            );
            // Update local state immediately
            if (updateResponse === true) {
                const updatedTransaction = {
                    ...selectedTransaction,
                    checked: true,
                    should_verify: false
                };
                update_transaction_local(transactionId, updatedTransaction);
            }
        }
    }

    const handleCloseTransDetail = () => {
        /* document.body.style.paddingRight = '0px';
        document.body.style.overflow = 'unset'; */
        setDetailInfo(null)
        setOpenTransDetail(false);
        loadTransferCandidates()
    }

    //POSIBLES TRANSFERENCIAS (parejas salida/entrada entre cuentas propias sin ligar)
    const [transferCandidates, setTransferCandidates] = useState(null)
    const [openCandidates, setOpenCandidates] = useState(false)
    const loadTransferCandidates = () => {
        fetch_transfer_candidates().then(list => { if (list) setTransferCandidates(list) })
    }
    useEffect(() => { loadTransferCandidates() }, [])

    //CREATE TRANSACTION POPUP
    const [openCreatePopUp, SetOpenCreatePopUp] = useState(false)
    const [openTransfer, setOpenTransfer] = useState(false)
    const handleOpenCreatePopUp = () => {
        /*  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
         document.body.style.paddingRight = `0px`;
         document.body.style.overflow = 'hidden'; */
        SetOpenCreatePopUp(true);
    }

    const handleCloseCreatePopUp = () => {
        /* document.body.style.paddingRight = '0px';
        document.body.style.overflow = 'unset'; */
        //document.html.style.overflow = 'unset';
        SetOpenCreatePopUp(false);
    }

    //FILTROS
    const [openFilterPopUp, setOpenFilterPopUp] = useState(false)
    const panelFilters = countPanelFilters(trans_filters_activated)
    const quickStatus = trans_filters_activated.shouldVerify ? 'verify'
        : trans_filters_activated.checked === false ? 'new'
            : trans_filters_activated.transfer === true ? 'transfer' : 'all'
    const anyFilter = panelFilters > 0 || quickStatus !== 'all' || !!trans_filters_activated.keyword

    // Aplica filtros sobre los actuales (patch con nombres de change_transactions_filter) y vuelve a la página 1
    const applyFilters = async (patch) => {
        const params = await change_transactions_filter(filtersFromState(trans_filters_activated, patch))
        await get_user_transactions(0, default_limit, params)
        setCurrentFrontendPage(1)
    }
    const applyQuick = (id) => applyFilters({
        shouldVerify: id === 'verify' ? true : '',
        checked: id === 'new' ? false : '',
        transfer: id === 'transfer' ? true : '',
    })
    const clearAllFilters = () => applyFilters({
        selectedCategories: [], selectedAccounts: [], iniDate: '', endDate: '', keyword: '',
        expenseFilter: '', automated: '', shouldVerify: '', checked: '', transfer: '',
    })

    //pagination
    const [currentFrontendPage, setCurrentFrontendPage] = useState(1);
    const [firstOfBatch, setFirstOfBatch] = useState(1)
    const [lastOfBatch, setLastOfBatch] = useState(1)
    const [loadingNextPage, setLoadingNextPage] = useState(false)



    useEffect(() => {
        if (user_transactions.items && user_transactions.items.length > 0) {

            setFirstOfBatch(currentFrontendPage * default_limit - (default_limit - 1))
            setLastOfBatch(user_transactions.total < currentFrontendPage * default_limit ? user_transactions.total : currentFrontendPage * default_limit)
        }

    }, [user_transactions, currentFrontendPage]);



    const lastPageCalc = (total) => {
        if (total % default_limit === 0) {
            return parseInt(total / default_limit)
        } else {
            return parseInt(user_transactions.total / default_limit) + 1
        }
    }

    const handleNextBatch = async () => {
        setLoadingNextPage(true)
        const transResponse = await get_user_transactions(
            (currentFrontendPage) * default_limit,
            default_limit, trans_filters_activated.params)
        if (transResponse === true) {
            setCurrentFrontendPage(currentFrontendPage + 1)
            setLoadingNextPage(false)
        } else {
            setLoadingNextPage(false)
            alert('No se pudo cambiar de pagina')
        }
    }

    const hnadlePrevBatch = async () => {
        setLoadingNextPage(true)
        const transResponse = await get_user_transactions(
            (currentFrontendPage - 2) * default_limit,
            default_limit, trans_filters_activated.params)
        if (transResponse === true) {
            setCurrentFrontendPage(currentFrontendPage - 1)
            setLoadingNextPage(false)
        } else {
            setLoadingNextPage(false)
            alert('No se pudo cambiar de pagina')
        }
    }

    //SEARCH BAR

    const handleSearch = async (e) => {
        const params = await change_transactions_filter(filtersFromState(trans_filters_activated, { keyword: e.target.value }));
        await get_user_transactions(0, default_limit, params);
        setCurrentFrontendPage(1);
    };


    //dowload button

    const downloadTRX = () => {
        if (!user_transactions || !user_transactions.items || user_transactions.items.length === 0) {
            alert("No hay transacciones para descargar en la página actual.");
            return;
        }

        const escapeCSV = (field) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (str.search(/("|,|\n)/g) >= 0) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = ["Fecha", "Descripción", "Monto", "Tipo", "Categoría", "Cuenta"];
        const csvRows = [headers.join(',')];

        user_transactions.items.forEach(trx => {
            const row = [
                escapeCSV(formatDate(trx.date)),
                escapeCSV(trx.description),
                trx.amount,
                escapeCSV(trx.expense ? "Gasto" : "Ingreso"),
                escapeCSV(trx.category.name),
                escapeCSV(trx.account.name)
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        const today = new Date().toISOString().slice(0, 10);

        link.setAttribute("href", url);
        link.setAttribute("download", `transacciones-${today}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    //transactions by date

    const days = useMemo(() => groupByDay(user_transactions.items), [user_transactions.items]);
    // para el ícono del tipo de cuenta en cada fila (la transacción trae solo id y nombre de la cuenta)
    const accountsById = useMemo(() => new Map((user_accounts?.items || []).map(a => [String(a.id), a])), [user_accounts]);

    return (
        <>

            <div className="top-0 flex justify-center">
                <div className="w-full top-0">
                    <div className="">

                        <div className="top-0 rounded-2xl shadow-md bg-white dark:bg-gray-800 w-full transition-colors duration-300">
                            {/* Barra fija: buscar, crear, filtrar y encabezados quedan visibles al hacer scroll */}
                            <div className="sticky top-[53px] md:top-[62px] z-30 bg-white dark:bg-gray-800 rounded-t-2xl shadow-[0_1px_0_0_rgba(0,0,0,0.04)] transition-colors duration-300">
                            {/* Barra de herramientas: buscar, filtros y nuevo + filtros rápidos */}
                            <div className="p-3 md:p-4 flex flex-col gap-2.5">
                                <div className="flex items-center gap-2">
                                    <label className="flex-1 min-w-0 h-10 px-3 md:px-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center gap-2 bg-gray-100 dark:bg-gray-900 focus-within:ring-2 focus-within:ring-topi-500 transition-colors">
                                        <MagnifyingGlassIcon className="w-5 h-5 shrink-0 text-gray-400" aria-hidden="true" />
                                        <input
                                            type="search"
                                            placeholder="Buscar por descripción"
                                            aria-label="Buscar por descripción"
                                            className="w-full min-w-0 bg-transparent text-sm md:text-base dark:text-gray-100 outline-none placeholder:text-gray-400"
                                            value={trans_filters_activated.keyword}
                                            onChange={(e) => handleSearch(e)}
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setOpenFilterPopUp(true)}
                                        aria-label={panelFilters ? `Filtros (${panelFilters} activos)` : 'Filtros'}
                                        className={`relative shrink-0 h-10 px-3 rounded-2xl border flex items-center gap-2 text-sm font-medium transition-colors ${panelFilters
                                            ? 'border-topi-500 text-topi-600 dark:text-indigo-300 bg-topi-50 dark:bg-indigo-500/10'
                                            : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                    >
                                        <FunnelIcon className="w-4 h-4" aria-hidden="true" />
                                        <span className="hidden md:inline">Filtros</span>
                                        {panelFilters > 0 && (
                                            <span className="min-w-[20px] h-5 px-1 rounded-full bg-topi-500 text-white text-xs flex items-center justify-center">{panelFilters}</span>
                                        )}
                                    </button>
                                    <Menu as="div" className="relative shrink-0">
                                        {/* Discreto a propósito: las transacciones llegan solas, digitar es la excepción */}
                                        <MenuButton className="h-10 px-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 focus-visible:ring-offset-2"
                                            aria-label="Agregar movimiento">
                                            <PlusIcon className="w-5 h-5" aria-hidden="true" />
                                            <span className="hidden md:inline">Agregar</span>
                                            <ChevronDownIcon className="hidden md:block w-4 h-4 opacity-80" aria-hidden="true" />
                                        </MenuButton>
                                        <MenuItems anchor={{ to: 'bottom end', gap: 6 }}
                                            className="z-50 w-60 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1.5 shadow-xl focus:outline-none">
                                            <MenuItem>
                                                <button type="button" onClick={handleOpenCreatePopUp}
                                                    className="w-full flex items-start gap-3 rounded-xl px-3 py-2 text-left data-[focus]:bg-gray-100 dark:data-[focus]:bg-gray-700">
                                                    <PlusIcon className="w-5 h-5 mt-0.5 text-topi-500" aria-hidden="true" />
                                                    <span className="flex flex-col">
                                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gasto o ingreso</span>
                                                        <span className="text-xs text-ink-2 dark:text-gray-400">Registrar un movimiento</span>
                                                    </span>
                                                </button>
                                            </MenuItem>
                                            <MenuItem>
                                                <button type="button" onClick={() => setOpenTransfer(true)}
                                                    className="w-full flex items-start gap-3 rounded-xl px-3 py-2 text-left data-[focus]:bg-gray-100 dark:data-[focus]:bg-gray-700">
                                                    <ArrowsRightLeftIcon className="w-5 h-5 mt-0.5 text-slate-500" aria-hidden="true" />
                                                    <span className="flex flex-col">
                                                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Transferencia</span>
                                                        <span className="text-xs text-ink-2 dark:text-gray-400">Entre tus cuentas, no cuenta como gasto</span>
                                                    </span>
                                                </button>
                                            </MenuItem>
                                        </MenuItems>
                                    </Menu>
                                </div>

                                {/* Filtros rápidos (una fila que se desliza en móvil) */}
                                <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar -mx-3 px-3 md:mx-0 md:px-0" role="group" aria-label="Filtros rápidos">
                                    {QUICK.map(q => (
                                        <Chip key={q.id} icon={q.icon} selected={quickStatus === q.id} onClick={() => applyQuick(q.id)}>{q.label}</Chip>
                                    ))}
                                    {transferCandidates && transferCandidates.length > 0 && (
                                        <Chip tone="accent" icon={ArrowsRightLeftIcon} count={transferCandidates.length}
                                            onClick={() => { setOpenCandidates(true); loadTransferCandidates() }}
                                            title="Parejas de salida y entrada entre tus cuentas que podrían ser una transferencia">
                                            Posibles transferencias
                                        </Chip>
                                    )}
                                    {anyFilter && (
                                        <button type="button" onClick={clearAllFilters}
                                            className="shrink-0 h-8 px-2 text-sm font-medium text-topi-600 dark:text-indigo-300 hover:underline">
                                            Quitar filtros
                                        </button>
                                    )}
                                </div>
                            </div>

                            {user_transactions.total > 0 && <TransactionsHeader />}

                            <CreateTransaction
                                openCreatePopUp={openCreatePopUp}
                                SetOpenCreatePopUp={handleCloseCreatePopUp}
                                currentFrontendPage={currentFrontendPage}
                            />
                            <TransferModal open={openTransfer} onClose={() => { setOpenTransfer(false); loadTransferCandidates() }} />
                            <TransferCandidatesModal open={openCandidates} onClose={() => setOpenCandidates(false)}
                                candidates={transferCandidates} setCandidates={setTransferCandidates} />
                            <TransactionFilterSheet
                                open={openFilterPopUp}
                                onClose={() => setOpenFilterPopUp(false)}
                                onApply={(draft) => { setOpenFilterPopUp(false); applyFilters(draft) }}
                            />

                            </div>
                            {user_transactions.total === null ? (
                                <SkeletonRows rows={6} className="px-3" />
                            ) : user_transactions.total === 0 ? (
                                anyFilter ? (
                                    <EmptyState icon={FunnelIcon} title="Nada con estos filtros"
                                        action={<Button size="sm" variant="secondary" onClick={clearAllFilters}>Quitar filtros</Button>} />
                                ) : (
                                    <EmptyState icon={EnvelopeIcon} title="Aún no hay transacciones"
                                        description="Conecta tu correo y Topi las agrega solas."
                                        action={<Link to="/dashboard/connect-email" className="text-sm font-medium text-topi-600 dark:text-indigo-300 hover:underline">Conectar correo</Link>} />
                                )
                            ) : (
                                days.map(({ date, items }, index) => {
                                    // Un día partido entre dos páginas tendría un neto a medias: mejor no mostrarlo
                                    const cut = (index === 0 && currentFrontendPage > 1) || (index === days.length - 1 && lastOfBatch < user_transactions.total);
                                    const net = cut ? null : dayNet(items);
                                    return (
                                        <section key={date} aria-labelledby={`date-${date}`} className="border-t border-gray-200 dark:border-gray-700">
                                            <div className={`px-3 md:px-4 py-1.5 flex items-center justify-between gap-2 ${TX_COLUMNS} bg-gray-50 dark:bg-gray-900 transition-colors duration-300`}>
                                                <h3 id={`date-${date}`} className="lg:col-span-2 text-xs md:text-sm font-semibold text-ink-2 dark:text-gray-300">{dayLabel(date)}</h3>
                                                {net !== null && (
                                                    <span className={`lg:col-start-3 lg:text-right text-xs md:text-sm font-semibold tabular-nums ${net > 0 ? 'text-money-in dark:text-money-in-dark' : net < 0 ? 'text-money-out dark:text-money-out-dark' : 'text-ink-2 dark:text-gray-400'}`}>
                                                        <span className="sr-only">Neto del día: </span>{net > 0 ? '+' : ''}{formatMoney(net)}
                                                    </span>
                                                )}
                                            </div>
                                            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {items.map(tx => <TransactionRow key={tx.id} tx={tx} onOpen={handleOpenTransDetail} account={accountsById.get(String(tx.account?.id))} />)}
                                            </ul>
                                        </section>
                                    );
                                })
                            )}

                            <div className="w-full p-2 flex flex-row justify-between border-t border-gray-200 dark:border-gray-700 items-center transition-colors duration-300">

                                <div className="divide-x flex flex-row gap-2 items-center">

                                    <button className="py-1 rounded-2xl px-4 flex flex-row items-center border border-[#e9e8ee] dark:border-gray-700 hover:bg-slate-200 dark:hover:bg-gray-700 dark:text-white transition-colors duration-300"
                                        onClick={() => downloadTRX()}
                                    >
                                        {/* <span className="md:text-base text-xs"> Descargar </span> */}
                                        <ArrowDownTrayIcon className="w-4 h-4 group-hover:text-[#5266EB]" />

                                    </button>




                                    <div className="px-4 font-semibold text-sm text-gray-500 dark:text-gray-400">
                                        {user_transactions.total ?
                                            <span>Mostrando <span className="text-gray-800 dark:text-gray-300">{firstOfBatch}-{lastOfBatch}</span> de <span className="text-gray-800 dark:text-gray-300">{user_transactions.total}</span></span>
                                            :
                                            <></>
                                        }
                                    </div>
                                </div>
                                <div className="border border-gray-300 dark:border-gray-700 rounded-md flex flex-row items-center transition-colors">
                                    {currentFrontendPage === 1 ?
                                        <div>
                                            <ChevronLeftIcon className="w-5 h-5 mr-2 text-gray-200 dark:text-gray-700" />
                                        </div> :
                                        <button
                                            onClick={hnadlePrevBatch} className="hover:text-[#5266EB] dark:text-gray-300 dark:hover:text-[#5266EB] transition-colors">
                                            <ChevronLeftIcon className="w-5 h-5 mr-2 " />
                                        </button>
                                    }
                                    <div className="border-l border-gray-300 dark:border-gray-700 px-2 text-sm text-gray-600 dark:text-gray-400">
                                        {currentFrontendPage}/{lastPageCalc(user_transactions.total)}
                                    </div>
                                    {currentFrontendPage === lastPageCalc(user_transactions.total) ?
                                        <div
                                            className="border-l border-gray-300 dark:border-gray-700 text-gray-200 dark:text-gray-700 transition-colors"
                                        >
                                            <ChevronRightIcon className="w-5 h-5 ml-2 " />
                                        </div> :
                                        <button
                                            className="border-l border-gray-300 dark:border-gray-700 hover:text-[#5266EB] dark:text-gray-300 dark:hover:text-[#5266EB] transition-colors"
                                            onClick={handleNextBatch}>
                                            <ChevronRightIcon className="w-5 h-5 ml-2 " />
                                        </button>
                                    }
                                </div>
                            </div>

                        </div>
                    </div>

                </div>
                <TransactionDetail
                    openTransDetail={openTransDetail}
                    setOpenTransDetail={handleCloseTransDetail}
                    detailInfo={detailInfo}
                    setDetailInfo={setDetailInfo}
                    currentFrontendPage={currentFrontendPage}

                />
            </div>
        </>

    )
}

const mapStateToProps = state => ({
    user_categories: state.CashFlow.user_categories,
    user_accounts: state.CashFlow.user_accounts,
    user_transactions: state.CashFlow.user_transactions,
    trans_filters_activated: state.CashFlow.trans_filters_activated,
    default_limit: state.CashFlow.user_transactions.default_limit
})

export default connect(mapStateToProps, {
    get_user_transactions,
    update_transaction,
    update_transaction_local,
    change_transactions_filter


})(Transactions)
