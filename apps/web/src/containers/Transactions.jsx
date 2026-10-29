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
import { formatMoney, formatDate, capitalizeWords, parseDatetimetoDateStrFormat, parseDatetoDatetimeBrow } from "../components/helpers";

import TransactionFilterSheet, { countPanelFilters } from "../components/transactions/TransactionFilterSheet";
import Chip from "../components/ui/Chip";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/react";
import CreateTransaction from "../components/transactions/CreateTransaction";
import TransferModal from "../components/transactions/TransferModal";
import TransferCandidatesModal from "../components/transactions/TransferCandidatesModal";
import { fetch_transfer_candidates } from "../redux/actions/transfers";
import FormatMoneyShowDecs from "../components/FormatMoneyShowDecs";
//icons
import {
    PlusIcon, MagnifyingGlassIcon, ChevronLeftIcon, ChevronRightIcon,
    ArrowDownTrayIcon, ArrowUpTrayIcon, QueueListIcon, ListBulletIcon, ArrowsRightLeftIcon
} from '@heroicons/react/20/solid'
import { FunnelIcon, ExclamationTriangleIcon, ChevronDownIcon, Squares2X2Icon, SparklesIcon } from '@heroicons/react/20/solid'

import { Emoji } from "emoji-picker-react";
import { change_transactions_filter, filtersFromState } from "../redux/actions/cashflow";

