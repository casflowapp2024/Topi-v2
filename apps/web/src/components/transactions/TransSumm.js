//components
import { formatMoney, capitalizeWords, formatDate, parseDatetimetoDateStrFormat, parseDatetoDatetimeBrow } from "../helpers";
import { Emoji } from "emoji-picker-react";
import FormatMoneyShowDecs from "../FormatMoneyShowDecs";
import InstallmentSchedule from "./InstallmentSchedule";
import { ChevronRightIcon } from "@heroicons/react/20/solid";

// Fila que se toca para cambiar un dato sin pasar por "Editar"
const PickRow = ({ label, onClick, children }) => (
    <button type="button" onClick={onClick} aria-label={`${label}: cambiar`}
        className="w-full mb-3 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-left hover:border-topi-500/50 hover:bg-gray-50 dark:hover:bg-gray-700/40 active:scale-[0.99] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-topi-500">
        <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-xs text-ink-2 dark:text-gray-400">{label}</span>
            <span className="flex items-center gap-2 min-w-0 text-sm font-medium text-gray-900 dark:text-white">{children}</span>
        </span>
        <span className="shrink-0 text-xs font-medium text-topi-600 dark:text-topi-200">Cambiar</span>
        <ChevronRightIcon className="w-4 h-4 shrink-0 text-gray-400" aria-hidden="true" />
    </button>
);

const accountLabel = (account) => `${account?.name || ''}${account?.last_four_digits ? ` - ${account.last_four_digits}` : ''}`;

const TransSumm = ({
    detailInfo,
    create = false,
    onPickCategory, // si llegan, la categoría y la cuenta se cambian tocándolas
    onPickAccount,
}) => {

    return (
        <div className="flex flex-col justify-center items-center w-full" >
            {/* title and close */}
            <div class="flex justify-between mb-4 rounded-t sm:mb-5 w-full">
                <div class="w-[98%] text-lg text-gray-900 md:text-xl dark:text-white text-center">
                    <h3 class="font-semibold ">
                        {detailInfo.description && detailInfo.description}
                    </h3>
                    <p class="font-bold">
                        {detailInfo.expense === false ?
                            <span className=' text-xl text-emerald-600 '>
                                +<FormatMoneyShowDecs
                                    numb={detailInfo.amount && detailInfo.amount}
                                    currency={detailInfo.currency}
                                    base={detailInfo.amount_base}
                                    showDecimals={true}
                                    intClass="text-xl"
                                    decClass="text-sm"
                                />
                            </span>
                            :
                            <span className=' text-xl text-red-600'>
                                -<FormatMoneyShowDecs
                                    numb={detailInfo.amount && detailInfo.amount}
                                    currency={detailInfo.currency}
                                    base={detailInfo.amount_base}
                                    showDecimals={true}
                                    intClass="text-xl"
                                    decClass="text-sm"
                                />
                            </span>
                        }
                    </p>
                </div>

            </div>
            {/* detalle */}
            {(onPickCategory || onPickAccount) && (
                <div className="w-full mb-2">
                    {onPickCategory && (
                        <PickRow label="Categoría" onClick={onPickCategory}>
                            {detailInfo.category?.emoji && <Emoji unified={detailInfo.category.emoji.toLowerCase()} emojiStyle="apple" size={18} />}
                            <span className="truncate">{capitalizeWords(detailInfo.category?.name)}</span>
                        </PickRow>
                    )}
                    {onPickAccount && (
                        <PickRow label="Cuenta" onClick={onPickAccount}>
                            <span className="truncate">{accountLabel(detailInfo.account)}</span>
                        </PickRow>
                    )}
                </div>
            )}
            <dl className="w-full">
                {!onPickCategory && <>
                <dt class="mb-2 font-semibold leading-none text-gray-900 dark:text-white">Categoria</dt>
                <dd class="mb-4 font-light text-gray-500 sm:mb-5 dark:text-gray-400 flex flex-row gap-2">
                    {detailInfo.category && detailInfo.category.emoji &&
                        <Emoji unified={detailInfo.category.emoji.toLowerCase()} emojiStyle="apple" size={20} />
                    }
                    {capitalizeWords(detailInfo.category && detailInfo.category.name)}
                </dd>
                </>}
                <dt class="mb-2 font-semibold leading-none text-gray-900 dark:text-white mt-4">Detalles</dt>
                <dd class="mb-2 font-light text-gray-500 sm:mb-2 dark:text-gray-400 flex flex-col">

                    <span>Fecha: {parseDatetimetoDateStrFormat(parseDatetoDatetimeBrow(detailInfo.date && detailInfo.date, "YYYY-MM-DD HH:mm:ss Z"), "DD-MM-YYYY")}</span>

                    {!onPickAccount && <span>Producto: {accountLabel(detailInfo.account)}</span>}

                    {detailInfo.installments > 1 && <span> Cuotas: {detailInfo.installments}</span>}
                    {!create && <InstallmentSchedule transactionId={detailInfo.id} installments={detailInfo.installments} />}
                    {detailInfo.transfer_group_id ?
                        <span> Tipo: Transferencia ({detailInfo.expense === false ? 'entrada' : 'salida'})</span>
                        : detailInfo.expense === false ?
                            <span> Tipo: Ingreso</span>
                            :
                            <span> Tipo: Gasto</span>
                    }
                    {create ?
                        <></>
                        :
                        <div className='mt-4 font-bold text-xs'>
                            {detailInfo.automated === false ?
                                <span> Transacción ingresada manualmente</span>
                                :
                                <span> Transacción registrada automaticamente</span>
                            }
                        </div>
                    }
                    {detailInfo.should_verify !== true ?
                        <></>
                        :
                        <p className="mt-3 text-xs text-center bg-yellow-50 border-t-4 border-yellow-300 py-1 px-2 inline-block">
                            <span className="inline-flex items-center gap-2">
                                <Emoji unified="1f4a1" emojiStyle="apple" size={16} />
                                <span className="text-yellow-800">
                                    Verifica esta transacción. No estamos seguros de la cuenta.
                                </span>
                            </span>
                        </p>
                    }
                </dd>

            </dl>
        </div >
    )
}



export default TransSumm