const QUICK = [
    { id: 'all', label: 'Todas', icon: Squares2X2Icon },
    { id: 'verify', label: 'Por revisar', icon: ExclamationTriangleIcon },
    { id: 'new', label: 'Nuevas', icon: SparklesIcon },
    { id: 'transfer', label: 'Transferencias', icon: ArrowsRightLeftIcon },
];

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
    const [displayItems, setDisplayItems] = useState([])
    const [loadingNextPage, setLoadingNextPage] = useState(false)



    useEffect(() => {
        if (user_transactions.items && user_transactions.items.length > 0) {


            setDisplayItems(user_transactions.items)
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

    const groupedTransactions = useMemo(() => {
        if (!Array.isArray(user_transactions.items)) {
            return {};
        }

        const groups = user_transactions.items.reduce((acc, tx) => {
            const dateKey = tx.date.split(' ')[0];
            (acc[dateKey] = acc[dateKey] || []).push(tx);
            return acc;
        }, {});

        // The Object.keys will be sorted chronologically by default for YYYY-MM-DD format,
        // but we want descending order, so we reverse it.
        const sortedDates = Object.keys(groups).sort().reverse();

        return { groups, sortedDates };
    }, [user_transactions.items ? user_transactions.items.length : 0, user_transactions]);

    const [vizTxByDate, setVizTxbyDate] = useState(true)



    return (
        <>

            <div className="top-0 flex justify-center">
                <div className="w-full px-2 lg:px-0 top-0">
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
                                        <MenuButton className="h-10 px-3 md:px-4 rounded-2xl bg-topi-500 hover:bg-topi-600 text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500 focus-visible:ring-offset-2"
                                            aria-label="Nuevo movimiento">
                                            <PlusIcon className="w-5 h-5" aria-hidden="true" />
                                            <span className="hidden md:inline">Nuevo</span>
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

                            {/* transactions table */}
                            <div className='bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold mt-2 py-2 flex flex-row border-b dark:border-gray-700 transition-colors duration-300'>

                                <div className="min-w-[30%] md:min-w-[130px] lg:min-w-[150px] xl:min-w-[150px]">
                                    <div className="pl-[30px] md:pl-[35px] text-sm md:text-base">Monto</div>
                                </div>
                                <div className="min-w-[1%] md:min-w-[4px] lg:min-w-[10px] xl:min-w-[12px]"></div>
                                <div className="min-w-[40%] md:min-w-[184px] lg:min-w-[240px] xl:min-w-[290px] text-sm md:text-base ">Descripción</div>
                                <div className="min-w-[1%] md:min-w-[4px] lg:min-w-[10px] xl:min-w-[12px]"></div>
                                <div className="min-w-[18%] md:min-w-[116px] lg:min-w-[136px] xl:min-w-[152px] text-sm md:text-base ">Categoría</div>
                                <div className="w-[0px] lg:min-w-[0px] xl:min-w-[12px]"></div>
                                {vizTxByDate === false ?
                                    <>
                                        <div className="min-w-[90px] hidden xl:block">Fecha</div>
                                        <div className="w-[0px] lg:min-w-[10px] xl:min-w-[12px]"></div>
                                    </> : <></>
                                }
                                <div className="min-w-[126px] xl:min-w-[150px] hidden lg:block">Cuenta</div>
                                <div className="min-w-[1%] md:min-w-[4px] lg:min-w-[10px] xl:min-w-[12px]"></div>
                                <div className="min-w-[9%] md:min-w-[40px]"></div>

                            </div>

                            </div>
                            {vizTxByDate === false ?
                                <div>
                                    {user_transactions.total !== null ?
                                        <div>
                                            {user_transactions.total === 0 ?
                                                <div className="p-6 dark:text-gray-300">Aún no tienes transacciones. Crea una con el botón «Crear» o conecta tu correo para que Topi las agregue solas.</div>
                                                :
                                                <ul className='text-gray-400 text-sm'>
                                                    {displayItems && displayItems.map((transaction, index) => (
                                                        <li
                                                            key={transaction.id}
                                                            onClick={() => handleOpenTransDetail(transaction.id)}
                                                            //onMouseOver={()=>appearUp(transaction.should_verify, transaction.id)}
                                                            //onMouseLeave={disappearInfo}
                                                            className='relative py-2 flex flex-row justify-start border-t dark:border-gray-700 gap-[1%] md:gap-[4px] lg:gap-[9px] xl:gap-[12px] hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150'>
                                                            {/* monto */}
                                                            <div className='min-w-[30%] md:min-w-[130px] lg:min-w-[150px] xl:min-w-[150px] flex flex-col'>

                                                                <div className="flex flex-row justify-start items-center">
                                                                    {transaction.expense === false ?
                                                                        <div className="w-[24px] md:w-[32px] h-8 flex justify-center items-center">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#16a34a" class="size-5">
                                                                                <path fill-rule="evenodd" d="M8.25 3.75H19.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-1.5 0V6.31L5.03 20.03a.75.75 0 0 1-1.06-1.06L17.69 5.25H8.25a.75.75 0 0 1 0-1.5Z" clip-rule="evenodd" />
                                                                            </svg>
                                                                        </div>
                                                                        :
                                                                        <div className="w-[24px] md:w-[32px] h-8 flex justify-center items-center">
                                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e11d48" class="size-5">
                                                                                <path fill-rule="evenodd" d="M3.97 3.97a.75.75 0 0 1 1.06 0l13.72 13.72V8.25a.75.75 0 0 1 1.5 0V19.5a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1 0-1.5h9.44L3.97 5.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                                                                            </svg>
                                                                        </div>
                                                                    }

                                                                    <div className='w-[70px] md:w-[96px] lg:w-[100px] px-1 flex items-center text-gray-700 dark:text-gray-200'>
                                                                        <FormatMoneyShowDecs
                                                                            numb={transaction.amount}
                                                                            currency={transaction.currency}
                                                                            base={transaction.amount_base}
                                                                            align="start"
                                                                            showDecimals={true}
                                                                            intClass="text-left text-xs lg:text-base"
                                                                            decClass="text-left text-[8px] lg:text-[10px]"

                                                                        />

                                                                        {/* <span className='w-[70px] md:w-[96px] lg:w-[100px] text-left'>{formatMoney(transaction.amount)}</span> */}
                                                                    </div>
                                                                </div>
                                                                <div className="xl:hidden w-full text-left pl-[28px] md:pl-[32px] lg:pl-[38px] text-xs text-gray-400 dark:text-gray-500">
                                                                    {parseDatetimetoDateStrFormat(parseDatetoDatetimeBrow(transaction.date, "YYYY-MM-DD HH:mm:ss Z"), "YYYY-MM-DD")}
                                                                </div>


                                                            </div>
                                                            {/* <div className="w-[3px] md:w-[4px] lg:w-[9px] xl:w-[12px]"></div> */}
                                                            {/* description */}
                                                            <div className='min-w-[40%] md:min-w-[184px] lg:min-w-[240px] xl:min-w-[290px] flex items-center text-gray-900 dark:text-gray-100 font-medium'>
                                                                <span className="truncate lg:text-sm text-xs text-left w-full">{transaction.description}</span>
                                                            </div>
                                                            {/* <div className="w-[3px] md:w-[4px] lg:w-[9px] xl:w-[12px]"></div> */}
                                                            <div className='min-w-[18%] md:min-w-[116px] lg:min-w-[136px] xl:min-w-[152px] flex items-center justify-start gap-1 md:gap-2'>
                                                                {transaction.category?.emoji && transaction.category.emoji !== "" && (
                                                                    <Emoji unified={(transaction.category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                                                                )}
                                                                <span className="truncate text-left w-full text-xs lg:text-base">{capitalizeWords(transaction.category.name)}</span>
                                                            </div>
                                                            {/* <div className="w-[0px] xl:w-[12px]"></div> */}
                                                            <div className='min-w-[90px] hidden xl:flex items-center'>
                                                                <span className="truncate text-left w-full">{formatDate(transaction.date)}</span>
                                                            </div>
                                                            {/* <div className="w-[0px] lg:w-[9px] xl:w-[12px]"></div> */}
                                                            <div className='min-w-[126px] xl:min-w-[150px] hidden lg:flex items-center justify-start'>
                                                                <span className="truncate text-left w-full">{transaction.account.name}</span>
                                                            </div>
                                                            {/* <div className="w-[3px] md:w-[4px] lg:w-[9px] xl:w-[12px]"></div> */}
                                                            <div className='min-w-[9%] md:min-w-[40px] flex items-center justify-start'>
                                                                <span className="w-[28px] md:w-[35px] flex justify-start text-center">
                                                                    {transaction.transfer_group_id && <span title="Transferencia entre tus cuentas" className="inline-flex items-center mr-1 text-topi-500"><ArrowsRightLeftIcon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Transferencia</span></span>}
                                                                    {transaction.should_verify === true ?
                                                                        <span title="Por revisar" className="inline-flex items-center text-status-warn-text dark:text-amber-300"><ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Por revisar</span></span> :
                                                                        <>
                                                                            {transaction.checked === false ?
                                                                                <span title="Nuevo" className="inline-flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-topi-500" aria-hidden="true" /><span className="sr-only">Nuevo</span></span> :
                                                                                <></>}
                                                                        </>}



                                                                </span>
                                                            </div>

                                                        </li>
                                                    ))}

                                                </ul>
                                            }
                                        </div> :
                                        <div>
                                            Cargando ...
                                        </div>
                                    }
                                </div> : <></>}


                            {/* transactions table2 */}
                            {vizTxByDate === true ?
                                <div>
                                    {user_transactions.total !== null ?
                                        <div>
                                            {groupedTransactions.sortedDates && groupedTransactions.sortedDates.map(date => (
                                                <section key={date} className="date-group border-y border-gray-200 dark:border-gray-700" aria-labelledby={`date-${date}`}>
                                                    <h3 id={`date-${date}`} className="py-1 px-2 date-header text-[11px] md:text-[13px] font-semibold text-gray-500 dark:text-gray-400 sticky top-0 bg-gray-100 dark:bg-gray-900 transition-colors duration-300">
                                                        {date}
                                                    </h3>
                                                    <ul className="transactions-list space-y-3 text-gray-400 text-sm">
                                                        {groupedTransactions.groups[date].map((tx) => (
                                                            <li key={tx.id}
                                                                onClick={() => handleOpenTransDetail(tx.id)}
                                                                className="transaction-item relative py-2 flex flex-row justify-start border-t dark:border-gray-700 gap-[1%] md:gap-[4px] lg:gap-[9px] xl:gap-[12px] hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150">

                                                                <div className='min-w-[30%] md:min-w-[130px] lg:min-w-[150px] xl:min-w-[150px]'>
                                                                    <div className="flex flex-row justify-start items-center">
                                                                        {tx.expense === false ?
                                                                            <div className="w-[24px] md:w-[32px] h-8 flex justify-center items-center">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#16a34a" class="size-5">
                                                                                    <path fill-rule="evenodd" d="M8.25 3.75H19.5a.75.75 0 0 1 .75.75v11.25a.75.75 0 0 1-1.5 0V6.31L5.03 20.03a.75.75 0 0 1-1.06-1.06L17.69 5.25H8.25a.75.75 0 0 1 0-1.5Z" clip-rule="evenodd" />
                                                                                </svg>
                                                                            </div>
                                                                            :
                                                                            <div className="w-[24px] md:w-[32px] h-8 flex justify-center items-center">
                                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#e11d48" class="size-5">
                                                                                    <path fill-rule="evenodd" d="M3.97 3.97a.75.75 0 0 1 1.06 0l13.72 13.72V8.25a.75.75 0 0 1 1.5 0V19.5a.75.75 0 0 1-.75.75H8.25a.75.75 0 0 1 0-1.5h9.44L3.97 5.03a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
                                                                                </svg>
                                                                            </div>
                                                                        }
                                                                        <p className={`w-[70px] md:w-[96px] lg:w-[100px] px-1 flex items-center font-semibold ${tx.expense ? 'text-gray-800 dark:text-gray-200' : 'text-green-600 dark:text-green-500'}`}>
                                                                            <FormatMoneyShowDecs
                                                                                numb={tx.amount}
                                                                                currency={tx.currency}
                                                                                base={tx.amount_base}
                                                                                align="start"
                                                                                showDecimals={true}
                                                                                intClass="text-left text-xs lg:text-base"
                                                                                decClass="text-left text-[8px] lg:text-[10px]"
                                                                            />
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <div className='min-w-[40%] md:min-w-[184px] lg:min-w-[240px] xl:min-w-[290px] flex items-center text-gray-900 dark:text-gray-100 font-medium'>
                                                                    <span className="truncate lg:text-sm text-xs text-left max-w-[290px]">{tx.description}</span>
                                                                </div>
                                                                {/* <div className="w-[3px] md:w-[4px] lg:w-[9px] xl:w-[12px]"></div> */}
                                                                <div className='min-w-[18%] md:min-w-[116px] lg:min-w-[136px] xl:min-w-[152px] flex items-center justify-start gap-1 md:gap-2'>
                                                                    {tx.category?.emoji && tx.category.emoji !== "" && (
                                                                        <Emoji unified={(tx.category.emoji).toLowerCase()} emojiStyle="apple" size={16} />
                                                                    )}
                                                                    <span className="truncate text-left w-full text-xs lg:text-base">{capitalizeWords(tx.category.name)}</span>
                                                                </div>
                                                                <div className='min-w-[126px] xl:min-w-[150px] hidden lg:flex items-center justify-start'>
                                                                    <span className="truncate text-left w-full">{tx.account.name}</span>
                                                                </div>
                                                                {/* <div className="w-[3px] md:w-[4px] lg:w-[9px] xl:w-[12px]"></div> */}
                                                                <div className='min-w-[9%] md:min-w-[40px] flex items-center justify-start'>
                                                                    <span className="w-[28px] md:w-[35px] flex justify-start text-center">
                                                                        {tx.transfer_group_id && <span title="Transferencia entre tus cuentas" className="inline-flex items-center mr-1 text-topi-500"><ArrowsRightLeftIcon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Transferencia</span></span>}
                                                                    {tx.should_verify === true ?
                                                                            <span title="Por revisar" className="inline-flex items-center text-status-warn-text dark:text-amber-300"><ExclamationTriangleIcon className="w-4 h-4" aria-hidden="true" /><span className="sr-only">Por revisar</span></span> :
                                                                            <>
                                                                                {tx.checked === false ?
                                                                                    <span title="Nuevo" className="inline-flex items-center"><span className="w-2.5 h-2.5 rounded-full bg-topi-500" aria-hidden="true" /><span className="sr-only">Nuevo</span></span> :
                                                                                    <></>}
                                                                            </>}

                                                                    </span>
                                                                </div>

                                                            </li>
                                                        ))}
                                                    </ul>
                                                </section>
                                            ))}
                                        </div> :
                                        <div>
                                            Cargando ...
                                        </div>
                                    }
                                </div> : <></>}


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
